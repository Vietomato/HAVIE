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

### Tài khoản Admin thử nghiệm (chỉ development)

Để thử giao diện quản trị mà không cần đăng ký OTP, cấu hình các biến sau trong `backend/.env`:

```env
NODE_ENV=development
MOCK_ADMIN_ENABLED=true
MOCK_ADMIN_EMAIL=admin.test@example.com
MOCK_ADMIN_PASSWORD=your-local-test-password
```

Khởi động lại backend. Trên trang đăng nhập ở frontend development, nhập email/mật khẩu đã cấu hình và chọn **ĐĂNG NHẬP ADMIN THỬ NGHIỆM**. Backend sẽ tạo tài khoản Admin local lần đầu nếu email chưa tồn tại. Không dùng chung email với tài khoản Customer hoặc tài khoản khác. Tính năng bị từ chối ngoài `NODE_ENV=development` và khi chưa bật rõ ràng bằng `MOCK_ADMIN_ENABLED=true`; không đưa thông tin mock vào Git.

## Database

Migration `prisma/migrations/20261021160000_email_otp_registration/migration.sql` chỉ thêm cột `emailVerifiedAt` vào users và bảng OTP. Với database cũ chưa được Prisma Migrate quản lý, hãy sao lưu database và chạy migration này đúng một lần từ thư mục `backend`:

```bash
npx prisma db execute --file prisma/migrations/20261021160000_email_otp_registration/migration.sql
npx prisma generate
```

Migration `20261031200000_product_visibility` thêm cột `isActive` để Admin có thể ẩn sản phẩm mà không xóa dữ liệu đơn hàng. Với database đã được Prisma Migrate quản lý, dùng `npx prisma migrate deploy`. Với database cũ chưa quản lý migration, hãy sao lưu trước, chạy file migration này đúng một lần bằng `npx prisma db execute --file prisma/migrations/20261031200000_product_visibility/migration.sql`, rồi chạy `npx prisma generate`.

Không chạy `prisma migrate reset` trên database có dữ liệu.

Để nạp danh mục, thương hiệu, sản phẩm và biến thể trong `prisma/productsData.json`, cấu hình `DATABASE_URL` trong `backend/.env`, sau đó chạy từ thư mục `backend`:

```bash
npm run prisma:generate
npm run prisma:seed
```

Seed có thể chạy lại để cập nhật sản phẩm theo slug và biến thể theo SKU.

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
- `GET /api/categories`, `GET /api/brands`, `GET /api/products`, `GET /api/products/:slug`
- `GET /api/products/:slug/reviews`
- `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`
- `POST /api/orders`, `GET /api/orders/my`, `POST /api/orders/:id/cancel`
- Admin (yêu cầu role `ADMIN`): `GET /api/admin/products`, `POST /api/admin/products`, `PATCH /api/admin/products/:id`, `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`
- Tư vấn (yêu cầu đăng nhập): `GET/POST /api/chat/conversations`, `GET/PATCH/DELETE /api/chat/conversations/:id`, `POST /api/chat/conversations/:id/messages`

OTP hết hạn sau 10 phút, gửi lại sau 60 giây và tối đa 5 lần nhập sai. Các route sản phẩm hỗ trợ bộ lọc và phân trang theo `API_CONTRACT_HAVIE_v1.md`.

Lịch sử tư vấn được lưu theo tài khoản trong PostgreSQL; mỗi tài khoản chỉ xem được hội thoại của mình. Tên ban đầu lấy từ tin nhắn đầu tiên, khách có thể đổi tên tối đa 60 ký tự; hội thoại đang xử lý chưa thể xóa. Chat mới tạo một cuộc trò chuyện riêng, nên lượt tư vấn đang xử lý không khóa các cuộc trò chuyện khác. Trước khi sử dụng, sao lưu database. Với database đã được Prisma Migrate quản lý, chạy `npx prisma migrate deploy` để áp dụng các migration còn thiếu; với database cũ chưa quản lý migration, cần sao lưu và chạy lần lượt các migration chưa áp dụng bằng `npx prisma db execute --file <đường-dẫn-migration.sql>`. Sau đó chạy `npm run prisma:generate`. Không chạy `prisma migrate reset` trên database có dữ liệu.

Chat tư vấn dùng Ollama local; model mặc định là `qwen3:8b` và cần xử lý trên phần cứng máy backend. Có thể đặt `OLLAMA_MODEL` sang model đã cài để thử tốc độ/chất lượng khác, và `OLLAMA_KEEP_ALIVE` (mặc định `15m`) để giữ model đã nạp, tránh nạp lại giữa các lượt chat. Bộ trích xuất dùng context 2048 và giới hạn tối đa 192 token đầu ra. Model nhỏ hơn không đảm bảo nhanh hơn hoặc giữ nguyên chất lượng trên CPU; muốn giảm đáng kể thời gian cần GPU phù hợp hoặc máy chạy model mạnh hơn.

Admin có thể thêm/cập nhật sản phẩm, biến thể, giá, tồn kho và ẩn sản phẩm khỏi catalog mà không xóa dữ liệu đơn cũ. Thay đổi tồn kho qua màn hình sản phẩm được ghi vào lịch sử kho.

Vòng đời đơn do Admin xử lý theo thứ tự `PENDING_CONFIRMATION → CONFIRMED → SHIPPING → COMPLETED`. Chỉ được hủy khi đơn còn `PENDING_CONFIRMATION` hoặc `CONFIRMED`; hủy bắt buộc có lý do và hoàn kho trong cùng transaction. Đơn đã giao/hoàn thành không thể hủy. Hoàn tất đơn COD đồng thời ghi nhận đã thu tiền.

Giỏ hàng, đặt hàng và xem/hủy đơn cá nhân yêu cầu tài khoản Customer; Admin không thể tạo đơn hoặc dùng lịch sử đơn hàng của khách qua API khách hàng. Khách xem tiến trình đơn tại tab “Đơn hàng của tôi”; trạng thái tự tải lại mỗi 30 giây khi đang mở tab và có nút cập nhật thủ công. API đặt hàng hiện chỉ hỗ trợ COD; thanh toán QR chưa được tích hợp.
