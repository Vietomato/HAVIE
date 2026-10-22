import nodemailer from 'nodemailer';
import { HttpError } from '../utils/http.js';

let transporter;

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(500, 'SERVER_MISCONFIGURED', 'SMTP_PORT không hợp lệ.');
  }
  if (!user || !password) {
    throw new HttpError(
      503,
      'EMAIL_SERVICE_UNAVAILABLE',
      'Chưa cấu hình Gmail SMTP_USER và SMTP_PASS cho dịch vụ xác thực email.',
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
  }

  return transporter;
}

export async function sendRegistrationOtp({ email, code, expiresInMinutes }) {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await mailer.sendMail({
      from,
      to: email,
      subject: 'Mã xác minh tài khoản HAVIE',
      text: `Mã xác minh HAVIE của bạn là ${code}. Mã có hiệu lực trong ${expiresInMinutes} phút. Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.`,
      html: `<p>Mã xác minh tài khoản HAVIE của bạn:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong ${expiresInMinutes} phút.</p><p>Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>`,
    });
  } catch (error) {
    console.error('Gmail OTP delivery failed:', error.message);
    throw new HttpError(
      503,
      'EMAIL_DELIVERY_FAILED',
      'Không gửi được email xác minh. Vui lòng thử lại sau.',
    );
  }
}
