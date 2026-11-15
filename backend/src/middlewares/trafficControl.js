import { randomUUID } from 'node:crypto';
import prisma from '../config/prisma.js';
import { getRedis, tokenHash } from '../services/sessionService.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const allowedOrigins = () => {
  const configured = (process.env.CORS_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (process.env.APP_ORIGIN) configured.push(process.env.APP_ORIGIN);
  if (process.env.NODE_ENV !== 'production') configured.push('http://localhost:5173', 'http://localhost:5174');
  return [...new Set(configured.map((origin) => {
    try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) ? url.origin : null; }
    catch { return null; }
  }).filter(Boolean))];
};

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path === '/api/payments/payos/webhook') return next();
  if (req.get('X-Havie-Request') !== '1' || (req.get('Origin') && !allowedOrigins().includes(req.get('Origin')))) {
    return next(new HttpError(403, 'ORIGIN_REJECTED', 'Yêu cầu không hợp lệ. Vui lòng tải lại trang.'));
  }
  next();
}

export function createRateLimiter({ name, limit, windowMs, database = prisma, redis = getRedis, clock = Date.now }) {
  return asyncHandler(async (req, res, next) => {
    const bucket = Math.floor(clock() / windowMs);
    const key = `havie:rate:${name}:${tokenHash(req.ip || 'unknown')}:${bucket}`;
    const client = await redis();
    let hits;
    if (client) hits = Number(await client.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n", { keys: [key], arguments: [String(windowMs * 2)] }));
    else {
      const row = await database.rateCounter.upsert({ where: { key }, create: { key, hits: 1, expiresAt: new Date((bucket + 2) * windowMs) }, update: { hits: { increment: 1 } } });
      hits = row.hits;
    }
    if (hits > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil(((bucket + 1) * windowMs - clock()) / 1000))));
      throw new HttpError(429, 'RATE_LIMITED', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
    }
    next();
  });
}

export function createChatAdmission({ database = prisma, redis = getRedis, maximum = Number(process.env.CHAT_MAX_CONCURRENT || 2), leaseMs = 600000 } = {}) {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 20) throw new Error('CHAT_MAX_CONCURRENT must be an integer between 1 and 20');
  return asyncHandler(async (req, res, next) => {
    const key = `chat:${randomUUID()}`;
    const now = Date.now();
    const client = await redis();
    let accepted;
    if (client) accepted = Number(await client.eval("redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]); if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[3]) then return 0 end; redis.call('ZADD',KEYS[1],ARGV[2],ARGV[4]); redis.call('PEXPIRE',KEYS[1],ARGV[5]); return 1", {
      keys: ['havie:chat:leases'], arguments: [String(now), String(now + leaseMs), String(maximum), key, String(leaseMs)],
    }));
    else accepted = await database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(720481)`;
      await tx.runtimeLease.deleteMany({ where: { expiresAt: { lte: new Date(now) } } });
      if (await tx.runtimeLease.count() >= maximum) return 0;
      await tx.runtimeLease.create({ data: { key, expiresAt: new Date(now + leaseMs) } });
      return 1;
    });
    if (!accepted) { res.set('Retry-After', '10'); throw new HttpError(429, 'CHAT_BUSY', 'Trợ lý đang bận. Anh/chị thử lại sau ít giây nhé.'); }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const operation = client ? client.zRem('havie:chat:leases', key) : database.runtimeLease.deleteMany({ where: { key } });
      void operation.catch(() => {}); // Lease also expires if the worker exits.
    };
    // Hold the slot until processing ends, even if a browser disconnects early.
    res.once('finish', release);
    req.releaseChatSlot = release;
    next();
  });
}

const cache = new Map();
export function invalidatePublicCatalogCache() { cache.clear(); }
export function publicCatalogCache(req, res, next) {
  if (req.method !== 'GET' || !/^\/api\/(?:products(?:\/[^/]+)?|brands|categories)$/u.test(req.path)) return next();
  const key = req.originalUrl;
  const entry = cache.get(key);
  if (entry && entry.until > Date.now()) return res.set('Cache-Control', 'public, max-age=10').json(entry.body);
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      if (cache.size >= 256) cache.delete(cache.keys().next().value);
      cache.set(key, { until: Date.now() + 10000, body });
      res.set('Cache-Control', 'public, max-age=10');
    }
    return json(body);
  };
  next();
}
