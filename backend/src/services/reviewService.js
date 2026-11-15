import prisma from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

const ownReviewSelect = { id: true, productId: true, rating: true, comment: true, isVisible: true, createdAt: true, updatedAt: true };

export function validateReview(body, { requireProduct = true } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', 'Nội dung đánh giá không hợp lệ.');
  if (requireProduct && (typeof body.productId !== 'string' || !body.productId.trim() || body.productId.length > 120)) throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng chọn sản phẩm cần đánh giá.');
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng chọn từ 1 đến 5 sao.');
  const comment = body.comment ?? '';
  if (typeof comment !== 'string' || comment.length > 2000) throw new HttpError(400, 'VALIDATION_ERROR', 'Nhận xét chỉ được dài tối đa 2.000 ký tự.');
  return { ...(requireProduct ? { productId: body.productId.trim() } : {}), rating: body.rating, comment: comment.trim() };
}

async function completedPurchase(database, userId, productId) {
  return database.order.findFirst({
    where: { userId, status: 'COMPLETED', items: { some: { variant: { productId } } } },
    select: { id: true }, orderBy: { createdAt: 'desc' },
  });
}

async function updateSummary(transaction, productId) {
  const aggregate = await transaction.review.aggregate({ where: { productId, isVisible: true }, _avg: { rating: true }, _count: { _all: true } });
  const summary = { ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 10) / 10, reviewCount: aggregate._count._all };
  await transaction.product.update({ where: { id: productId }, data: summary });
  return summary;
}

// Serialize writes per product so concurrent reviews cannot lose rating/count updates.
async function lockProduct(transaction, productId) {
  const products = await transaction.$queryRaw`SELECT "id", "isActive" FROM "products" WHERE "id" = ${productId} FOR UPDATE`;
  if (!products[0]?.isActive) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm đang bán.');
}

export function createReviewService({ database = prisma } = {}) {
  return {
    async eligibility(userId, productId) {
      if (typeof productId !== 'string' || !productId.trim() || productId.length > 120) throw new HttpError(400, 'VALIDATION_ERROR', 'Sản phẩm không hợp lệ.');
      const product = await database.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });
      if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');
      const order = await completedPurchase(database, userId, productId);
      const review = await database.review.findFirst({ where: { userId, productId, isVerifiedPurchase: true }, select: ownReviewSelect });
      return { canReview: Boolean(order), review, message: order ? null : 'Bạn có thể đánh giá sau khi đơn hàng có sản phẩm này đã hoàn thành.' };
    },
    async create(userId, body) {
      const input = validateReview(body);
      try {
        return await database.$transaction(async (tx) => {
          await lockProduct(tx, input.productId);
          const order = await completedPurchase(tx, userId, input.productId);
          if (!order) throw new HttpError(403, 'PURCHASE_REQUIRED', 'Chỉ khách đã mua sản phẩm trong đơn hoàn thành mới có thể đánh giá.');
          if (await tx.review.findFirst({ where: { userId, productId: input.productId, isVerifiedPurchase: true }, select: { id: true } })) throw new HttpError(409, 'REVIEW_ALREADY_EXISTS', 'Bạn đã đánh giá sản phẩm này. Hãy sửa đánh giá hiện tại.');
          const review = await tx.review.create({ data: { ...input, userId, orderId: order.id, isVerifiedPurchase: true, isVisible: true }, select: ownReviewSelect });
          return { review, summary: await updateSummary(tx, input.productId) };
        });
      } catch (error) {
        if (error.code === 'P2002') throw new HttpError(409, 'REVIEW_ALREADY_EXISTS', 'Bạn đã đánh giá sản phẩm này. Hãy sửa đánh giá hiện tại.');
        throw error;
      }
    },
    async update(userId, reviewId, body) {
      const input = validateReview(body, { requireProduct: false });
      return database.$transaction(async (tx) => {
        const existing = await tx.review.findFirst({ where: { id: reviewId, userId, isVerifiedPurchase: true }, select: { id: true, productId: true } });
        if (!existing) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá của bạn.');
        await lockProduct(tx, existing.productId);
        if (!await completedPurchase(tx, userId, existing.productId)) throw new HttpError(403, 'PURCHASE_REQUIRED', 'Đơn hàng chưa đủ điều kiện để sửa đánh giá.');
        const review = await tx.review.update({ where: { id: existing.id }, data: input, select: ownReviewSelect });
        return { review, summary: await updateSummary(tx, existing.productId) };
      });
    },
  };
}
export const reviewService = createReviewService();
