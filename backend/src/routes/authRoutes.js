import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import {
  authMiddleware,
  createAccessToken,
  getJwtConfiguration,
  publicUserSelect,
} from '../middlewares/authMiddleware.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { validateLoginBody } from '../utils/authValidation.js';
import { requestRegistrationOtp, verifyRegistrationOtp } from '../services/registrationService.js';

const router = Router();

router.post('/register', (req, res) => {
  res.status(410).json({
    error: {
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Đăng ký mới cần xác minh email. Hãy yêu cầu OTP trước.',
      details: { requestOtpEndpoint: '/api/auth/register/request-otp' },
    },
  });
});

router.post(
  '/register/request-otp',
  asyncHandler(async (req, res) => {
    getJwtConfiguration();
    const result = await requestRegistrationOtp(req.body);
    res.status(200).json({ data: result, message: result.message });
  }),
);

router.post(
  '/register/verify-otp',
  asyncHandler(async (req, res) => {
    getJwtConfiguration();
    const result = await verifyRegistrationOtp(req.body || {});
    res.status(201).json(result);
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    getJwtConfiguration();
    const input = validateLoginBody(req.body);
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    const passwordMatches = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không chính xác.');
    }
    if (!user.isActive) {
      throw new HttpError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị tạm khóa.');
    }

    const { passwordHash, ...safeUser } = user;
    const { accessToken, expiresIn } = await createAccessToken(safeUser);
    res.json({
      data: { user: safeUser, accessToken, expiresIn },
      message: 'Đăng nhập thành công.',
    });
  }),
);

export const getCurrentUser = (req, res) => {
  res.json({ data: req.user, message: 'Lấy thông tin tài khoản thành công.' });
};

router.get('/me', authMiddleware, getCurrentUser);

router.post(
  '/logout',
  authMiddleware,
  (req, res) => res.json({ message: 'Đăng xuất thành công.' }),
);

export default router;
