import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialAuthService, providerConfig, safeReturnPath } from '../src/services/socialAuthService.js';
import { opaqueToken, tokenHash } from '../src/services/sessionService.js';

const env = { GOOGLE_CLIENT_ID: 'test-id', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/social/google/callback', APP_ORIGIN: 'http://localhost:5174' };
function fixture({ existingEmail = false, identity = null } = {}) {
  const rows = new Map();
  const writes = [];
  const store = { put: async (key, value) => rows.set(key, value), get: async (key) => rows.get(key), take: async (key) => { const row = rows.get(key); rows.delete(key); return row; } };
  const database = {
    oAuthIdentity: { findUnique: async () => identity, create: async (args) => writes.push(args) },
    user: { findUnique: async () => existingEmail ? { id: 'existing', isActive: true } : null, create: async (args) => { writes.push(args); return { id: 'new', isActive: true, ...args.data }; } },
  };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ id_token: 'signed-by-test-provider' }) });
  const verifyGoogle = async () => ({ sub: 'google-subject', email: 'customer@example.test', email_verified: true, name: 'Customer', nonce: [...rows.values()][0]?.nonce });
  // Nonce is captured before one-use state is consumed, as a provider would do.
  let claims;
  const service = createSocialAuthService({ store, database, env, fetchImpl, verifyGoogle: async () => claims });
  return { rows, writes, service, setClaims: (value) => { claims = value; } };
}
async function begin(f, extra = {}) {
  const binding = opaqueToken();
  const url = new URL(await f.service.begin('google', { binding, returnTo: '/products', ...extra }));
  const state = url.searchParams.get('state');
  const pending = f.rows.get(`havie:oauth:${tokenHash(state)}`);
  f.setClaims({ sub: 'google-subject', email: 'customer@example.test', email_verified: true, name: 'Customer', nonce: pending.nonce });
  return { state, binding, code: 'one-time-code', url };
}

test('OAuth start uses state, Google nonce and PKCE, never includes client secret', async () => {
  const f = fixture();
  const { url } = await begin(f);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('nonce'));
  assert.doesNotMatch(url.href, /test-secret/);
  assert.throws(() => providerConfig('google', {}), (error) => error.code === 'OAUTH_NOT_CONFIGURED');
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/auth', '/ok\nLocation: evil']) assert.equal(safeReturnPath(value), '/');
});

test('OAuth validates browser binding, consumes state once and creates only CUSTOMER', async () => {
  const f = fixture();
  const request = await begin(f);
  await assert.rejects(f.service.complete('google', { ...request, binding: opaqueToken() }), (error) => error.code === 'OAUTH_STATE_INVALID');
  const result = await f.service.complete('google', request);
  assert.equal(result.user.role, 'CUSTOMER');
  assert.equal(result.user.passwordHash, null);
  assert.equal(result.returnTo, '/products');
  await assert.rejects(f.service.complete('google', request), (error) => error.code === 'OAUTH_STATE_INVALID');
});

test('matching email does not automatically link or take over an existing account', async () => {
  const f = fixture({ existingEmail: true });
  await assert.rejects(f.service.complete('google', await begin(f)), (error) => error.code === 'OAUTH_ACCOUNT_EXISTS');
  assert.equal(f.writes.length, 0);
});

test('nonce mismatch and expired HAVIE linking session cannot create accounts or link identities', async () => {
  const f = fixture();
  const request = await begin(f);
  f.setClaims({ sub: 'subject', nonce: 'wrong', email: 'a@example.test', email_verified: true });
  await assert.rejects(f.service.complete('google', request), (error) => error.code === 'OAUTH_IDENTITY_INVALID');
  const link = await begin(f, { linkUserId: 'owner' });
  await assert.rejects(f.service.complete('google', link), (error) => error.code === 'OAUTH_LINK_SESSION_EXPIRED');
  assert.equal(f.writes.length, 0);
});

test('Facebook verifies app identity before signup and permits profiles without email', async () => {
  for (const appId of ['fb-test', 'another-app']) {
    const records = new Map();
    const writes = [];
    const store = {
      put: async (key, value) => records.set(key, value), get: async (key) => records.get(key),
      take: async (key) => { const value = records.get(key); records.delete(key); return value; },
    };
    const responses = [{ access_token: 'test-only-facebook-token' },
      { data: { is_valid: true, app_id: appId, user_id: 'fb-user', expires_at: Math.floor(Date.now() / 1000) + 600 } },
      { id: 'fb-user', name: 'Facebook customer' }];
    const service = createSocialAuthService({ store,
      env: { APP_ORIGIN: 'http://localhost:5174', FACEBOOK_CLIENT_ID: 'fb-test', FACEBOOK_CLIENT_SECRET: 'fb-test-secret', FACEBOOK_REDIRECT_URI: 'http://localhost:3000/api/auth/social/facebook/callback', FACEBOOK_GRAPH_VERSION: 'v99.0' },
      database: { oAuthIdentity: { findUnique: async () => null }, user: { create: async (args) => { writes.push(args.data); return { id: 'new', ...args.data }; } } },
      fetchImpl: async () => ({ ok: true, json: async () => responses.shift() }),
    });
    const binding = opaqueToken();
    const url = new URL(await service.begin('facebook', { binding }));
    const request = { code: 'test-code', binding, state: url.searchParams.get('state') };
    if (appId === 'fb-test') {
      const result = await service.complete('facebook', request);
      assert.equal(result.user.email, null);
      assert.equal(result.user.passwordHash, null);
      assert.equal(result.user.role, 'CUSTOMER');
    } else {
      await assert.rejects(service.complete('facebook', request), (error) => error.code === 'OAUTH_IDENTITY_INVALID');
      assert.equal(writes.length, 0);
    }
  }
});
