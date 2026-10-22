import { HttpError } from './http.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

export function validateRegisterBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu đăng ký không hợp lệ.');
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};

  if (!fullName || fullName.length > 100) {
    errors.fullName = 'Họ tên là bắt buộc và không được vượt quá 100 ký tự.';
  }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Email không hợp lệ.';
  }
  if (
    (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') ||
    phone.length > 20
  ) {
    errors.phone = 'Số điện thoại không được vượt quá 20 ký tự.';
  }
  if (password.length < 6 || Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự và không quá 72 byte.';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng kiểm tra lại thông tin đăng ký.', errors);
  }

  return { fullName, email, phone: phone || null, password };
}

export function validateLoginBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu đăng nhập không hợp lệ.');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (
    !email ||
    !EMAIL_PATTERN.test(email) ||
    !password ||
    Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES
  ) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Vui lòng nhập email và mật khẩu hợp lệ.');
  }

  return { email, password };
}
