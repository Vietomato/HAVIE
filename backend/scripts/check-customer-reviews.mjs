import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import prisma from '../src/config/prisma.js';
import app from '../src/app.js';
import { sessions, getRedis } from '../src/services/sessionService.js';

// Read/write integration checks use only the disposable database, never shop data.
const databaseUrl = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.NODE_ENV !== 'test' || databaseUrl.pathname !== '/havie_loadtest' || !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) throw new Error('Use only the dedicated local havie_loadtest database');
const server = app.listen({ host: '127.0.0.1', port: 0, backlog: 4096 });
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
const run = randomUUID();
const checks = [];
const headers = { 'X-Havie-Request': '1', Origin: 'http://localhost:5174', 'Content-Type': 'application/json' };
async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(base + path, { method, headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}

try {
  const category = await prisma.category.create({ data: { name: 'Review checks', slug: `review-${run}` } });
  const brand = await prisma.brand.create({ data: { name: 'Review fixture', slug: `review-brand-${run}` } });
  const product = await prisma.product.create({ data: { name: 'Synthetic review racket', slug: `review-racket-${run}`, categoryId: category.id, brandId: brand.id } });
  const otherProduct = await prisma.product.create({ data: { name: 'Unreceived product', slug: `review-other-${run}`, categoryId: category.id, brandId: brand.id } });
  const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: `REVIEW-A-${run}`, name: '4U', price: 3000000, stockQuantity: 30 } });
  const otherVariant = await prisma.productVariant.create({ data: { productId: otherProduct.id, sku: `REVIEW-B-${run}`, name: '4U', price: 2000000, stockQuantity: 30 } });
  const users = [];
  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.create({ data: { fullName: `Review fixture ${i}`, email: `review-${run}-${i}@example.test`, role: i === 4 ? 'ADMIN' : 'CUSTOMER' } });
    const session = await sessions.create(user.id);
    users.push({ ...user, cookie: `havie_session=${session.token}` });
  }
  const makeOrder = (user, item, status = 'COMPLETED') => prisma.order.create({ data: { userId: user.id, orderCode: `REVIEW-${randomUUID()}`, status, paymentMethod: 'COD', subtotal: item.price, shippingFee: 0, totalAmount: item.price, recipientName: 'Synthetic recipient', recipientPhone: '0900000000', shippingAddress: 'Synthetic address', items: { create: { variantId: item.id, productName: 'Review product', variantName: item.name, price: item.price, quantity: 1, subtotal: item.price } } } });
  const order = await makeOrder(users[0], variant);
  await makeOrder(users[1], variant);
  await makeOrder(users[2], variant);
  await makeOrder(users[0], otherVariant, 'SHIPPING');
  const payload = { productId: product.id, rating: 5, comment: 'Good racket' };
  assert.equal((await request('/reviews', { method: 'POST', body: payload })).status, 401);
  assert.equal((await request('/reviews', { cookie: users[4].cookie, method: 'POST', body: payload })).status, 403);
  assert.equal((await request('/reviews', { cookie: users[3].cookie, method: 'POST', body: { ...payload, userId: users[0].id, orderId: order.id } })).status, 403);
  assert.equal((await request('/reviews', { cookie: users[0].cookie, method: 'POST', body: { productId: otherProduct.id, rating: 5 } })).status, 403);
  assert.equal((await request('/reviews', { cookie: users[0].cookie, method: 'POST', body: { ...payload, rating: 6 } })).status, 400);
  checks.push('Authentication, customer role, order ownership, completed status and rating validation');
  // Warm catalog cache before the write, then verify it is invalidated.
  await request(`/products/${product.slug}`);
  const created = await request('/reviews', { cookie: users[0].cookie, method: 'POST', body: { ...payload, userId: users[3].id, isVisible: false, orderId: 'forged-order' } });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.data.summary, { ratingAverage: 5, reviewCount: 1 });
  const stored = await prisma.review.findUnique({ where: { id: created.body.data.review.id } });
  assert.equal(stored.userId, users[0].id); assert.equal(stored.orderId, order.id); assert.equal(stored.isVisible, true);
  assert.equal((await request(`/products/${product.slug}`)).body.data.ratingAverage, 5);
  assert.equal((await request('/reviews', { cookie: users[0].cookie, method: 'POST', body: payload })).status, 409);
  const eligibility = await request(`/reviews/eligibility?productId=${product.id}`, { cookie: users[0].cookie });
  assert.equal(eligibility.body.data.review.id, stored.id);
  const stranger = await request(`/reviews/eligibility?productId=${product.id}`, { cookie: users[3].cookie });
  assert.equal(stranger.body.data.canReview, false); assert.equal(stranger.body.data.review, null);
  checks.push('Verified review creation, forged identity ignored, duplicate rejection and private eligibility');
  assert.equal((await request(`/reviews/${stored.id}`, { cookie: users[1].cookie, method: 'PATCH', body: { rating: 1 } })).status, 404);
  const parallel = await Promise.all([
    request('/reviews', { cookie: users[1].cookie, method: 'POST', body: { ...payload, rating: 3 } }),
    request('/reviews', { cookie: users[1].cookie, method: 'POST', body: { ...payload, rating: 1 } }),
    request('/reviews', { cookie: users[2].cookie, method: 'POST', body: { ...payload, rating: 4 } }),
  ]);
  assert.deepEqual(parallel.map((result) => result.status).sort(), [201, 201, 409]);
  const edited = await request(`/reviews/${stored.id}`, { cookie: users[0].cookie, method: 'PATCH', body: { rating: 2, comment: 'Updated after use', isVisible: false, productId: otherProduct.id } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.review.productId, product.id);
  const rows = await prisma.review.findMany({ where: { productId: product.id, isVisible: true } });
  const actualProduct = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal(rows.length, 3);
  assert.equal(actualProduct.reviewCount, 3);
  assert.equal(actualProduct.ratingAverage, Math.round(rows.reduce((sum, row) => sum + row.rating, 0) / 3 * 10) / 10);
  await assert.rejects(prisma.review.create({ data: { userId: users[0].id, productId: product.id, orderId: order.id, rating: 5, comment: '', isVerifiedPurchase: true } }), (error) => error.code === 'P2002');
  checks.push('Cross-account edit protection, concurrent writes, consistent average/count and database uniqueness');
  const page = await request(`/products/${product.slug}/reviews?pageSize=1&page=1`);
  assert.equal(page.body.data.length, 1); assert.equal(page.body.meta.total, 3);
  assert.ok(page.body.data[0].isVerifiedPurchase);
  assert.doesNotMatch(JSON.stringify(page.body), /userId|orderId|passwordHash|recipientPhone|@example/u);
  assert.equal((await request(`/products/${product.slug}/reviews?pageSize=999`)).status, 400);
  const myOrders = await request('/orders/my', { cookie: users[0].cookie });
  assert.ok(myOrders.body.data.some((entry) => entry.items.some((item) => item.variant.productId === product.id)));
  checks.push('Public pagination, verified-purchase badge, no private identity fields and review links from owned orders');
  const report = { generatedAt: new Date().toISOString(), passed: true, environment: 'isolated PostgreSQL + Redis, synthetic customer/order/product fixtures', checks };
  await writeFile(new URL('../data/customer-reviews-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  const redis = await getRedis();
  if (redis) await redis.close();
}
