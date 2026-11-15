import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionService, createRecordStore, IDLE_MS, ABSOLUTE_MS } from '../src/services/sessionService.js';
import { csrfProtection, publicCatalogCache } from '../src/middlewares/trafficControl.js';

function memoryStore(clock) {
  const rows = new Map();
  return {
    rows,
    async put(key, value, ttl) { rows.set(key, { value, until: clock() + ttl }); },
    async get(key) { const row = rows.get(key); return row && row.until > clock() ? row.value : null; },
    async touch(key, ttl) { const row = rows.get(key); if (!row || row.until <= clock()) return false; row.until = clock() + ttl; return true; },
    async remove(key) { rows.delete(key); },
  };
}

test('server session expires at 30 minutes and background reads do not renew it', async () => {
  let now = 0;
  const store = memoryStore(() => now);
  const service = createSessionService({ store, clock: () => now });
  const { token } = await service.create('user', 3);
  assert.equal((await service.read(token)).authVersion, 3);
  assert.ok([...store.rows.keys()].every((key) => !key.includes(token)));
  now = IDLE_MS - 1;
  assert.equal((await service.read(token)).userId, 'user');
  now = IDLE_MS;
  assert.equal(await service.read(token, true), null);
});

test('real activity extends idle expiry, logout revokes, absolute lifetime cannot extend', async () => {
  let now = 0;
  const service = createSessionService({ store: memoryStore(() => now), clock: () => now });
  const { token } = await service.create('user');
  now = IDLE_MS - 1;
  assert.ok(await service.read(token, true));
  now += IDLE_MS - 1;
  assert.ok(await service.read(token));
  await service.revoke(token);
  assert.equal(await service.read(token), null);
  now = 0;
  const next = await service.create('user');
  for (now = IDLE_MS / 2; now < ABSOLUTE_MS; now += IDLE_MS / 2) assert.ok(await service.read(next.token, true));
  assert.equal(await service.read(next.token, true), null);
});

test('revocation racing activity cannot recreate a missing session', async () => {
  const store = memoryStore(() => 0);
  const original = store.touch;
  store.touch = async (key, ttl) => { await store.remove(key); return original(key, ttl); };
  const service = createSessionService({ store, clock: () => 0 });
  const { token } = await service.create('user');
  assert.equal(await service.read(token, true), null);
});

test('database OAuth state consume is atomic and expired records are rejected', async () => {
  let present = true;
  const store = createRecordStore({ redis: async () => null, clock: () => 10, database: { authRecord: {
    findUnique: async () => ({ value: { nonce: 'value' }, expiresAt: new Date(20) }),
    deleteMany: async () => { const count = present ? 1 : 0; present = false; return { count }; },
  } } });
  const results = await Promise.all([store.take('state'), store.take('state')]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('CSRF rejects missing custom header and foreign origins, retaining signed payOS webhook route', () => {
  const check = (method, path, headers) => { let error; csrfProtection({ method, path, get: (key) => headers[key] }, {}, (value) => { error = value; }); return error; };
  assert.equal(check('POST', '/api/auth/login', {})?.status, 403);
  assert.equal(check('POST', '/api/orders', { 'X-Havie-Request': '1', Origin: 'https://evil.example' })?.status, 403);
  assert.equal(check('POST', '/api/orders', { 'X-Havie-Request': '1', Origin: 'http://localhost:5174' }), undefined);
  assert.equal(check('POST', '/api/payments/payos/webhook', {}), undefined);
});

test('public catalog caching never captures authenticated personal endpoints', () => {
  const original = () => {};
  const response = { json: original };
  let called = false;
  publicCatalogCache({ method: 'GET', path: '/api/me', originalUrl: '/api/me' }, response, () => { called = true; });
  assert.equal(response.json, original);
  assert.equal(called, true);
});
