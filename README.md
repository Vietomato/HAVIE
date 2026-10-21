# HAVIE Badminton Store

Dự án hệ thống website bán hàng cầu lông HAVIE (Frontend React + Backend Node.js / Prisma).

## Cấu trúc thư mục dự án

```text
HAVIE/
├── frontend/               # Giao diện ứng dụng React + Vite
│   ├── public/             # Ảnh minh họa SVG, assets tĩnh
│   ├── src/                # Mã nguồn React (main.jsx, style.css, api/)
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

### 1. Khởi chạy Frontend
```bash
cd frontend
npm install
npm run dev
```
Truy cập: [http://localhost:5173](http://localhost:5173)

### 2. Khởi chạy Backend
```bash
cd backend
npm install
npm run dev
```
Truy cập: [http://localhost:3000/api/health](http://localhost:3000/api/health)
