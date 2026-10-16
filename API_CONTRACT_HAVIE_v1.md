x# HAVIE — API Contract v1

**Trạng thái:** Bản nháp để nhóm thống nhất trước khi triển khai  
**Base URL:** `/api`  
**Định dạng:** JSON, UTF-8  
**CSDL tham chiếu:** PostgreSQL + Prisma, theo `schema.prisma` HAVIE hiện tại

> Contract này thiết kế cho website bán hàng một kho. API là nguồn dữ liệu chính; frontend không tự quyết định giá, tồn kho, quyền truy cập hoặc trạng thái đơn.

## 1. Quy ước chung

### Xác thực và phân quyền

- API công khai không cần đăng nhập: xem danh mục, sản phẩm và đánh giá đang hiển thị.
- API Customer yêu cầu `Authorization: Bearer <accessToken>`.
- API Admin yêu cầu token hợp lệ và `role = ADMIN`.
- Backend lấy `userId` từ token; không nhận `userId` do frontend gửi để xác định chủ sở hữu giỏ hàng, địa chỉ hoặc đơn hàng.
- Không trả `passwordHash` trong bất kỳ response nào. Customer không được tự đăng ký hoặc sửa vai trò thành Admin.

### Response thành công

```json
{
  "data": {},
  "message": "Thành công"
}
```

Danh sách có phân trang:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
}
```

### Response lỗi

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Số lượng tồn kho không đủ.",
    "details": { "available": 1 }
  }
}
```

| HTTP | Dùng cho |
|---|---|
| `400` | Request sai định dạng hoặc vi phạm kiểm tra dữ liệu |
| `401` | Chưa đăng nhập hoặc token không hợp lệ |
| `403` | Đã đăng nhập nhưng không đủ quyền |
| `404` | Không tìm thấy tài nguyên hoặc tài nguyên không thuộc quyền xem |
| `409` | Xung đột trạng thái, SKU/email trùng hoặc tồn kho không đủ |
| `422` | Dữ liệu đúng định dạng nhưng không hợp lệ theo nghiệp vụ |
| `500` | Lỗi không dự kiến ở server |

### Kiểu dữ liệu

- ID là UUID dạng chuỗi.
- Tiền là số nguyên VND, ví dụ `1290000`; không gửi số thực.
- Thời gian là ISO-8601 theo UTC; frontend hiển thị theo giờ Việt Nam.
- Các trường JSON dùng `camelCase`.

## 2. Enum thống nhất

### Vai trò

`CUSTOMER`, `ADMIN`

### Trạng thái đơn hàng

`PENDING_PAYMENT`, `PENDING_CONFIRMATION`, `CONFIRMED`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `REFUND_PENDING`

| Mã API | Nhãn hiển thị |
|---|---|
| `PENDING_PAYMENT` | Chờ thanh toán |
| `PENDING_CONFIRMATION` | Chờ xác nhận |
| `CONFIRMED` | Đã xác nhận |
| `SHIPPING` | Đang giao |
| `COMPLETED` | Hoàn thành |
| `CANCELLED` | Đã hủy |
| `REFUND_PENDING` | Chờ hoàn tiền |

### Thanh toán

- `PaymentMethod`: `COD`, `MOCK_QR`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `REFUNDED`

## 3. Customer API

### 3.1 Tài khoản

#### `POST /api/auth/register` — công khai

Request:

```json
{
  "fullName": "Nguyễn Hoàng Việt",
  "email": "viet@example.com",
  "phone": "0900000000",
  "password": "MatKhau123!"
}
```

Response `201`:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "Nguyễn Hoàng Việt",
      "email": "viet@example.com",
      "phone": "0900000000",
      "role": "CUSTOMER"
    },
    "accessToken": "jwt",
    "expiresIn": 3600
  }
}
```

Lỗi chính: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`.

#### `POST /api/auth/login` — công khai

Request: `{ "email": "viet@example.com", "password": "MatKhau123!" }`  
Response: cùng cấu trúc token và `user` như đăng ký. Sai thông tin trả `401 INVALID_CREDENTIALS`; tài khoản bị khóa trả `403 ACCOUNT_DISABLED`.

#### `POST /api/auth/logout` — đã đăng nhập

Thu hồi refresh token/session nếu nhóm triển khai cơ chế đó. Nếu chỉ dùng access token ngắn hạn, frontend xóa token ở client; logout phía client không thay thế việc đặt thời hạn token.

#### `GET /api/me` — Customer hoặc Admin

Trả hồ sơ hiện tại: `id`, `fullName`, `email`, `phone`, `role`, `isActive`. Không trả hash mật khẩu.

#### `PATCH /api/me` — chủ tài khoản

Cho sửa `fullName`, `phone`; không cho sửa `role`, `isActive` hoặc email đăng nhập trong phiên bản này.

### 3.2 Địa chỉ giao hàng

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/me/addresses` | Lấy địa chỉ của Customer hiện tại |
| `POST` | `/api/me/addresses` | Thêm địa chỉ |
| `PATCH` | `/api/me/addresses/:id` | Sửa địa chỉ thuộc tài khoản hiện tại |
| `DELETE` | `/api/me/addresses/:id` | Xóa địa chỉ thuộc tài khoản hiện tại |

Request tạo/sửa:

```json
{
  "recipientName": "Nguyễn Hoàng Việt",
  "phone": "0900000000",
  "province": "TP. Hồ Chí Minh",
  "district": "Gò Vấp",
  "ward": "Phường 4",
  "streetAddress": "12 Nguyễn Văn Bảo",
  "isDefault": true
}
```

Địa chỉ của người khác trả `404`, kể cả khi đoán được ID.

### 3.3 Danh mục và sản phẩm

#### `GET /api/categories` — công khai

Trả danh mục đang hoạt động; có thể gồm `id`, `name`, `slug`, `parentId`.

#### `GET /api/brands` — công khai

Trả thương hiệu đang hoạt động.

#### `GET /api/products` — công khai

Query parameters:

| Tham số | Ví dụ | Ý nghĩa |
|---|---|---|
| `q` | `attack` | Tìm theo tên sản phẩm |
| `category` | UUID hoặc slug | Lọc danh mục |
| `brand` | UUID hoặc slug | Lọc thương hiệu |
| `minPrice`, `maxPrice` | `500000`, `2000000` | Khoảng giá |
| `inStock` | `true` | Chỉ sản phẩm còn biến thể có hàng |
| `attribute.weight` | `4U` | Lọc thuộc tính biến thể nếu có |
| `sort` | `price_asc` | `featured`, `price_asc`, `price_desc`, `rating_desc`, `newest` |
| `page`, `pageSize` | `1`, `20` | Phân trang; mặc định 1 và 20 |

Response mẫu:

```json
{
  "data": [
    {
      "id": "product-uuid",
      "name": "HAVIE Attack Pro",
      "slug": "havie-attack-pro",
      "description": "Mô tả sản phẩm",
      "category": { "id": "category-uuid", "name": "Vợt cầu lông" },
      "brand": { "id": "brand-uuid", "name": "HAVIE" },
      "imageUrls": ["/images/attack-pro-1.jpg"],
      "ratingAverage": 4.8,
      "reviewCount": 12,
      "variants": [
        {
          "id": "variant-uuid",
          "sku": "HAP-4U-G5",
          "name": "4U / G5",
          "attributes": { "weight": "4U", "grip": "G5" },
          "price": 1290000,
          "stockQuantity": 8,
          "isAvailable": true
        }
      ]
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

#### `GET /api/products/:slug` — công khai

Trả chi tiết một sản phẩm cùng biến thể đang hoạt động. Sản phẩm ẩn/ngừng bán không xuất hiện trong danh sách công khai.

#### `GET /api/products/:slug/reviews` — công khai

Chỉ trả review có `isVisible = true`; hỗ trợ `page` và `pageSize`.

### 3.4 Giỏ hàng

#### `GET /api/cart` — Customer đã đăng nhập

Trả giỏ của người từ token, gồm `variantId`, thông tin sản phẩm/biến thể, giá hiện tại, tồn kho và số lượng. Giỏ rỗng trả `items: []`.

#### `POST /api/cart/items` — Customer đã đăng nhập

Request:

```json
{ "variantId": "variant-uuid", "quantity": 2 }
```

Nếu biến thể đã có trong giỏ, cộng số lượng vào dòng hiện có. Từ chối biến thể ngừng bán, số lượng không dương hoặc số lượng vượt tồn khả dụng (`409 INSUFFICIENT_STOCK`). Giá và tồn kho lấy từ database, không lấy từ request.

#### `PATCH /api/cart/items/:id` — chủ giỏ

Request: `{ "quantity": 3 }`. Chỉ sửa item thuộc giỏ của người đăng nhập.

#### `DELETE /api/cart/items/:id` — chủ giỏ

Xóa item thuộc giỏ của người đăng nhập.

### 3.5 Đặt hàng và thanh toán

#### `POST /api/orders` — Customer đã đăng nhập

Request dùng địa chỉ đã lưu hoặc nhập địa chỉ mới. Mọi trường người nhận và địa chỉ cần thiết đều bắt buộc khi checkout.

```json
{
  "addressId": "address-uuid",
  "recipientName": "Nguyễn Hoàng Việt",
  "recipientPhone": "0900000000",
  "shippingAddress": {
    "province": "TP. Hồ Chí Minh",
    "district": "Gò Vấp",
    "ward": "Phường 4",
    "streetAddress": "12 Nguyễn Văn Bảo"
  },
  "paymentMethod": "COD",
  "customerNote": "Gọi trước khi giao"
}
```

Chỉ gửi `addressId` hoặc bộ địa chỉ mới; nếu gửi cả hai, server trả `400`. Không gửi `userId`, `items`, `unitPrice`, `subtotal`, `shippingFee` hoặc `totalAmount`; server lấy giỏ, kiểm tra tồn và tự tính tiền.

Response COD `201`:

```json
{
  "data": {
    "id": "order-uuid",
    "orderCode": "HV-20261016-0001",
    "status": "PENDING_CONFIRMATION",
    "paymentMethod": "COD",
    "paymentStatus": "PENDING",
    "subtotal": 2580000,
    "shippingFee": 30000,
    "discountAmount": 0,
    "totalAmount": 2610000,
    "items": [],
    "recipientName": "Nguyễn Hoàng Việt",
    "recipientPhone": "0900000000",
    "shippingAddress": "12 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh"
  }
}
```

Với `MOCK_QR`, đơn bắt đầu `PENDING_PAYMENT`; response có thêm `payment: { id, amount, qrData, expiresAt }`. Thanh toán QR là mô phỏng, không kết nối ngân hàng thật.

**Quy tắc transaction:** tạo đơn, chụp tên/SKU/giá vào `OrderItem`, kiểm tra và trừ tồn, ghi `StockMovement`, tạo `Payment` và xóa giỏ phải nhất quán trong transaction. Nếu bất kỳ phần nào lỗi thì rollback. Khi QR thất bại/hết hạn hoặc đơn bị hủy, hoàn tồn đúng một lần.

#### `GET /api/orders/my` — Customer đã đăng nhập

Trả các đơn của người từ token, mới nhất trước; có lọc `status`, `page`, `pageSize`.

#### `GET /api/orders/:id` — chủ đơn hoặc Admin

Customer chỉ xem đơn của mình. Admin xem mọi đơn qua route quản trị. Không tìm thấy hoặc không thuộc quyền xem trả `404`.

#### `POST /api/orders/:id/cancel` — chủ đơn

Request: `{ "reason": "Đặt nhầm sản phẩm" }`. Cho hủy khi đơn chưa ở trạng thái `SHIPPING`, `COMPLETED` hoặc `CANCELLED`. Đơn đã thanh toán chuyển sang `REFUND_PENDING`; đơn chưa thanh toán chuyển sang `CANCELLED`. Backend ghi lý do và trả tồn kho một lần.

Lỗi: `409 ORDER_CANNOT_BE_CANCELLED` hoặc `404 ORDER_NOT_FOUND`.

#### `GET /api/payments/:id` — chủ đơn hoặc Admin

Trả `id`, `orderId`, `method`, `status`, `amount`, `expiresAt`, `paidAt`. Không trả dữ liệu bí mật của cổng thanh toán.

QR callback/webhook là endpoint nội bộ của cổng demo; phải kiểm tra chữ ký, xử lý idempotent và không cho frontend tự báo thanh toán thành công.

### 3.6 Đánh giá sản phẩm

#### `POST /api/reviews` — Customer đã đăng nhập

Request:

```json
{
  "orderId": "order-uuid",
  "productId": "product-uuid",
  "rating": 5,
  "comment": "Vợt nhẹ, dễ kiểm soát."
}
```

Chỉ nhận khi đơn thuộc Customer, trạng thái `COMPLETED`, và sản phẩm có trong đơn. Một khách được đánh giá một sản phẩm tối đa một lần cho mỗi đơn; có thể đánh giá lại sản phẩm đó sau một đơn hoàn thành khác.

## 4. Admin API

Tất cả endpoint dưới đây yêu cầu `role = ADMIN`; nếu không phải Admin trả `403`.

### 4.1 Sản phẩm, biến thể, danh mục và thương hiệu

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/admin/products` | Tìm kiếm/lọc/phân trang sản phẩm kể cả sản phẩm ẩn |
| `POST` | `/api/admin/products` | Tạo sản phẩm |
| `GET` | `/api/admin/products/:id` | Xem sản phẩm và biến thể |
| `PATCH` | `/api/admin/products/:id` | Sửa thông tin hoặc đổi `status` |
| `POST` | `/api/admin/products/:id/variants` | Tạo biến thể |
| `PATCH` | `/api/admin/variants/:id` | Sửa SKU, tên, attributes, giá, ngưỡng tồn, trạng thái |
| `GET/POST` | `/api/admin/categories` | Xem/tạo danh mục |
| `PATCH` | `/api/admin/categories/:id` | Sửa/ẩn danh mục |
| `GET/POST` | `/api/admin/brands` | Xem/tạo thương hiệu |
| `PATCH` | `/api/admin/brands/:id` | Sửa/ẩn thương hiệu |

Không xóa cứng sản phẩm/biến thể đã được đơn hàng tham chiếu. SKU phải duy nhất; giá và tồn không âm.

### 4.2 Đơn hàng và thanh toán

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/admin/orders` | Lọc danh sách mọi đơn |
| `GET` | `/api/admin/orders/:id` | Xem chi tiết đơn |
| `PATCH` | `/api/admin/orders/:id/status` | Chuyển trạng thái hợp lệ |
| `POST` | `/api/admin/orders/:id/cancel` | Admin hủy đơn, bắt buộc lý do |
| `POST` | `/api/admin/orders/:id/cod-payment` | Ghi nhận đã thu COD |
| `GET` | `/api/admin/payments` | Lọc giao dịch thanh toán |
| `POST` | `/api/admin/payments/:id/refund` | Ghi nhận hoàn tiền demo/thủ công |

Request cập nhật trạng thái: `{ "status": "CONFIRMED", "note": "Đã kiểm tra tồn kho" }`. Không cho chuyển trạng thái ngược hoặc bỏ qua bước trái quy tắc. COD chỉ đánh dấu `PAID` khi Admin ghi nhận đã thu. Hoàn tiền phải lưu ghi chú/tham chiếu xử lý và cập nhật payment/order nhất quán.

### 4.3 Khách hàng và đánh giá

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/admin/customers` | Tìm kiếm khách; chỉ trả thông tin cần xử lý đơn |
| `GET` | `/api/admin/customers/:id` | Xem thông tin khách và lịch sử đơn |
| `PATCH` | `/api/admin/customers/:id/status` | Khóa/mở khóa, bắt buộc lý do |
| `GET` | `/api/admin/reviews` | Xem review kể cả review ẩn |
| `PATCH` | `/api/admin/reviews/:id/visibility` | Ẩn/hiện, lưu lý do |

Admin không được xem mật khẩu hoặc sửa nội dung/số sao của review.

### 4.4 Tồn kho và đơn nhập hàng

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/admin/inventory` | Tồn theo biến thể, cảnh báo dưới `lowStockThreshold` |
| `GET` | `/api/admin/stock-movements` | Lịch sử biến động, lọc SKU/loại/thời gian |
| `POST` | `/api/admin/inventory/adjustments` | Điều chỉnh tồn có lý do |
| `GET/POST` | `/api/admin/suppliers` | Xem/tạo nhà cung cấp |
| `GET/PATCH` | `/api/admin/suppliers/:id` | Xem/sửa hoặc ngừng sử dụng |
| `GET/POST` | `/api/admin/purchase-orders` | Xem/tạo đơn nhập |
| `GET` | `/api/admin/purchase-orders/:id` | Chi tiết đơn nhập |
| `PATCH` | `/api/admin/purchase-orders/:id/status` | Đặt hàng/hủy theo trạng thái hợp lệ |
| `POST` | `/api/admin/purchase-orders/:id/receive` | Ghi số lượng thực nhận |

Điều chỉnh tồn request: `{ "variantId": "uuid", "quantityDelta": -1, "reason": "Kiểm kê thực tế" }`. Server tự ghi `stockBefore`, `stockAfter`, người thực hiện và thời gian; không cho tồn âm. Nhận hàng chỉ cộng số lượng thực nhận; mỗi lần nhận ghi biến động kho riêng.

### 4.5 Dashboard và phân tích

| Method | Endpoint | Mục đích |
|---|---|---|
| `GET` | `/api/admin/dashboard?from=2026-10-01&to=2026-10-31` | KPI, doanh thu, đơn, cảnh báo tồn và sản phẩm bán chạy |
| `GET` | `/api/admin/analytics/sales` | Báo cáo doanh thu/sản phẩm theo kỳ, phân trang hoặc giới hạn kết quả |
| `GET` | `/api/admin/recommendations` | Gợi ý kèm số liệu và lý do |
| `PATCH` | `/api/admin/recommendations/:id` | Chấp nhận/bỏ qua gợi ý |
| `GET` | `/api/admin/forecasts` | Kết quả dự báo nhu cầu |
| `POST` | `/api/admin/forecasts/run` | Chạy dự báo; chỉ thêm khi module ML sẵn sàng |
| `GET` | `/api/admin/audit-logs` | Nhật ký thao tác quản trị |

Doanh thu dashboard tính từ đơn `COMPLETED` có thanh toán `PAID`, trừ khoản đã hoàn. Nếu báo cáo thêm doanh số COD chưa thu, phải hiển thị thành chỉ số riêng.

## 5. Trạng thái và quy tắc nghiệp vụ cần khóa trước khi code

1. `POST /api/orders` tạo đơn từ giỏ của người đăng nhập; server tự tính tiền.
2. Mọi endpoint đọc/sửa địa chỉ, giỏ và đơn Customer đều kiểm tra quyền sở hữu ở backend.
3. Khách được đặt đơn sau đăng nhập; tại checkout phải có tên người nhận, số điện thoại và địa chỉ.
4. Với sản phẩm nhiều biến thể, phải chọn `variantId`; sản phẩm chỉ có một biến thể có thể chọn sẵn ở frontend, nhưng API vẫn nhận đúng `variantId`.
5. Khách chỉ hủy trước khi chuyển sang `SHIPPING`; request cần lý do.
6. Đánh giá cần đơn `COMPLETED`; tối đa một review cho mỗi tổ hợp khách–sản phẩm–đơn.
7. Mọi cập nhật đơn, tồn, khóa tài khoản, review visibility và hoàn tiền của Admin phải được ghi `AuditLog` kèm lý do phù hợp.
8. Các thao tác tạo đơn/trừ tồn/ghi sổ kho/thanh toán phải có transaction và chống xử lý lặp.

## 6. Thứ tự triển khai API

### Vòng 1 — luồng mua hàng P0

1. `POST /auth/register`, `POST /auth/login`, `GET /me`
2. `GET /categories`, `GET /brands`, `GET /products`, `GET /products/:slug`
3. `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`
4. `POST /orders`, `GET /orders/my`, `GET /orders/:id`, `POST /orders/:id/cancel`
5. Kiểm thử ownership, chọn biến thể, hết hàng, đặt COD và trạng thái đơn.

### Vòng 2 — Admin P0

1. Product/variant CRUD
2. Xem đơn, chuyển trạng thái, ghi nhận COD
3. Tồn kho, điều chỉnh và stock movement
4. Dashboard cơ bản

### Vòng 3 — P1/P2

QR demo, hoàn tiền, review, supplier/purchase order, analytics, gợi ý, dự báo, voucher, so sánh, tư vấn chọn vợt và 2FA theo thời gian còn lại.

## 7. Ghi chú đối chiếu frontend hiện tại

Frontend mẫu hiện dùng `product.id` để thêm giỏ. Sau khi áp dụng contract, cần đổi sang `variantId`; đồng thời thay dữ liệu `localStorage` cho tài khoản/đơn/giỏ bằng các API tương ứng. Có thể tiếp tục dùng mock service tạm thời, miễn là kiểu dữ liệu mock khớp response trên.

