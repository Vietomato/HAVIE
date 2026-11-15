import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { readCookie, sessionCookie, sessions } from '../services/sessionService.js';

export const publicUserSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
};

export function getJwtConfiguration() {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || secret === 'your-super-secret-jwt-key') {
    throw new HttpError(
      500,
      'SERVER_MISCONFIGURED',
      'JWT_SECRET phải được cấu hình bằng chuỗi bí mật có ít nhất 32 byte.',
    );
  }

  const configuredExpiry = process.env.JWT_EXPIRES_IN || '1h';
  const expiryMatch = configuredExpiry.match(/^(\d+)(s|m|h|d)?$/);
  if (!expiryMatch) {
    throw new HttpError(500, 'SERVER_MISCONFIGURED', 'JWT_EXPIRES_IN không hợp lệ.');
  }

  const amount = Number(expiryMatch[1]);
  const unit = expiryMatch[2] || 's';
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  const expiresIn = amount * multiplier;

  if (!Number.isSafeInteger(expiresIn) || expiresIn < 1) {
    throw new HttpError(500, 'SERVER_MISCONFIGURED', 'JWT_EXPIRES_IN không hợp lệ.');
  }

  return { secret, expiresIn };
}

export async function createAccessToken(user) {
  const { secret, expiresIn } = getJwtConfiguration();
  return {
    accessToken: jwt.sign({ sub: user.id }, secret, {
      algorithm: 'HS256',
      expiresIn,
    }),
    expiresIn,
  };
}

export const authMiddleware = asyncHandler(async (req, res, next) => {
  const token = readCookie(req, sessionCookie());
  let session;
  try {
    session = await sessions.read(token, req.get('X-Havie-Activity') === '1');
  } catch { throw new HttpError(503, 'SESSION_UNAVAILABLE', 'Tạm thời chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại.'); }
  if (!session) throw new HttpError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ...publicUserSelect, authVersion: true },
  });

  if (!user) {
    throw new HttpError(401, 'INVALID_TOKEN', 'Tài khoản trong token không tồn tại.');
  }
  if (!user.isActive) {
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị tạm khóa.');
  }
  if (user.authVersion !== session.authVersion) throw new HttpError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const { authVersion, ...safeUser } = user;
  req.user = safeUser;
  req.sessionToken = token;
  res.set('Cache-Control', 'no-store');
  next();
});

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return next(new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền quản trị.'));
  }

  next();
}

export function requireCustomer(req, res, next) {
  if (req.user?.role !== 'CUSTOMER') {
    return next(new HttpError(403, 'FORBIDDEN', 'Chỉ khách hàng mới có thể đặt hàng.'));
  }

  next();
}
