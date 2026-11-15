import { createHash, randomBytes } from 'node:crypto';
import { createClient } from 'redis';
import prisma from '../config/prisma.js';

export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value) => createHash('sha256').update(value).digest('hex');
let redisPromise;
export async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redisPromise) redisPromise = (async () => {
    const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 2000, reconnectStrategy: false }, disableOfflineQueue: true });
    client.on('error', () => {}); // Never log credentials/URLs or session data.
    await client.connect();
    return client;
  })().catch(() => { redisPromise = null; throw new Error('SHARED_STORE_UNAVAILABLE'); });
  return redisPromise;
}

export function createRecordStore({ database = prisma, redis = getRedis, clock = Date.now } = {}) {
  return {
    async put(key, value, ttlMs) {
      const client = await redis();
      if (client) await client.set(key, JSON.stringify(value), { PX: ttlMs });
      else await database.authRecord.upsert({ where: { key }, create: { key, value, expiresAt: new Date(clock() + ttlMs) }, update: { value, expiresAt: new Date(clock() + ttlMs) } });
    },
    async get(key) {
      const client = await redis();
      if (client) { const value = await client.get(key); return value ? JSON.parse(value) : null; }
      const row = await database.authRecord.findUnique({ where: { key } });
      return row && row.expiresAt.getTime() > clock() ? row.value : null;
    },
    async take(key) {
      const client = await redis();
      if (client) { const value = await client.getDel(key); return value ? JSON.parse(value) : null; }
      const row = await database.authRecord.findUnique({ where: { key } });
      if (!row || row.expiresAt.getTime() <= clock()) return null;
      const removed = await database.authRecord.deleteMany({ where: { key, expiresAt: { gt: new Date(clock()) } } });
      return removed.count === 1 ? row.value : null;
    },
    async touch(key, ttlMs) {
      const client = await redis();
      if (client) return (await client.pExpire(key, ttlMs)) === 1;
      const result = await database.authRecord.updateMany({ where: { key, expiresAt: { gt: new Date(clock()) } }, data: { expiresAt: new Date(clock() + ttlMs) } });
      return result.count === 1;
    },
    async remove(key) {
      const client = await redis();
      if (client) await client.del(key);
      else await database.authRecord.deleteMany({ where: { key } });
    },
  };
}
export const recordStore = createRecordStore();

export function createSessionService({ store = recordStore, clock = Date.now } = {}) {
  const keyFor = (token) => `havie:session:${tokenHash(token)}`;
  return {
    async create(userId, authVersion = 0) {
      const token = opaqueToken();
      const value = { userId, authVersion, absoluteExpiresAt: clock() + ABSOLUTE_MS };
      await store.put(keyFor(token), value, IDLE_MS);
      return { token, expiresAt: clock() + IDLE_MS };
    },
    async read(token, active = false) {
      if (typeof token !== 'string' || !/^[\w-]{43}$/u.test(token)) return null;
      const key = keyFor(token);
      const value = await store.get(key);
      if (!value || value.absoluteExpiresAt <= clock()) return null;
      if (active && !await store.touch(key, Math.min(IDLE_MS, value.absoluteExpiresAt - clock()))) return null;
      return value;
    },
    async revoke(token) { if (typeof token === 'string') await store.remove(keyFor(token)); },
  };
}
export const sessions = createSessionService();
export const sessionCookie = () => process.env.NODE_ENV === 'production' ? '__Host-havie_session' : 'havie_session';
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
export function readCookie(req, name) {
  const raw = (req.headers.cookie ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  try { return raw ? decodeURIComponent(raw.slice(name.length + 1)) : null; } catch { return null; }
}
export async function issueSession(req, res, user) {
  const old = readCookie(req, sessionCookie());
  if (old) await sessions.revoke(old);
  const current = await prisma.user.findUnique({ where: { id: user.id }, select: { authVersion: true } });
  const session = await sessions.create(user.id, current.authVersion);
  res.cookie(sessionCookie(), session.token, { ...cookieOptions(), maxAge: ABSOLUTE_MS });
  res.set('Cache-Control', 'no-store');
  return { user, expiresIn: IDLE_MS / 1000 };
}
