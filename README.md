# HAVIE Badminton Store

Dự án hệ thống website bán hàng cầu lông HAVIE (Frontend React + Backend Node.js / Prisma).

## Cấu trúc thư mục dự án

```text
HAVIE/
├── frontend/               # Giao diện ứng dụng React + Vite
│   ├── public/             # Ảnh minh họa SVG, assets tĩnh
│   ├── src/                # React: App, components, pages, context, api và styles
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

## Tổ chức frontend

- `src/main.jsx`: khởi tạo React và import stylesheet tổng.
- `src/App.jsx`: khai báo routing và bọc ứng dụng trong `StoreProvider`.
- `src/context/StoreContext.jsx`: state và thao tác dùng chung cho tài khoản, giỏ hàng, yêu thích; export `StoreProvider` và `useStore`.
- `src/components/`: `Header`, `Footer`, `Shell`, `ProductCard` dùng chung.
- `src/pages/`: `Home`, `Listing`, `Detail`, `Cart`, `Checkout`, `Auth`; trang quản trị nằm tại `pages/admin/Admin.jsx`.
- `src/api/`: HTTP client và các dịch vụ gọi backend thật; mock đã được bỏ theo cập nhật từ branch `dev`.
- `src/utils/product.js`: nhãn sản phẩm và hàm hiển thị tên biến thể dùng chung.
- `src/style.tailwind.css`: điểm import Tailwind và các stylesheet trong `styles/`.
- `src/styles/`: chia theo base, header, home, products, campaign, footer, catalog, detail, auth, cart-checkout, admin, responsive và account-product-extras.

Các stylesheet giữ nguyên selector và nằm trong `@layer components`. Thứ tự import giữ nguyên cascade cũ; `responsive.css` giữ các breakpoint 600/900/1200px và reduced-motion, còn `account-product-extras.css` chứa các phần bổ sung ở cuối stylesheet cũ. Một số selector dùng chung vẫn ở nhóm gốc (ví dụ `.btn` trong `home.css`, input của checkout trong `auth.css`), vì vậy các file này được nạp toàn cục, không import riêng theo route. Khi sửa giao diện, ưu tiên utility trực tiếp trong JSX theo `Rule.md`.

Kiểm tra biên dịch bằng `cd frontend && npm run build`. Build không thay thế việc kiểm tra giao diện ở mobile/desktop và các trạng thái tương tác.

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

## Clean Racing (Option B)

The frontend theme is centralized in `frontend/src/styles/theme.css`: racing red CTAs, electric blue accents, navy text, and light surfaces. Small blue text uses a darker accessible variant. Header navigation uses separate neutral outlined boxes; the current section has a heavier border and matches both pathname and category query. Typography uses Segoe UI with system fallbacks supporting Vietnamese.

Component styles remain in `frontend/src/styles/`, in Tailwind's components layer. Existing 600/900/1200px breakpoints are retained; the header wraps its navigation between 900px and 1199px. Images retain their original artwork colors, and order status badges retain semantic status colors.

Validation: production build passed; React render checks covered eight navigation URLs; source UTF-8 validation passed. Full desktop/mobile visual regression and authenticated admin/checkout interaction checks remain pending.
