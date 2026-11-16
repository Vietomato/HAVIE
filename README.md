# HAVIE

A full-stack e-commerce web app for a badminton gear shop, with an AI-powered product advisor.

Customers can browse rackets, shoes, strings and accessories, add items to a cart, pay by bank-transfer QR (payOS), and track their orders. A built-in chat assistant helps them pick the right racket or string tension. Admins manage products and orders from a dashboard.

## Features

- **Storefront**: home page, category listing with filters and pagination, product detail with variants (size, weight, grip), favorites, cart, checkout.
- **Checkout address**: searchable province → district → ward pickers (type without diacritics, e.g. "ha noi"); each list only shows units inside the one chosen above. Data: 63 provinces from [provinces.open-api.vn](https://provinces.open-api.vn) v1, stored in `frontend/public/data/vn-administrative-units.json` and rebuilt with `frontend/scripts/build-vn-administrative-units.mjs`.
- **Auth**: email/password and OTP signup, server-managed HttpOnly cookie sessions with 30-minute idle expiry, password reset, and configurable Google login.
- **Payments**: bank-transfer QR through [payOS](https://payos.vn), with webhook-based order confirmation.
- **Orders**: order history, status tracking, customer-side cancellation.
- **Product reviews**: customers with completed purchases can rate products from 1–5 stars, leave a comment and edit their own review from the product page or order history. Verified-purchase badges, review pagination and rating totals are supported.
- **AI advisor**: conversational product recommendations. Chats are stored per account in PostgreSQL, so they survive a reload. Supports Groq Cloud or a local Ollama model.
  Standalone tension questions and lbs/kg conversions take priority over a pending shopping questionnaire, without losing saved shopping preferences. The assistant accepts `Ibs` typos and unaccented conversion questions. Short follow-ups such as “còn 26?” reuse the source unit only from the immediately preceding conversion in the same conversation; at most eight text messages are read locally, without sending raw history to the AI. Tension safety still requires verified specifications for the exact racket and variant.
  Racket follow-ups use the public recommendation snapshots in the last eight messages: “cây 100 game nặng k” explains the shown variant's weight and balance, while “tại sao những cây này đánh đơn/đôi” explains the known traits of each previously recommended racket. Ambiguous model/variant references ask for clarification; missing specifications remain unknown. These answers preserve the shopping profile and do not start another search or send history to the AI. Play-format explanations are guidance, not exclusive singles/doubles classifications; see [Sport Singapore's racket guide](https://www.activesgcircle.gov.sg/learn/badminton/how-to-choose-a-badminton-racket?tab=how_to_play) and [Yonex's front/back-court doubles example](https://www.yonex.com/news/astrox-88-sd-a-new-dawn-for-doubles/).
- **Admin dashboard**: create/edit/hide products, upload images (local disk or Cloudinary), and update order status.
- **Chat readability**: short racket follow-ups use concise bullets with bold model names, labels and key specifications; the renderer supports plain text and `**bold**` without rendering HTML.
- **Brand knowledge**: concise Yonex/Victor/Li-Ning/Mizuno comparisons explain series directions, shared traits and selection order. Brand guidance does not set product specifications, rank brands absolutely or infer tension limits. Bare catalog model aliases such as `100zz` are resolved before the buying questionnaire; multiple catalog versions require clarification.
- **Playing level and discomfort**: educational answers distinguish recreational and professional equipment choices without assuming all recreational players are beginners or all competitors need stiff rackets/high tension. Reports of arm pain take precedence over product selection and numeric tension advice: reduce/stop painful activity and seek clinical assessment when needed. General overuse guidance cites [NHS](https://www.nhs.uk/conditions/tennis-elbow/) and [AAOS](https://orthoinfo.aaos.org/en/diseases--conditions/tennis-elbow-lateral-epicondylitis/); these sources do not establish badminton-specific safe tension thresholds. Deterministic replies also receive a courteous opening while preserving technical facts.
- **Short athlete advice**: technique, tension and recovery answers can end with one brief Viktor Axelsen paraphrase introduced as “Lời khuyên từ vận động viên chuyên nghiệp nổi tiếng”. Product recommendations never append athlete advice. Each distinct tip is automatically shown once per conversation, including after reopening or more than eight messages; an explicit request such as “Nhắc lại lời khuyên VĐV” may repeat it. Sources remain in the knowledge data ([WHOOP](https://www.whoop.com/us/en/thelocker/pillars-performance-viktor-axelsen-badminton-champion/), [The Star](https://www.thestar.com.my/sport/badminton/2024/11/02/viktor-offers-tips-for-youngsters-to-achieve-smashing-success)) and are omitted from customer-facing text. Tips never supply a model specification, tension value or treatment recommendation, and are skipped for conversions, private requests and unresolved questionnaires. General training/gear-testing guidance remains HAVIE guidance, not an athlete quote.
- **Store information and feedback**: the footer and About page share HAVIE Store's introduction, mission and vision. Service feedback links directly to Zalo `0329596879` (Mr Hoang Viet). Cancelling an already paid order still records `REFUND_PENDING`; automatic bank payouts are not enabled by this change.
- **Voucher editor**: create/edit vouchers in a dialog up to 760px wide, with two columns on desktop and one on mobile; date/time fields stay inside the form.

Session expiry, Google/Facebook setup, production topology and the isolated 1,000-user browsing test are documented in [deployment/README.md](deployment/README.md).

## Tech Stack

| Layer    | Stack |
| -------- | ----- |
| Frontend | React 19, Vite 6, React Router 7, TanStack Query, Tailwind CSS v4, Framer Motion, lucide-react |
| Backend  | Node.js (ESM), Express 4, Prisma 6, PostgreSQL |
| Auth     | Cookie sessions, Redis/PostgreSQL, OAuth, bcrypt, Nodemailer (OTP email) |
| Payments | payOS (`@payos/node`) |
| AI       | Groq Cloud or Ollama (switchable via env) |
| Storage  | Local `uploads/` or Cloudinary |

## Project Structure

```text
HAVIE/
├── frontend/              # React + Vite single-page app
│   ├── public/            # Static assets
│   └── src/
│       ├── api/           # HTTP client and service wrappers
│       ├── components/    # Header, Footer, ProductCard, AdvisorChat, ...
│       ├── context/       # StoreProvider (auth, cart, favorites)
│       ├── pages/         # Home, Listing, Detail, Cart, Checkout, ... (+ admin/)
│       ├── styles/        # Tailwind layers and component styles
│       └── utils/
├── backend/               # Express + Prisma API
│   ├── prisma/            # schema, migrations, seed data
│   ├── scripts/           # catalog import and advisor tooling
│   ├── src/
│   │   ├── routes/        # auth, catalog, cart, orders, payments, chat, admin
│   │   ├── services/      # business logic (advisor, payOS, email, ...)
│   │   ├── middlewares/
│   │   └── utils/
│   └── test/              # node:test suites
├── Rule.md                # Project conventions
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- (Optional) A Gmail account with an App Password for OTP emails
- (Optional) A Groq API key or a local [Ollama](https://ollama.com) install for the AI advisor

### 1. Clone and install

```bash
git clone https://github.com/Vietomato/HAVIE.git
cd HAVIE

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`. At minimum you need:

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret, 32+ bytes |
| `OTP_HASH_SECRET` | A different random secret, 32+ bytes |

Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Optional variables:

| Variable | Description |
| -------- | ----------- |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail address and App Password for sending OTP emails |
| `ADMIN_EMAIL_ALLOWLIST` | Comma-separated emails that get the Admin role after verification |
| `CLOUDINARY_URL` | `cloudinary://KEY:SECRET@CLOUD`. If empty, uploads go to `backend/uploads` |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | payOS credentials |
| `AI_PROVIDER` | `groq` or `ollama` (default) |
| `GROQ_API_KEY`, `GROQ_MODEL` | Required when `AI_PROVIDER=groq` |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Used when `AI_PROVIDER=ollama` |

Never commit `.env` or share these values.

### 3. Set up the database

```bash
cd backend
npx prisma generate
npx prisma migrate deploy   # apply migrations
npm run prisma:seed         # load categories, brands, products, variants
```

The seed is idempotent: products are upserted by slug and variants by SKU.

> **Warning**: never run `prisma migrate reset` against a database that has data you care about.

### 4. Run the app

In two terminals:

```bash
# Terminal 1: API on http://localhost:3000
cd backend
npm run dev

# Terminal 2: web app on http://localhost:5174
cd frontend
npm run dev
```

Open [http://localhost:5174](http://localhost:5174). Vite proxies `/api` and `/uploads` to the backend. You can check the API with `http://localhost:3000/api/health`.

### Local admin account (development only)

To try the admin dashboard without going through OTP, add this to `backend/.env`:

```env
NODE_ENV=development
MOCK_ADMIN_ENABLED=true
MOCK_ADMIN_EMAIL=admin.test@example.com
MOCK_ADMIN_PASSWORD=your-local-test-password
```

Restart the backend, then use the dev-only admin login button on the sign-in page. This is rejected outside `NODE_ENV=development`.

## Scripts

**Backend** (`cd backend`)

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the API with file watching |
| `npm start` | Start the API |
| `npm test` | Run the test suite (`node --test`) |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:seed` | Seed the database |

**Frontend** (`cd frontend`)

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## API Overview

All routes are prefixed with `/api`.

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST /auth/register/request-otp`, `POST /auth/register/verify-otp`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Catalog | `GET /categories`, `GET /brands`, `GET /products`, `GET /products/:slug`, `GET /products/:slug/reviews` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id` |
| Orders | `POST /orders`, `GET /orders/my`, `POST /orders/:id/cancel` |
| Chat (auth) | `GET/POST /chat/conversations`, `GET/PATCH/DELETE /chat/conversations/:id`, `POST /chat/conversations/:id/messages` |
| Admin (role `ADMIN`) | `GET/POST /admin/products`, `PATCH /admin/products/:id`, `GET /admin/orders`, `PATCH /admin/orders/:id/status` |

OTP codes expire after 10 minutes, can be resent after 60 seconds, and allow at most 5 wrong attempts. See [backend/README.md](backend/README.md) for more detail on database migrations, the AI provider, and catalog tooling.

## Conventions

Frontend code follows [Rule.md](Rule.md): Tailwind CSS v4 utilities first, mobile-first layouts, semantic HTML, and the existing 600 / 900 / 1200px breakpoints. Check the UI at a 375px viewport and on desktop before opening a PR.

Before submitting changes:

```bash
cd backend && npm test
cd frontend && npm run build
```

## Contributing

1. Branch off `main` (`feature/your-change`).
2. Keep commits focused, using conventional prefixes such as `feat(home): ...` or `fix(cart): ...`.
3. Run the checks above, then open a pull request.

## License

ISC
