import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';

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
  const authorization = req.get('Authorization');
  const tokenMatch = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!tokenMatch) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
  }

  const { secret } = getJwtConfiguration();
  let payload;
  try {
    payload = jwt.verify(tokenMatch[1], secret, { algorithms: ['HS256'] });
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError;
    throw new HttpError(
      401,
      expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      expired ? 'Phiên đăng nhập đã hết hạn.' : 'Token đăng nhập không hợp lệ.',
    );
  }

  if (!payload || typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new HttpError(401, 'INVALID_TOKEN', 'Token đăng nhập không hợp lệ.');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: publicUserSelect,
  });

  if (!user) {
    throw new HttpError(401, 'INVALID_TOKEN', 'Tài khoản trong token không tồn tại.');
  }
  if (!user.isActive) {
    throw new HttpError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị tạm khóa.');
  }

  req.user = user;
  next();
});
