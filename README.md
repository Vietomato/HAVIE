# HAVIE

An e-commerce platform for badminton equipment with an AI-assisted product advisor (**BOTMINTON**).

## Why HAVIE

Choosing badminton equipment is hard for recreational players, especially people who have just started. A racket has many technical parameters (weight class, balance, shaft stiffness, string tension), and gear that is too heavy, too stiff or too tightly strung can strain the arm and shoulder. Existing nationwide shop chains, marketplace storefronts and online communities offer products and opinions, but none of them gives automated, personalised advice for choosing a racket, shoes and strings. HAVIE was developed to fill this gap.

HAVIE covers the whole shopping journey: customers browse rackets, shoes, strings and accessories, pay by bank-transfer QR (payOS) and track their orders. A built-in chat assistant recommends products from the real catalog and answers string-tension questions with safety rules, without inventing specifications. Admins manage products, vouchers and orders from a dashboard.

| | |
| --- | --- |
| **Live demo** | https://havie.online |
| **API docs (Swagger)** | https://bodybuilderorcoder.github.io/havie-api-docs/ |
| **Course** | Web Development, MSIS207.R12.CTTT (Instructor: Dr. Nguyen Thanh Binh) |
| **Team (Group 9)** | Dinh Hoang Viet, Nguyen Vu Hieu |

## Screenshots

Home page, product detail, QR payment and the BOTMINTON advisor chat:

![HAVIE screenshots](docs/diagrams/6-ui-screenshots.png)

## Features

- **Storefront**: home page, category listing with filters and pagination, product detail with variants (size, weight, grip), favorites, cart and checkout with a searchable province → district → ward address picker.
- **Accounts**: email/password sign-up confirmed by an OTP email, password reset, and Google login. Sessions are HttpOnly cookies with a 30-minute idle expiry and a 12-hour absolute limit.
- **Payments**: bank-transfer QR through [payOS](https://payos.vn). An order is marked paid only after a signed webhook is verified. Unpaid payment links expire.
- **Orders**: order history, status tracking and customer-side cancellation (only in allowed states). Cancelling an already paid order records `REFUND_PENDING`; refunds are made manually.
- **Reviews**: customers with a completed purchase can rate products from 1 to 5 stars. One verified review per purchase.
- **AI advisor (BOTMINTON)**: conversational recommendations grounded in the catalog, with rule-based safety answers. Conversations are stored per account in PostgreSQL. It is a decision aid, not medical advice. See [How the AI advisor works](#how-the-ai-advisor-works).
- **Admin dashboard**: create, edit and hide products and variants, upload images, manage vouchers, update order status, and review the audit log.

### Who can do what

| Role | Main functions |
| ---- | -------------- |
| Guest | View home, listing and product detail; search, filter and paginate; sign up with email OTP; sign in with password or Google. |
| Customer | Cart, favorites, vouchers, checkout with the address picker, QR payment, order history and cancellation, verified reviews (1–5 stars), AI advisor with saved conversations, account and password reset. |
| Admin | Create, edit and hide products and variants, upload images (local disk or Cloudinary), manage vouchers, update order status, view the audit log. |

Use-case diagram: [docs/diagrams/1-use-case.png](docs/diagrams/1-use-case.png).

## Architecture

![System architecture](docs/diagrams/2-architecture.png)

```text
Browser → Caddy (HTTPS, host) → Nginx (static React + load balancer)
                                   └→ API (Node.js / Express) ×2 replicas
                                         ├─ PostgreSQL 16  (accounts, catalog, orders, chats)
                                         ├─ Redis 7        (sessions, rate limits, chat slots)
                                         ├─ Ollama         (BGE-M3 embeddings, local)
                                         └─ uploads volume (product images)
External: payOS · Groq Cloud · Google OAuth · Gmail SMTP
```

The production deployment is shown in [docs/diagrams/7-deployment.png](docs/diagrams/7-deployment.png).

### Data model

The database has 23 Prisma models and 6 enums in four groups: identity and security (8), catalog (6), sales (7) and AI advisor (2). The core tables and their relationships are shown in [docs/diagrams/3-erd.png](docs/diagrams/3-erd.png).

- **Identity and security**: `User`, `Address`, `OAuthIdentity`, `AuthRecord` (sessions), `RateCounter`, `RuntimeLease`, `EmailVerificationChallenge`, `PasswordResetChallenge`.
- **Catalog**: `Category`, `Brand`, `Product`, `ProductVariant`, `StockMovement`, `ProductAdvisorNote`.
- **Sales**: `Cart`, `CartItem`, `Order`, `OrderItem`, `Voucher`, `Review`, `AuditLog`.
- **AI advisor**: `AdvisorConversation`, `AdvisorMessage`.

The ERD leaves out seven supporting tables for clarity: `OAuthIdentity`, `AuthRecord`, `RateCounter`, `RuntimeLease`, the two challenge tables and `AuditLog`.

- Prices are stored as integer VND to avoid floating-point errors.
- An order keeps a snapshot of the recipient, address, amounts, voucher and payOS link. Each order item copies the product name, variant name and price at purchase time.
- `OrderStatus`: `PENDING_PAYMENT` → `PENDING_CONFIRMATION` → `CONFIRMED` → `SHIPPING` → `COMPLETED`, or `CANCELLED` / `REFUND_PENDING`.
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `REFUNDED`.
- A partial unique index allows only one verified review per purchase.

Checkout and payment sequence: [docs/diagrams/4-sequence-checkout.png](docs/diagrams/4-sequence-checkout.png).

## Tech stack

| Layer | Stack |
| ----- | ----- |
| Frontend | React 19, Vite, React Router 7, TanStack Query, Tailwind CSS v4, Framer Motion, lucide-react |
| Backend | Node.js (ESM), Express 4, Prisma 6, PostgreSQL |
| Sessions and limits | Redis (PostgreSQL fallback), bcrypt, Nodemailer (OTP email) |
| Payments | payOS (`@payos/node`) |
| AI | Groq Cloud `gpt-oss-20b` for chat, BGE-M3 embeddings through a local Ollama; chat can also run on a local Ollama model (`AI_PROVIDER=ollama`) |
| Images | Local `uploads/` volume, or Cloudinary when `CLOUDINARY_URL` is set |
| API docs | OpenAPI / Swagger UI |
| Infrastructure | Docker and Docker Compose, Nginx, Caddy, Linux VPS |
| Tests | `node:test` (31 test files) |

## How the AI advisor works

The language model understands and words the answer; **the catalog decides** what is recommended. Prices and specifications are never invented. Safety topics such as string tension and arm pain are answered by rules, not by the model. The advisor helps a player choose equipment; it does not give medical advice, and a player with pain should see a doctor.

Flow diagram: [docs/diagrams/5-advisor-flow.png](docs/diagrams/5-advisor-flow.png).

1. **Admission**: session check, per-IP rate limit (20 messages per minute) and at most 2 AI requests at once (otherwise `429 CHAT_BUSY`).
2. **Rule engine**: string-tension questions, lbs ↔ kg conversions, arm-pain safety advice, brand and equipment knowledge, and short follow-ups are answered by rules without the LLM.
3. **Needs extraction**: the LLM turns free Vietnamese text into level, budget and play style.
4. **Hybrid retrieval**: BM25 keyword ranking combined with BGE-M3 embeddings.
5. **Filter**: only in-stock products with verified specifications.
6. **Compose**: the recommendation is built from catalog facts, or the next question is asked.
7. **Polish**: the LLM rewrites the wording only. The reply is saved as an `AdvisorMessage`.

## Getting started (local development)

### Prerequisites

- Node.js 24 (the version used by the Docker image) and npm
- PostgreSQL 16
- Optional: Redis (sessions fall back to PostgreSQL without it)
- Optional: a Gmail account with an App Password for OTP emails
- Optional: a Groq API key, or a local [Ollama](https://ollama.com) install, for the AI advisor

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

Edit `backend/.env`. At minimum:

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
| `REDIS_URL` | Redis connection string for sessions and rate limits |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail address and App Password for OTP emails |
| `ADMIN_EMAIL_ALLOWLIST` | Comma-separated emails that get the Admin role after verification |
| `CLOUDINARY_URL` | `cloudinary://KEY:SECRET@CLOUD`. If empty, uploads go to `backend/uploads` |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | payOS credentials |
| `AI_PROVIDER` | `groq` or `ollama`. The code default is `ollama`, but `.env.example` sets `groq`, so a copied `.env` uses Groq unless you change it |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_EXTRACT_MODEL` | Used when `AI_PROVIDER=groq` |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Used when `AI_PROVIDER=ollama` |
| `HAVIE_SEMANTIC_SEARCH`, `HAVIE_EMBEDDING_URL`, `HAVIE_EMBEDDING_MODEL` | Semantic search with local embeddings (`bge-m3` on Ollama) |

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

Open http://localhost:5174. Vite proxies `/api` and `/uploads` to the backend. Check the API with http://localhost:3000/api/health.

For semantic search, pull the embedding model once: `ollama pull bge-m3`.

### Local admin account (development only)

To try the admin dashboard without going through OTP, add this to `backend/.env`:

```env
NODE_ENV=development
MOCK_ADMIN_ENABLED=true
MOCK_ADMIN_EMAIL=admin.test@example.com
MOCK_ADMIN_PASSWORD=your-local-test-password
```

Restart the backend, then use the dev-only admin login button on the sign-in page. This is rejected outside `NODE_ENV=development`.

## Deploy with Docker

Production runs on a Linux VPS with one Compose file, [deployment/compose.production.yml](deployment/compose.production.yml):

| Service | Image | Role |
| ------- | ----- | ---- |
| `database` | `postgres:16-alpine` | Main data store |
| `redis` | `redis:7-alpine` | Sessions, rate limits, chat slots |
| `ollama` | `ollama/ollama` | Local BGE-M3 embeddings |
| `api` | built from `backend/Dockerfile` | Express API, 2 replicas |
| `web` | built from `frontend/Dockerfile` | Nginx: static React build and load balancer for the API |

The `web` container listens on `127.0.0.1:8080`; Caddy on the host terminates HTTPS and proxies to it. Secrets live in a runtime file outside Git, referenced by `HAVIE_RUNTIME_FILE`.

```bash
git pull
docker compose -f deployment/compose.production.yml up -d --build
# first run only: download the embedding model
docker compose -f deployment/compose.production.yml exec ollama ollama pull bge-m3
```

Deployment is manual; there is no CI/CD pipeline yet. See [deployment/README.md](deployment/README.md) for environment variables, session settings, social login setup and the isolated load test.

## API documentation

All routes are prefixed with `/api`. The OpenAPI files live in `backend/src/docs/openapi/*.yaml` (update the matching file when you add or change a route).

- **Public docs**: https://bodybuilderorcoder.github.io/havie-api-docs/ (read-only, hosted from the `BodybuilderOrCoder/havie-api-docs` repo). The same spec is in [docs/api/](docs/api/).
- **Local docs**: with both servers running, open http://localhost:5174/api/docs. The raw spec is at `/api/docs.json` and can be imported into Postman. Docs are disabled when `NODE_ENV=production`.
  - Call `POST /api/auth/login` first; the browser keeps the session cookie.
  - The page adds the required `X-Havie-Request: 1` header automatically.
  - To use the docs directly on port 3000, add `http://localhost:3000` to `CORS_ORIGIN`, otherwise write requests get `403 ORIGIN_REJECTED`.
- **Export the spec** after editing the YAML files:

  ```bash
  cd backend
  npm run docs:export   # rewrites docs/api/openapi.json
  ```

  Then copy `docs/api/openapi.json` into the `havie-api-docs` repo and push.

Main areas: authentication (OTP sign-up, login, Google), catalog, cart, orders, payments (payOS link and webhook), reviews, vouchers, chat, and admin (role `ADMIN`). OTP codes expire after 10 minutes, can be resent after 60 seconds, and allow at most 5 wrong attempts.

## Security overview

- HttpOnly, SameSite cookie sessions (Secure in production) stored in Redis, with a PostgreSQL fallback.
- OTP-confirmed sign-up, bcrypt password hashes, and password reset that invalidates old sessions.
- Google login with the OAuth 2.0 / OpenID Connect authorization-code flow, PKCE, state and nonce.
- CSRF protection: `POST`, `PATCH` and `DELETE` need the `X-Havie-Request` header and an allowed origin.
- The server recalculates prices, stock and vouchers; payment is accepted only from a verified payOS webhook.
- Per-IP rate limits, role checks on admin routes, an audit log and trusted-proxy settings.
- A password change or reset invalidates old sessions (`authVersion`), and logging out revokes the session on the server.

## Implementation highlights

- **Catalog**: server-side filtering, sorting and pagination, database indexes on filter columns, a 10-second cache for public catalog responses, and stock tracking through stock movements.
- **Orders and vouchers**: totals are computed on the server, voucher rules are validated in a service, and orders follow a state machine.
- **Reviews**: only customers with completed orders can review; verified-purchase badge, edit your own review, rating totals and pagination.
- **API documentation**: OpenAPI exported with `swagger-jsdoc` and shown by Swagger UI.

## Testing

- **Automated tests**: 31 `node:test` files (`cd backend && npm test`) covering validation, authentication and sessions, social login, payOS handling, vouchers, reviews, image storage, catalog queries and the advisor (needs extraction, retrieval, tension conversion, brand knowledge, follow-ups).
- **Manual tests**: the full purchase flow at 375 px (mobile) and 1280 px (desktop).
- **Isolated load test**: separate database with 1,000 synthetic products and 1,000 distinct signed-in virtual users, with no AI, email or payment calls.

  | Metric | Result |
  | ------ | ------ |
  | Virtual users / browsing requests | 1,000 authenticated users / 10,000 requests |
  | Errors | 0 |
  | Throughput | about 598 requests per second |
  | Latency P95 | 255 ms |
  | Setup | one API process, local Linux containers |

  This is evidence for that local profile only, not a capacity guarantee for the production server (which runs two API replicas).

## Scripts

**Backend** (`cd backend`)

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the API with file watching |
| `npm start` | Start the API |
| `npm test` | Run the test suite (`node --test`) |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create or apply a dev migration |
| `npm run prisma:seed` | Seed the database |
| `npm run docs:export` | Export the OpenAPI spec |

**Frontend** (`cd frontend`)

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## Project structure

```text
HAVIE/
├── frontend/              # React + Vite single-page app (Dockerfile, nginx.conf)
│   ├── public/            # Static assets and address data
│   └── src/
│       ├── api/           # HTTP client and service wrappers
│       ├── components/    # Header, Footer, ProductCard, AdvisorChat, ...
│       ├── context/       # StoreProvider (auth, cart, favorites)
│       ├── pages/         # Home, Listing, Detail, Cart, Checkout, ... (+ admin/)
│       ├── styles/        # Tailwind layers and component styles
│       └── utils/
├── backend/               # Express + Prisma API (Dockerfile)
│   ├── prisma/            # schema, migrations, seed data
│   ├── scripts/           # catalog import and advisor tooling
│   ├── data/              # catalog source and advisor knowledge data
│   ├── src/
│   │   ├── routes/        # auth, catalog, cart, orders, payments, chat, admin
│   │   ├── services/      # business logic (advisor, payOS, email, ...)
│   │   ├── middlewares/
│   │   ├── docs/          # OpenAPI YAML files
│   │   └── utils/
│   └── test/              # node:test files
├── deployment/            # Docker Compose files and deployment guide
├── docs/                  # API spec and diagrams (architecture, ERD, flows)
├── Rule.md                # Project conventions
└── README.md
```

More detail on migrations, the AI provider and catalog tooling is in [backend/README.md](backend/README.md).

## Known limitations and next steps

- Refunds for paid orders are only recorded (`REFUND_PENDING`); money is returned manually.
- AI chat capacity is deliberately small (2 concurrent requests by default, `CHAT_MAX_CONCURRENT`) because language models are expensive.
- The advisor covers only the products and knowledge in its data and does not give medical advice.
- The load test did not include real AI or payment traffic and is not a sustained production soak test.
- No shipping-carrier integration.
- Facebook login code exists in the backend but is not enabled in the interface.
- Planned: automatic refunds and shipping tracking; order notifications by email or Zalo; a recommendation engine based on purchase history; monitoring and alerting, automated backups, CI/CD and a CDN; a PWA or mobile app and multilingual support.

## Conventions

Frontend code follows [Rule.md](Rule.md): Tailwind CSS v4 utilities first, mobile-first layouts, semantic HTML, and the existing 600 / 900 / 1200px breakpoints. Check the UI at a 375px viewport and on desktop before opening a PR.

Before submitting changes:

```bash
cd backend && npm test
cd frontend && npm run build
```

## Contributing

1. Branch off `dev` (`feature/your-change`).
2. Keep commits focused, using Conventional Commit prefixes such as `feat(home): ...` or `fix(cart): ...`.
3. Run the checks above, then open a pull request into `dev`. `dev` is merged into `main` for releases.

## License

ISC
