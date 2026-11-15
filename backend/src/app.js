import express from 'express';
import cors from 'cors';
import authRoutes, { getCurrentUser } from './routes/authRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { authMiddleware } from './middlewares/authMiddleware.js';
import chatRoutes from './routes/chatRoutes.js';
import voucherRoutes from './routes/voucherRoutes.js';
import { UPLOADS_DIR } from './services/imageStorage.js';
import { allowedOrigins, csrfProtection, createRateLimiter, publicCatalogCache } from './middlewares/trafficControl.js';
import socialAuthRoutes from './routes/socialAuthRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins().includes(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(csrfProtection);
app.use('/api/auth', createRateLimiter({ name: 'auth', limit: 60, windowMs: 600000 }));
app.use(publicCatalogCache);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HAVIE Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/chat', chatRoutes);
app.use('/uploads', express.static(UPLOADS_DIR, {
  index: false,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));

app.use('/api/auth', authRoutes);
app.use('/api/auth', socialAuthRoutes);
app.get('/api/me', authMiddleware, getCurrentUser);
app.use('/api', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Đường dẫn ${req.originalUrl} không tồn tại trên hệ thống.`,
    },
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code || (err.type === 'entity.parse.failed' ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR'),
      message:
        err.type === 'entity.parse.failed'
          ? 'Nội dung JSON không hợp lệ.'
          : err.status
            ? err.message
            : 'Lỗi hệ thống máy chủ',
      details: err.details || {},
    },
  });
});

export default app;
