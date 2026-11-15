// Isolated integration/load test; refuses to use the shop database. No dotenv.
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import prisma from '../src/config/prisma.js';
import app from '../src/app.js';
import { sessions, getRedis, createRecordStore, createSessionService } from '../src/services/sessionService.js';
import bcrypt from 'bcrypt';

const target = new URL(process.env.DATABASE_URL || 'http://invalid');
const localHosts = process.env.HAVIE_LOADTEST_CONTAINER === 'true' ? ['database'] : ['localhost', '127.0.0.1'];
if (target.pathname !== '/havie_loadtest' || !localHosts.includes(target.hostname) || process.env.NODE_ENV !== 'test') {
  throw new Error('Load test requires NODE_ENV=test and the dedicated local havie_loadtest database.');
}
const users = Number(process.env.LOADTEST_USERS || 1000);
const rounds = Number(process.env.LOADTEST_ROUNDS || 10);
const rampMs = Number(process.env.LOADTEST_RAMP_MS || 5000);
if (!Number.isInteger(users) || users < 1 || users > 1000) throw new Error('Invalid test size');
const server = app.listen({ port: 0, host: '127.0.0.1', backlog: 4096 });
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const samples = [];
const headers = { 'X-Havie-Request': '1', Origin: 'http://localhost:5174' };
const clients = [];
let setupCheck;
try {
  const category = await prisma.category.upsert({ where: { slug: 'loadtest-rackets' }, create: { name: 'Load test rackets', slug: 'loadtest-rackets' }, update: {} });
  const brand = await prisma.brand.upsert({ where: { slug: 'loadtest-brand' }, create: { name: 'Load test brand', slug: 'loadtest-brand' }, update: {} });
  await prisma.product.createMany({ data: Array.from({ length: 1000 }, (_, i) => ({ id: `load-product-${i}`, name: `Synthetic racket ${i}`, slug: `load-product-${i}`, categoryId: category.id, brandId: brand.id })), skipDuplicates: true });
  await prisma.productVariant.createMany({ data: Array.from({ length: 1000 }, (_, i) => ({ id: `load-variant-${i}`, productId: `load-product-${i}`, sku: `LOAD-${i}`, name: '4U', price: 1000000 + i * 10000, stockQuantity: 30 })), skipDuplicates: true });
  await prisma.user.createMany({ data: Array.from({ length: users }, (_, i) => ({ id: `load-user-${i}`, email: `load-${i}@example.test`, fullName: 'Synthetic customer', passwordHash: null, emailVerifiedAt: new Date() })), skipDuplicates: true });
  await prisma.user.update({ where: { id: 'load-user-0' }, data: { passwordHash: await bcrypt.hash('local-loadtest-password', 10), authVersion: 0 } });
  for (let offset = 0; offset < users; offset += 25) {
    await Promise.all(Array.from({ length: Math.min(25, users - offset) }, async (_, i) => {
      const id = offset + i;
      const session = await sessions.create(`load-user-${id}`);
      clients[id] = `havie_session=${session.token}`;
    }));
  }
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'load-0@example.test', password: 'local-loadtest-password' }) });
  const loginBody = await login.json();
  const cookieHeader = login.headers.get('set-cookie') || '';
  if (login.status !== 200 || !cookieHeader.includes('HttpOnly') || loginBody.data.accessToken || !cookieHeader.includes('SameSite=Lax')) throw new Error('Password login / HttpOnly cookie failed');
  clients[0] = cookieHeader.split(';')[0];
  // Verify actual cookie authentication, CSRF, revocation and stale bearer rejection.
  const before = await fetch(`${base}/me`, { headers: { Cookie: clients[0] } });
  const me = await before.json();
  if (before.status !== 200 || me.data.id !== 'load-user-0') throw new Error('Cookie authentication failed');
  const csrf = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Cookie: clients[0] } });
  if (csrf.status !== 403) throw new Error('CSRF protection failed');
  const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { ...headers, Cookie: clients[0] } });
  if (logout.status !== 200 || (await fetch(`${base}/me`, { headers: { Cookie: clients[0] } })).status !== 401) throw new Error('Logout revocation failed');
  const replacement = await sessions.create('load-user-0');
  clients[0] = `havie_session=${replacement.token}`;
  const bearer = await fetch(`${base}/me`, { headers: { Authorization: 'Bearer old-token' } });
  if (bearer.status !== 401) throw new Error('Legacy bearer token still accepted');
  const dbSessions = createSessionService({ store: createRecordStore({ redis: async () => null }) });
  const dbSession = await dbSessions.create('load-user-0');
  if (!(await dbSessions.read(dbSession.token, true))) throw new Error('Database session fallback failed');
  await dbSessions.revoke(dbSession.token);
  if (await dbSessions.read(dbSession.token)) throw new Error('Database session revocation failed');
  const conversationResponse = await fetch(`${base}/chat/conversations`, { method: 'POST', headers: { ...headers, Cookie: clients[0] } });
  const conversation = await conversationResponse.json();
  if (!conversationResponse.ok) throw new Error('Conversation creation failed');
  const redis = await getRedis();
  if (redis) {
    await redis.zAdd('havie:chat:leases', [{ score: Date.now() + 60000, value: 'test-lease-a' }, { score: Date.now() + 60000, value: 'test-lease-b' }]);
    const messageOptions = { method: 'POST', headers: { ...headers, Cookie: clients[0], 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '25 lbs bao nhiêu kg' }) };
    const busy = await fetch(`${base}/chat/conversations/${conversation.data.id}/messages`, messageOptions);
    if (busy.status !== 429 || (await busy.json()).error.code !== 'CHAT_BUSY') throw new Error('Shared chat admission limit failed');
    await redis.zRem('havie:chat:leases', ['test-lease-a', 'test-lease-b']);
    const allowed = await fetch(`${base}/chat/conversations/${conversation.data.id}/messages`, messageOptions);
    if (!allowed.ok) throw new Error('Chat slot did not release');
    await allowed.arrayBuffer();
  }
  await prisma.user.update({ where: { id: 'load-user-0' }, data: { authVersion: { increment: 1 } } });
  if ((await fetch(`${base}/me`, { headers: { Cookie: clients[0] } })).status !== 401) throw new Error('Password-change session invalidation failed');
  const fresh = await sessions.create('load-user-0', 1);
  clients[0] = `havie_session=${fresh.token}`;
  setupCheck = { passwordLogin: true, httpOnlyCookie: true, cookieAuth: true, csrf: true, logoutRevoked: true, legacyBearerRejected: true,
    databaseFallback: true, passwordChangeInvalidatesSession: true, sharedChatAdmission: Boolean(redis) };

  const start = performance.now();
  // 1,000 distinct authenticated virtual users, simultaneous rounds, think time.
  await Promise.all(clients.map(async (cookie, index) => {
    await new Promise((resolve) => setTimeout(resolve, Math.floor(index / users * rampMs)));
    for (let round = 0; round < rounds; round++) {
      const endpoint = round % 3 === 0 ? '/me' : round % 3 === 1 ? `/products?page=${index % 10 + 1}&pageSize=12` : '/cart';
      const began = performance.now();
      try {
        const response = await fetch(`${base}${endpoint}`, { headers: { ...headers, Cookie: cookie }, signal: AbortSignal.timeout(30000) });
        const body = await response.json();
        const identityMismatch = endpoint === '/me' && response.ok && body.data?.id !== `load-user-${index}`;
        samples.push({ ms: performance.now() - began, status: identityMismatch ? 500 : response.status, endpoint: endpoint.split('?')[0], code: identityMismatch ? 'IDENTITY_MISMATCH' : response.ok ? null : body?.error?.code });
      } catch (error) { samples.push({ ms: performance.now() - began, status: 0, endpoint: endpoint.split('?')[0], code: error.cause?.code || error.name }); }
      if (round + 1 < rounds) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }));
  const elapsed = performance.now() - start;
  const sorted = samples.map((item) => item.ms).sort((a, b) => a - b);
  const errors = samples.filter((item) => item.status !== 200).length;
  const report = { generatedAt: new Date().toISOString(), platform: process.platform, environment: 'isolated local PostgreSQL + Redis, one Node process, synthetic 1000-product catalog', users, rounds, rampMs, thinkTimeMs: 1000,
    requests: samples.length, errors, errorRate: errors / samples.length, elapsedMs: Math.round(elapsed), requestsPerSecond: Math.round(samples.length / elapsed * 1000),
    p50Ms: Math.round(sorted[Math.floor(sorted.length * 0.5)]), p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]), maxMs: Math.round(sorted.at(-1)),
    statusCounts: samples.reduce((counts, item) => { const key = `${item.endpoint}:${item.status}:${item.code || 'OK'}`; counts[key] = (counts[key] || 0) + 1; return counts; }, {}),
    setupCheck, note: 'Authenticated browsing only; excludes password-login bursts, chat/Groq, external providers and production network conditions.' };
  await writeFile(new URL('../data/session-loadtest-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (errors) process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  const redis = await getRedis();
  if (redis) await redis.close();
}
