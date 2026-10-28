# HAVIE Badminton Store

Dự án hệ thống website bán hàng cầu lông HAVIE (Frontend React + Backend Node.js / Prisma).

## Cấu trúc thư mục dự án

```text
HAVIE/
├── frontend/               # Giao diện ứng dụng React + Vite
│   ├── public/             # Ảnh minh họa SVG, assets tĩnh
│   ├── src/                # Mã nguồn React + Tailwind CSS v4 (main.jsx, style.tailwind.css, api/)
│   ├── package.json
│   └── vite.config.js      # Proxy sẵn /api -> http://localhost:3000
│
├── backend/                # Dịch vụ Backend API (Node.js/Express + Prisma)
│   ├── src/                # server.js, app.js, routes, controllers
│   ├── package.json
│   └── README.md
│
├── API_CONTRACT_HAVIE_v1.md # Bản đặc tả API v1 chuẩn mực
├── Rule.md                  # Quy định kiến trúc công nghệ
└── README.md
```

## Hướng dẫn khởi chạy

### 1. Khởi chạy Backend
```bash
cd backend
npm install
npm run dev
```
Backend dùng `backend/.env` để kết nối PostgreSQL. Để nạp dữ liệu sản phẩm lần đầu, làm theo hướng dẫn seed trong [backend/README.md](backend/README.md).

### 2. Khởi chạy Frontend
```bash
cd frontend
npm install
npm run dev
```
Truy cập: [http://localhost:5173](http://localhost:5173). Frontend gọi backend thật qua `/api`; khi backend hoặc PostgreSQL không sẵn sàng, lỗi kết nối sẽ được hiển thị thay vì dùng dữ liệu mẫu.

Frontend xử lý CSS bằng Tailwind CSS v4 thông qua plugin Vite. Các style component nằm trong `@layer components` và ưu tiên `@apply` Tailwind utilities; arbitrary values được giữ cho các kích thước, màu sắc và giá trị tùy chỉnh để bảo toàn thiết kế. Inline styles đã được chuyển sang utility classes. Các reset và breakpoint gốc được giữ nguyên.
