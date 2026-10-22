# HAVIE Backend Service

Backend API cho cửa hàng cầu lông HAVIE, tuân thủ đặc tả tại `API_CONTRACT_HAVIE_v1.md`.

## Cài đặt và cấu hình

```bash
cd backend
npm install
cp .env.example .env
```

Điền `DATABASE_URL` tới PostgreSQL và thay `JWT_SECRET` cùng `OTP_HASH_SECRET` bằng hai secret riêng biệt, ngẫu nhiên, tối thiểu 32 byte. Có thể tạo mỗi secret bằng PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Chỉ lưu secret trong `backend/.env`; không gửi qua chat hay commit lên Git.

Để gửi OTP, bật xác minh 2 bước trên tài khoản Gmail gửi thư, tạo **Google App Password**, rồi cấu hình:

- `SMTP_USER`: địa chỉ Gmail gửi thư.
- `SMTP_PASS`: Google App Password (không phải mật khẩu Gmail thông thường).
- `SMTP_FROM`: tùy chọn; mặc định dùng `SMTP_USER`.
- `ADMIN_EMAIL_ALLOWLIST`: email được cấp role Admin sau khi xác minh, phân cách bằng dấu phẩy. Email ngoài danh sách chỉ được tạo tài khoản Customer.

## Database

Migration `prisma/migrations/20261021160000_email_otp_registration/migration.sql` chỉ thêm cột `emailVerifiedAt` vào users và bảng OTP. Với database cũ chưa được Prisma Migrate quản lý, hãy sao lưu database và chạy migration này đúng một lần từ thư mục `backend`:

```bash
npx prisma db execute --file prisma/migrations/20261021160000_email_otp_registration/migration.sql
npx prisma generate
```

Không chạy `prisma migrate reset` trên database có dữ liệu.

## Khởi chạy và kiểm thử

```bash
npm run dev
npm test
```

Backend mặc định chạy tại `http://localhost:3000`; kiểm tra `http://localhost:3000/api/health`. Frontend Vite proxy `/api` qua backend.

## API

- `POST /api/auth/register/request-otp`: gửi mã 6 chữ số qua Gmail.
- `POST /api/auth/register/verify-otp`: xác minh mã, tạo tài khoản và trả JWT.
- `POST /api/auth/register`: trả `410 EMAIL_VERIFICATION_REQUIRED`; không thể bỏ qua xác minh email.
- `POST /api/auth/login`
- `GET /api/auth/me`, `GET /api/me`
- `POST /api/auth/logout`
- `GET /api/categories`, `GET /api/products`, `GET /api/products/:slug`
- `GET /api/products/:slug/reviews`

OTP hết hạn sau 10 phút, gửi lại sau 60 giây và tối đa 5 lần nhập sai. Các route sản phẩm hỗ trợ bộ lọc và phân trang theo `API_CONTRACT_HAVIE_v1.md`.
