import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { sendPasswordResetOtp } from './emailService.js';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  createOtpCode,
  getOtpHashSecret,
  hashOtp,
  isOtpMatch,
} from './registrationService.js';
import { validateNewPassword } from '../utils/authValidation.js';
import { HttpError } from '../utils/http.js';

const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const invalidCode = () =>
  new HttpError(400, 'OTP_INVALID_OR_EXPIRED', 'Mã xác minh không hợp lệ hoặc đã hết hạn.');

export function createPasswordResetService({
  database = prisma,
  sendOtp = sendPasswordResetOtp,
  hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS),
  clock = () => new Date(),
  otpFactory = createOtpCode,
} = {}) {
  return {
    // The response is identical whether or not the email has an account, so this
    // endpoint cannot be used to discover which emails are registered.
    async requestReset({ email: rawEmail } = {}) {
      const email = normalizeEmail(rawEmail);
      if (!EMAIL_PATTERN.test(email)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng nhập địa chỉ email hợp lệ.');
      }
      getOtpHashSecret();

      const response = {
        message: 'Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.',
        expiresIn: OTP_TTL_MINUTES * 60,
        resendAfter: OTP_RESEND_COOLDOWN_SECONDS,
      };

      const user = await database.user.findUnique({
        where: { email },
        select: { id: true, isActive: true },
      });
      if (!user || !user.isActive) return response;

      const now = clock();
      await database.passwordResetChallenge.deleteMany({ where: { expiresAt: { lte: now } } });
      const existing = await database.passwordResetChallenge.findUnique({ where: { email } });
      if (
        existing &&
        now.getTime() - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000
      ) {
        return response;
      }

      const otp = otpFactory();
      const otpHash = hashOtp(email, otp);
      const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);
      const challenge = await database.passwordResetChallenge.upsert({
        where: { email },
        create: { email, otpHash, expiresAt, attempts: 0, lastSentAt: now },
        update: { otpHash, expiresAt, attempts: 0, lastSentAt: now },
        select: { id: true },
      });

      try {
        await sendOtp({ email, code: otp, expiresInMinutes: OTP_TTL_MINUTES });
      } catch (error) {
        await database.passwordResetChallenge.deleteMany({ where: { id: challenge.id } });
        throw error;
      }

      return response;
    },

    async resetPassword({ email: rawEmail, code, newPassword } = {}) {
      const email = normalizeEmail(rawEmail);
      if (!email || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Email hoặc mã xác minh không hợp lệ.');
      }
      const password = validateNewPassword(newPassword);
      getOtpHashSecret();

      const challenge = await database.passwordResetChallenge.findUnique({ where: { email } });
      if (!challenge) throw invalidCode();

      const now = clock();
      if (challenge.expiresAt <= now) {
        await database.passwordResetChallenge.deleteMany({ where: { id: challenge.id } });
        throw invalidCode();
      }

      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        await database.passwordResetChallenge.deleteMany({ where: { id: challenge.id } });
        throw new HttpError(
          429,
          'OTP_ATTEMPTS_EXCEEDED',
          'Bạn đã nhập sai mã quá số lần cho phép. Vui lòng yêu cầu mã mới.',
        );
      }

      if (!isOtpMatch(email, code, challenge.otpHash)) {
        const result = await database.passwordResetChallenge.updateMany({
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

      const user = await database.user.findUnique({
        where: { email },
        select: { id: true, isActive: true },
      });
      if (!user || !user.isActive) {
        await database.passwordResetChallenge.deleteMany({ where: { id: challenge.id } });
        throw invalidCode();
      }

      const passwordHash = await hashPassword(password);
      await database.$transaction(async (transaction) => {
        await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
        await transaction.passwordResetChallenge.delete({ where: { id: challenge.id } });
      });

      return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
    },
  };
}

const passwordResetService = createPasswordResetService();
export const requestPasswordReset = passwordResetService.requestReset;
export const resetPassword = passwordResetService.resetPassword;
