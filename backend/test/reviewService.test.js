import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewService, validateReview } from '../src/services/reviewService.js';

function setup({ purchased = true, active = true, visible = true } = {}) {
  const state = { rows: [], product: { id: 'product', isActive: active }, summary: null };
  const database = {
    product: {
      findFirst: async () => active ? state.product : null,
      update: async ({ data }) => { state.summary = data; return { ...state.product, ...data }; },
    },
    order: { findFirst: async ({ where }) => {
      assert.equal(where.status, 'COMPLETED');
      assert.equal(where.items.some.variant.productId, 'product');
      return purchased && where.userId === 'buyer' ? { id: 'completed-order' } : null;
    } },
    review: {
      findFirst: async ({ where }) => state.rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null,
      create: async ({ data }) => { const row = { id: `review-${state.rows.length}`, ...data }; state.rows.push(row); return row; },
      update: async ({ where, data }) => { const row = state.rows.find((row) => row.id === where.id); Object.assign(row, data); return row; },
      aggregate: async ({ where }) => {
        const rows = state.rows.filter((row) => row.productId === where.productId && row.isVisible);
        return { _avg: { rating: rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null }, _count: { _all: rows.length } };
      },
    },
    $queryRaw: async () => [state.product],
    $transaction: async (operation) => operation(database),
  };
  return { state, database, service: createReviewService({ database }) };
}

test('review validation accepts star-only reviews, trims text and rejects invalid rating/comment', () => {
  assert.deepEqual(validateReview({ productId: ' product ', rating: 5 }), { productId: 'product', rating: 5, comment: '' });
  assert.equal(validateReview({ productId: 'product', rating: 4, comment: '  Tốt  ' }).comment, 'Tốt');
  for (const rating of [0, 6, 4.5, '5', null, NaN]) assert.throws(() => validateReview({ productId: 'product', rating }), (error) => error.code === 'VALIDATION_ERROR');
  for (const body of [null, [], {}, { productId: 'product', rating: 5, comment: {} }, { productId: 'product', rating: 5, comment: 'x'.repeat(2001) }]) assert.throws(() => validateReview(body));
});

test('only an owned completed purchase can create a review; supplied identity/visibility/order are ignored', async () => {
  const { service, state } = setup();
  const result = await service.create('buyer', { productId: 'product', rating: 5, comment: 'Hài lòng', userId: 'other', orderId: 'forged', isVisible: false, isVerifiedPurchase: false });
  assert.equal(result.review.userId, 'buyer');
  assert.equal(result.review.orderId, 'completed-order');
  assert.equal(result.review.isVerifiedPurchase, true);
  assert.equal(result.review.isVisible, true);
  assert.deepEqual(state.summary, { ratingAverage: 5, reviewCount: 1 });
});

test('non-buyers and uncompleted orders cannot create reviews or update product totals', async () => {
  for (const purchased of [true, false]) {
    const { service, state } = setup({ purchased });
    await assert.rejects(service.create(purchased ? 'other-user' : 'buyer', { productId: 'product', rating: 5 }), (error) => error.code === 'PURCHASE_REQUIRED');
    assert.equal(state.rows.length, 0);
    assert.equal(state.summary, null);
  }
});

test('each buyer has one verified review per product and duplicate writes are rejected', async () => {
  const { service, state } = setup();
  await service.create('buyer', { productId: 'product', rating: 3 });
  await assert.rejects(service.create('buyer', { productId: 'product', rating: 5 }), (error) => error.code === 'REVIEW_ALREADY_EXISTS');
  assert.equal(state.rows.length, 1);
});

test('a buyer can edit only their review and cannot change ownership, product or visibility', async () => {
  const { service, state } = setup();
  const first = await service.create('buyer', { productId: 'product', rating: 2 });
  await assert.rejects(service.update('other-user', first.review.id, { rating: 5 }), (error) => error.code === 'REVIEW_NOT_FOUND');
  state.rows[0].isVisible = false;
  const edited = await service.update('buyer', first.review.id, { rating: 4, comment: 'Cập nhật', userId: 'other', productId: 'different', isVisible: true });
  assert.equal(edited.review.productId, 'product');
  assert.equal(edited.review.userId, 'buyer');
  assert.equal(edited.review.isVisible, false);
  assert.deepEqual(edited.summary, { ratingAverage: 0, reviewCount: 0 });
});

test('rating totals include only visible reviews and editing does not increase the count', async () => {
  const { service, state } = setup();
  state.rows.push({ id: 'legacy', productId: 'product', userId: 'legacy-buyer', rating: 3, isVisible: true, isVerifiedPurchase: false });
  state.rows.push({ id: 'hidden', productId: 'product', rating: 1, isVisible: false });
  const result = await service.create('buyer', { productId: 'product', rating: 4 });
  assert.deepEqual(result.summary, { ratingAverage: 3.5, reviewCount: 2 });
  const updated = await service.update('buyer', result.review.id, { rating: 5 });
  assert.deepEqual(updated.summary, { ratingAverage: 4, reviewCount: 2 });
});

test('eligibility is scoped to the signed-in user and admits only completed purchases', async () => {
  const { service } = setup();
  assert.equal((await service.eligibility('buyer', 'product')).canReview, true);
  const outsider = await service.eligibility('other-user', 'product');
  assert.equal(outsider.canReview, false);
  assert.equal(outsider.review, null);
});

test('inactive/missing products and unverified legacy reviews cannot be edited', async () => {
  const inactive = setup({ active: false });
  await assert.rejects(inactive.service.create('buyer', { productId: 'product', rating: 5 }), (error) => error.code === 'PRODUCT_NOT_FOUND');
  await assert.rejects(inactive.service.eligibility('buyer', 'product'), (error) => error.code === 'PRODUCT_NOT_FOUND');
  const legacy = setup();
  legacy.state.rows.push({ id: 'legacy', productId: 'product', userId: 'buyer', isVerifiedPurchase: false });
  await assert.rejects(legacy.service.update('buyer', 'legacy', { rating: 5 }), (error) => error.code === 'REVIEW_NOT_FOUND');
});
