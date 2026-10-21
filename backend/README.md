# HAVIE Backend Service

Backend API cho hệ thống cửa hàng cầu lông HAVIE, tuân thủ đặc tả tại `API_CONTRACT_HAVIE_v1.md`.

## 1. Cấu trúc thư mục đề xuất

```text
backend/
├── src/
│   ├── config/          # Cấu hình db, jwt, biến môi trường
│   ├── controllers/     # Điều hướng logic từng domain (auth, product, cart, order, admin)
│   ├── middlewares/     # Middleware xác thực JWT (auth.js), kiểm tra role admin
│   ├── routes/          # Khai báo các endpoint express router
│   ├── services/        # Nghiệp vụ cốt lõi, truy vấn database
│   ├── app.js           # Khởi tạo Express app & middlewares chung
│   └── server.js        # Khởi động server HTTP cổng 3000
├── prisma/
│   ├── schema.prisma    # Định nghĩa cấu trúc database PostgreSQL
│   └── seed.js          # Khởi tạo dữ liệu mẫu (sản phẩm, tài khoản ban đầu)
├── .env.example
├── package.json
└── README.md
```

## 2. Hướng dẫn cài đặt & Khởi chạy

### Bước 1: Cài đặt thư viện
```bash
cd backend
npm install
```

### Bước 2: Cấu hình biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```
Cập nhật chuỗi kết nối `DATABASE_URL` tới PostgreSQL.

### Bước 3: Chạy Server ở chế độ phát triển
```bash
npm run dev
```
Server sẽ chạy tại: `http://localhost:3000` (Frontend Vite sẽ tự proxy `/api` qua cổng này).
Kiểm tra sức khỏe server: [http://localhost:3000/api/health](http://localhost:3000/api/health)

