import { Router } from 'express';
import { authMiddleware, requireCustomer } from '../middlewares/authMiddleware.js';
import { asyncHandler } from '../utils/http.js';
import { reviewService } from '../services/reviewService.js';
import { createRateLimiter, invalidatePublicCatalogCache } from '../middlewares/trafficControl.js';

const router = Router();
router.use(authMiddleware, requireCustomer);
router.get('/eligibility', asyncHandler(async (req, res) => {
  res.json({ data: await reviewService.eligibility(req.user.id, req.query.productId) });
}));
const limit = createRateLimiter({ name: 'reviews', limit: 20, windowMs: 600000 });
router.post('/', limit, asyncHandler(async (req, res) => {
  const result = await reviewService.create(req.user.id, req.body);
  invalidatePublicCatalogCache();
  res.status(201).json({ data: result, message: 'Đã gửi đánh giá của bạn.' });
}));
router.patch('/:id', limit, asyncHandler(async (req, res) => {
  const result = await reviewService.update(req.user.id, req.params.id, req.body);
  invalidatePublicCatalogCache();
  res.json({ data: result, message: 'Đã cập nhật đánh giá của bạn.' });
}));
export default router;
