import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { createAccessToken, publicUserSelect } from '../middlewares/authMiddleware.js';
import { sendRegistrationOtp } from './emailService.js';
import { validateRegisterBody } from '../utils/authValidation.js';
import { HttpError } from '../utils/http.js';

export const OTP_TTL_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_HASH_SECRET_MIN_BYTES = 32;
const BCRYPT_ROUNDS = 12;

export function getOtpHashSecret() {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < OTP_HASH_SECRET_MIN_BYTES) {
    throw new HttpError(
      500,
      'SERVER_MISCONFIGURED',
      'OTP_HASH_SECRET phải được cấu hình bằng chuỗi bí mật có ít nhất 32 byte.',
    );
  }
  return secret;
}

export function createOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(email, code, secret = getOtpHashSecret()) {
  return createHmac('sha256', secret)
    .update(`${email.toLowerCase()}:${code}`)
    .digest('hex');
}

export function isOtpMatch(email, code, expectedHash, secret = getOtpHashSecret()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code) || typeof expectedHash !== 'string') {
    return false;
  }
  const actual = Buffer.from(hashOtp(email, code, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function normalizeAdminAllowlist() {
  return new Set(
    (process.env.ADMIN_EMAIL_ALLOWLIST || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function toPublicUser(user) {
  return Object.fromEntries(
    Object.keys(publicUserSelect).map((key) => [key, user[key]]),
  );
}

export function createRegistrationService({
  database = prisma,
  sendOtp = sendRegistrationOtp,
  hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS),
  clock = () => new Date(),
  otpFactory = createOtpCode,
} = {}) {
  return {
    async requestOtp(payload) {
      const input = validateRegisterBody(payload);
      getOtpHashSecret();

      if (await database.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
        throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng.');
      }

      const now = clock();
      await database.emailVerificationChallenge.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      const existing = await database.emailVerificationChallenge.findUnique({
        where: { email: input.email },
      });
      if (existing && now.getTime() - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        const retryAfter = Math.ceil(
          (OTP_RESEND_COOLDOWN_SECONDS * 1000 - (now.getTime() - existing.lastSentAt.getTime())) /
            1000,
        );
        throw new HttpError(
          429,
          'OTP_RATE_LIMITED',
          'Vui lòng chờ trước khi yêu cầu gửi lại mã.',
          { retryAfterSeconds: retryAfter },
        );
      }

      const otp = otpFactory();
      const [passwordHash] = await Promise.all([
        hashPassword(input.password),
        Promise.resolve(getOtpHashSecret()),
      ]);
      const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);
      const challenge = await database.emailVerificationChallenge.upsert({
        where: { email: input.email },
        create: {
          email: input.email,
          fullName: input.fullName,
          phone: input.phone,
          passwordHash,
          otpHash: hashOtp(input.email, otp),
          expiresAt,
          attempts: 0,
          lastSentAt: now,
        },
        update: {
          fullName: input.fullName,
          phone: input.phone,
          passwordHash,
          otpHash: hashOtp(input.email, otp),
          expiresAt,
          attempts: 0,
          lastSentAt: now,
        },
        select: { id: true },
      });

      try {
        await sendOtp({
          email: input.email,
          code: otp,
          expiresInMinutes: OTP_TTL_MINUTES,
        });
      } catch (error) {
        await database.emailVerificationChallenge.deleteMany({ where: { id: challenge.id } });
        throw error;
      }

      return {
        message: 'Mã xác minh đã được gửi. Vui lòng kiểm tra email của bạn.',
        expiresIn: OTP_TTL_MINUTES * 60,
        resendAfter: OTP_RESEND_COOLDOWN_SECONDS,
      };
    },

    async verifyOtp({ email: rawEmail, code }) {
      const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
      if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Email hoặc mã xác minh không hợp lệ.');
      }
      getOtpHashSecret();

      const challenge = await database.emailVerificationChallenge.findUnique({
        where: { email },
      });
      if (!challenge) {
        throw new HttpError(400, 'OTP_INVALID_OR_EXPIRED', 'Mã xác minh không hợp lệ hoặc đã hết hạn.');
      }

      const now = clock();
      if (challenge.expiresAt <= now) {
        await database.emailVerificationChallenge.deleteMany({ where: { id: challenge.id } });
        throw new HttpError(400, 'OTP_INVALID_OR_EXPIRED', 'Mã xác minh không hợp lệ hoặc đã hết hạn.');
      }

      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        await database.emailVerificationChallenge.deleteMany({ where: { id: challenge.id } });
        throw new HttpError(
          429,
          'OTP_ATTEMPTS_EXCEEDED',
          'Bạn đã nhập sai mã quá số lần cho phép. Vui lòng yêu cầu mã mới.',
        );
      }

      if (!isOtpMatch(email, code, challenge.otpHash)) {
        const result = await database.emailVerificationChallenge.updateMany({
          where: { id: challenge.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
          data: { attempts: { increment: 1 } },
        });
        if (!result.count) {
          throw new HttpError(
            429,
            'OTP_ATTEMPTS_EXCEEDED',
            'Bạn đã nhập sai mã quá số lần cho phép. Vui lòng yêu cầu mã mới.',
          );
        }
        throw new HttpError(400, 'OTP_INVALID', 'Mã xác minh không chính xác.');
      }

      if (await database.user.findUnique({ where: { email }, select: { id: true } })) {
        await database.emailVerificationChallenge.deleteMany({ where: { id: challenge.id } });
        throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng.');
      }

      const role = normalizeAdminAllowlist().has(email) ? 'ADMIN' : 'CUSTOMER';
      let user;
      try {
        user = await database.$transaction(async (transaction) => {
          const created = await transaction.user.create({
            data: {
              email,
              fullName: challenge.fullName,
              phone: challenge.phone,
              passwordHash: challenge.passwordHash,
              role,
              emailVerifiedAt: now,
            },
            select: publicUserSelect,
          });
          await transaction.emailVerificationChallenge.delete({
            where: { id: challenge.id },
          });
          return created;
        });
      } catch (error) {
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
          throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được sử dụng.');
        }
        throw error;
      }

      const { accessToken, expiresIn } = await createAccessToken(user);
      return {
        data: {
          user: toPublicUser(user),
          accessToken,
          expiresIn,
        },
        message: 'Xác minh email và tạo tài khoản thành công.',
      };
    },
  };
}

const registrationService = createRegistrationService();
export const requestRegistrationOtp = registrationService.requestOtp;
export const verifyRegistrationOtp = registrationService.verifyOtp;
