import { createHmac } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import prisma from '../config/prisma.js';
import { opaqueToken, recordStore, tokenHash } from './sessionService.js';
import { HttpError } from '../utils/http.js';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function safeReturnPath(value) {
  return typeof value === 'string' && /^\/(?![/\\])/u.test(value) && !/[\\\r\n]/u.test(value) && !value.startsWith('/auth') ? value : '/';
}
export function providerConfig(provider, env = process.env) {
  if (!['google', 'facebook'].includes(provider)) throw new HttpError(404, 'OAUTH_PROVIDER_UNKNOWN', 'Không hỗ trợ cách đăng nhập này.');
  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  const callback = env[`${prefix}_REDIRECT_URI`];
  if (!clientId || !clientSecret || !callback || !env.APP_ORIGIN) throw new HttpError(503, 'OAUTH_NOT_CONFIGURED', 'Cách đăng nhập này chưa được kích hoạt. Vui lòng dùng email.');
  const redirect = new URL(callback);
  const origin = new URL(env.APP_ORIGIN);
  if (env.NODE_ENV === 'production' && (redirect.protocol !== 'https:' || origin.protocol !== 'https:')) throw new HttpError(503, 'OAUTH_NOT_CONFIGURED', 'Cách đăng nhập này chưa được kích hoạt.');
  if (provider === 'facebook' && !/^v\d+\.\d+$/u.test(env.FACEBOOK_GRAPH_VERSION || '')) throw new HttpError(503, 'OAUTH_NOT_CONFIGURED', 'Cách đăng nhập này chưa được kích hoạt.');
  return { provider, clientId, clientSecret, callback: redirect.href, appOrigin: origin.origin, version: env.FACEBOOK_GRAPH_VERSION };
}

export function createSocialAuthService({ store = recordStore, database = prisma, fetchImpl = fetch, env = process.env,
  verifyGoogle = async (idToken, config) => (await jwtVerify(idToken, googleKeys, { audience: config.clientId, issuer: ['https://accounts.google.com', 'accounts.google.com'], algorithms: ['RS256'] })).payload,
} = {}) {
  const readJson = async (url, options) => {
    const response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new HttpError(400, 'OAUTH_FAILED', 'Chưa xác minh được tài khoản. Vui lòng thử lại.');
    return response.json();
  };
  return {
    async begin(provider, { returnTo, binding, linkUserId = null } = {}) {
      const config = providerConfig(provider, env);
      const state = opaqueToken();
      const verifier = opaqueToken();
      const nonce = opaqueToken();
      await store.put(`havie:oauth:${tokenHash(state)}`, { provider, bindingHash: tokenHash(binding), verifier, nonce, returnTo: safeReturnPath(returnTo), linkUserId }, 600000);
      const url = new URL(provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : `https://www.facebook.com/${config.version}/dialog/oauth`);
      for (const [key, value] of Object.entries({ client_id: config.clientId, redirect_uri: config.callback, response_type: 'code', state,
        scope: provider === 'google' ? 'openid email profile' : 'public_profile,email' })) url.searchParams.set(key, value);
      if (provider === 'google') {
        url.searchParams.set('nonce', nonce);
        url.searchParams.set('code_challenge', Buffer.from(tokenHash(verifier), 'hex').toString('base64url'));
        url.searchParams.set('code_challenge_method', 'S256');
      }
      return url.href;
    },
    async complete(provider, { code, state, binding, authenticatedUserId = null }) {
      const config = providerConfig(provider, env);
      if (!/^[\w-]{43}$/u.test(state || '') || !/^[\w-]{43}$/u.test(binding || '') || typeof code !== 'string' || !code || code.length > 4096) throw new HttpError(400, 'OAUTH_STATE_INVALID', 'Phiên xác minh đã hết hạn. Vui lòng đăng nhập lại.');
      const key = `havie:oauth:${tokenHash(state)}`;
      const pending = await store.get(key);
      if (!pending || pending.provider !== provider || pending.bindingHash !== tokenHash(binding)) throw new HttpError(400, 'OAUTH_STATE_INVALID', 'Phiên xác minh không hợp lệ.');
      const attempt = await store.take(key);
      if (!attempt) throw new HttpError(400, 'OAUTH_STATE_INVALID', 'Phiên xác minh đã được sử dụng.');
      if (attempt.linkUserId && attempt.linkUserId !== authenticatedUserId) throw new HttpError(401, 'OAUTH_LINK_SESSION_EXPIRED', 'Vui lòng đăng nhập lại để liên kết tài khoản.');
      let profile;
      if (provider === 'google') {
        const tokens = await readJson('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callback, grant_type: 'authorization_code', code_verifier: attempt.verifier }) });
        const claims = await verifyGoogle(tokens.id_token, config);
        if (!claims.sub || claims.nonce !== attempt.nonce || !claims.email || claims.email_verified !== true) throw new HttpError(400, 'OAUTH_IDENTITY_INVALID', 'Tài khoản chưa có email được xác minh.');
        profile = { subject: claims.sub, email: claims.email.toLowerCase(), fullName: String(claims.name || 'Khách hàng HAVIE').slice(0, 120), verified: true };
      } else {
        const root = `https://graph.facebook.com/${config.version}`;
        const tokenUrl = new URL(`${root}/oauth/access_token`);
        for (const [key, value] of Object.entries({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callback })) tokenUrl.searchParams.set(key, value);
        const tokens = await readJson(tokenUrl, {});
        const debugUrl = new URL(`${root}/debug_token`);
        debugUrl.searchParams.set('input_token', tokens.access_token);
        const debug = await readJson(debugUrl, { headers: { Authorization: `Bearer ${config.clientId}|${config.clientSecret}` } });
        if (!debug.data?.is_valid || String(debug.data.app_id) !== config.clientId || !debug.data.user_id ||
            debug.data.expires_at * 1000 <= Date.now()) throw new HttpError(400, 'OAUTH_IDENTITY_INVALID', 'Chưa xác minh được tài khoản Facebook.');
        const meUrl = new URL(`${root}/me`);
        meUrl.searchParams.set('fields', 'id,name,email');
        meUrl.searchParams.set('appsecret_proof', createHmac('sha256', config.clientSecret).update(tokens.access_token).digest('hex'));
        const me = await readJson(meUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
        if (String(me.id) !== String(debug.data.user_id)) throw new HttpError(400, 'OAUTH_IDENTITY_INVALID', 'Tài khoản không khớp.');
        profile = { subject: String(me.id), email: me.email?.toLowerCase() ?? null, fullName: String(me.name || 'Khách hàng HAVIE').slice(0, 120), verified: false };
      }
      const identityWhere = { provider_subject: { provider, subject: profile.subject } };
      const existing = await database.oAuthIdentity.findUnique({ where: identityWhere, include: { user: true } });
      if (existing) {
        if (attempt.linkUserId && existing.userId !== attempt.linkUserId) throw new HttpError(409, 'OAUTH_ALREADY_LINKED', 'Tài khoản này đã được liên kết với tài khoản HAVIE khác.');
        if (!existing.user.isActive) throw new HttpError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa.');
        return { user: existing.user, returnTo: attempt.returnTo };
      }
      let user;
      if (attempt.linkUserId) {
        user = await database.user.findUnique({ where: { id: attempt.linkUserId } });
        if (!user?.isActive) throw new HttpError(403, 'ACCOUNT_DISABLED', 'Tài khoản không khả dụng.');
        await database.oAuthIdentity.create({ data: { provider, subject: profile.subject, userId: user.id } });
      } else {
        if (profile.email && await database.user.findUnique({ where: { email: profile.email }, select: { id: true } })) throw new HttpError(409, 'OAUTH_ACCOUNT_EXISTS', 'Email đã có tài khoản HAVIE. Hãy đăng nhập bằng email rồi liên kết trong trang tài khoản.');
        // Always CUSTOMER; matching an admin allowlist must never elevate social signup.
        user = await database.user.create({ data: { email: profile.email, fullName: profile.fullName, passwordHash: null,
          emailVerifiedAt: profile.verified ? new Date() : null, role: 'CUSTOMER', oauthIdentities: { create: { provider, subject: profile.subject } } } });
      }
      return { user, returnTo: attempt.returnTo };
    },
  };
}
export const socialAuth = createSocialAuthService();
