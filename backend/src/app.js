import express from 'express';
import cors from 'cors';
import authRoutes, { getCurrentUser } from './routes/authRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { authMiddleware } from './middlewares/authMiddleware.js';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HAVIE Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.get('/api/me', authMiddleware, getCurrentUser);
app.use('/api', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

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
