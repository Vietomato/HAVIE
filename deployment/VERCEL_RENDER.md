# Deploy HAVIE: Vercel + Render

Frontend: Vercel (root `frontend`). API: Render Docker Web Service (root
`backend`). PostgreSQL is a separate Render database in the API's region.
This setup does not run `compose.production.yml` on either platform.

Browser requests use `https://FRONTEND/api/...`. Vercel proxies these to Render.
Keep `VITE_API_BASE_URL` unset (or `/api`); pointing it directly to Render breaks
the current host-only, SameSite=Lax session/OAuth cookie flow. Register the Google
callback on the **frontend** origin so OAuth returns to the browser's cookie host.

## 1. Accounts and plans

- Connect GitHub to Render and Vercel and select this repository, branch `dev`.
- Render Free Web Service sleeps after 15 idle minutes, loses local uploads on
  restart/redeploy and blocks outbound SMTP ports 25/465/587. The current Gmail
  SMTP implementation cannot send OTP/password resets on Free. Use a paid Web
  Service to retain SMTP, or implement an HTTPS email provider before testing OTP
  on Free. Do not disable email verification to work around this.
- Render Free Postgres expires after 30 days. Choose a paid database for lasting
  data. Confirm the service and database costs separately in the dashboard.
- Use Cloudinary for uploads on an ephemeral filesystem. New Cloudinary uploads
  do not automatically migrate existing `/uploads/...` files.

## 2. Create the database on Render

1. New > Postgres; choose the region you will also use for the API.
2. Choose PostgreSQL 18 if available when restoring the local PostgreSQL 18 dump.
   If the target version differs, plan and test the migration before restoring.
3. Save the **Internal Database URL** privately for the Render API. It must not
   point to localhost. The External URL is only for the local transfer process.
4. Choose either a fresh database or transfer the current shop. A fresh database
   has no local products/accounts; migrations only create schema. Back up before
   transferring data. Never run `prisma migrate reset` on shop data.

## 3. Create the API on Render

New > Web Service > GitHub repository:

| Setting | Value |
| --- | --- |
| Branch | `dev` |
| Root Directory | `backend` |
| Language/runtime | Docker |
| Dockerfile Path | `./Dockerfile` (relative to root directory) |
| Docker Build Context | `.` (the backend directory) |
| Docker Command | `sh -c 'npx prisma migrate deploy && node src/server.js'` |
| Health Check Path | `/api/health` |

The existing Dockerfile installs Node 24, generates Prisma and includes the Prisma
CLI for migrations. The startup command applies committed migrations before the
API listens. Use one API instance initially. Let Render supply `PORT`.

Set backend environment variables **in Render**, not in Git. Use
`backend/.env.example` as a list of names, not the local `.env` as production defaults:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render Internal Database URL |
| `JWT_SECRET` | New random server secret, at least 32 bytes |
| `OTP_HASH_SECRET` | A different new random secret, at least 32 bytes |
| `APP_ORIGIN` | Stable Vercel production origin, updated after step 4 |
| `CORS_ORIGIN` | Same frontend origin |
| `FRONTEND_URL` | Same frontend origin (payOS return/cancel pages) |
| `ADMIN_EMAIL_ALLOWLIST` | Your real admin email |
| `AI_PROVIDER` | `groq` |
| `GROQ_API_KEY` | New Groq key |
| `GROQ_EXTRACT_MODEL` | `openai/gpt-oss-20b` |
| `HAVIE_SEMANTIC_SEARCH` | `false` (no local Ollama on Render) |
| `CHAT_MAX_CONCURRENT` | `2` |
| `CLOUDINARY_URL` | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |

For the first API deploy, an intended frontend origin can be used provisionally;
update all three origin variables to the actual Vercel production URL before
testing authentication. Do not add every Vercel preview origin to CORS.

Leave `REDIS_URL` unset to use the implemented shared PostgreSQL session store.
Do not guess `TRUST_PROXY_HOPS`: verify Render/Vercel's actual forwarded-header
chain before enabling it. Without it, per-IP limits can group callers behind the
proxy; include this in staging verification.

For email on a paid service: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`. Confirm outbound SMTP and delivery with a real OTP test.
Set payOS keys and Google credentials when testing those features; they can remain
unset for the initial health check. Never copy frontend secrets into `VITE_*`.

Generate a fresh secret locally (run twice for the two secrets):

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

After deployment, open `https://YOUR-API.onrender.com/api/health`. A 200 response
confirms the process is serving HTTP; also test a database-backed catalog route.

## 4. Deploy frontend on Vercel

Import the same GitHub repository:

| Setting | Value |
| --- | --- |
| Production Branch | `dev` |
| Root Directory | `frontend` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment variable | `BACKEND_ORIGIN=https://YOUR-API.onrender.com` |

`frontend/vercel.mjs` reads `BACKEND_ORIGIN` at deployment time. It creates API
and upload proxies plus the React Router fallback. The URL has no `/api` suffix.
Set it in Production; configure Preview separately only if you need previews.
Vercel intentionally fails configuration evaluation when it is missing/invalid.

Deploy and note the stable production URL, e.g. `https://YOUR-SHOP.vercel.app`.
Update Render's `APP_ORIGIN`, `CORS_ORIGIN`, `FRONTEND_URL` to that exact origin,
then redeploy the API. Open `https://YOUR-SHOP.vercel.app/api/health` to check the
proxy. Verify authenticated responses are not CDN cached.

## 5. Google, payment and data

- Google redirect URI (both Render env and Google Cloud authorized redirects):
  `https://YOUR-SHOP.vercel.app/api/auth/social/google/callback`.
- payOS webhook: `https://YOUR-API.onrender.com/api/payments/payos/webhook`.
  This direct server-to-server endpoint does not depend on the browser cookie.
- Register admin using the allowlisted email and OTP, or transfer the existing
  account as part of the database migration. Google signup creates customers.
- Transfer local images separately. A successful database restore alone does not
  copy `/uploads` files; Cloudinary configuration only affects future uploads.
- Rotate credentials that were shared before using them on a public deployment.

## 6. Acceptance checks

- Frontend renders; refreshing `/auth` or a product URL does not return 404.
- `/api/health` and a real product endpoint work through the frontend origin.
- Register + OTP, login + reload, logout, reset password and admin access work.
- Browser session cookie is HttpOnly, Secure, SameSite=Lax on the frontend host.
- Google sign-in completes through the frontend callback (test linking too).
- Voucher validation, totals, order creation, QR payment and webhook updates work.
- Upload an image, redeploy the API, and confirm the image remains available.
- Chat returns within the real Vercel proxy/platform timeout; check logs for slow
  provider calls and the first request after a Free API cold start.
- Confirm no real secrets or database backups were committed.

Before real sales, arrange backups, test restore, and verify rate limiting under
the deployed proxy chain. A later custom domain requires updating all origins,
Google callback and Vercel domain settings, then repeating authentication checks.

References: [Vercel rewrites](https://vercel.com/docs/routing/rewrites),
[Vercel programmatic configuration](https://vercel.com/docs/project-configuration/vercel-ts),
[Render Docker](https://render.com/docs/docker),
[Render Free limitations](https://render.com/docs/free).
