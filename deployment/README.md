# HAVIE: sessions, social login and capacity

## What is implemented

- The web uses an opaque, random session cookie: HttpOnly, SameSite=Lax, Secure in production. No authentication credential is stored in localStorage. Existing JWT-only browser logins need to sign in once after this change.
- The server rejects sessions after 30 minutes without recorded activity, with an absolute lifetime of 12 hours. Visible pages send activity at most once a minute after real interaction; background reads do not renew sessions. Closing the page stops activity. Timing is measured from the last activity recorded by the server, rather than relying on an unreliable browser-close event.
- Logout revokes the server session and synchronizes signed-out state across tabs. Resetting a password invalidates previously issued sessions through the account's authVersion. Disabled users are checked on every authenticated request.
- Redis is the shared store when REDIS_URL is configured. Without it, expiring PostgreSQL records provide a shared, durable local fallback. Configured Redis failures reject authentication rather than accepting an unchecked session.
- Unsafe browser requests require X-Havie-Request: 1 and an allowed Origin. The signed payOS webhook route retains its separate signature validation. X-Havie-Activity: 1 is only sent by the activity endpoint's client call.
- Google and Facebook have real authorization-code flows. Google verifies the signed ID token, issuer, audience, expiry, nonce and PKCE. Both providers use expiring, one-use state bound to a browser cookie. Facebook checks token validity, app ID and user ID. Provider access tokens stay on the server and are not persisted.
- New social accounts are always CUSTOMER. An email collision never automatically links accounts: the customer signs in with the existing method and uses the link button in their HAVIE account page. Linking also requires the original active HAVIE session at callback. Facebook accounts without email can sign in; checkout still requires its normal recipient/address details. Email/password signup and OTP remain available.

## Enable providers

The storefront currently offers Google only, with a locally stored official Google G icon. Facebook buttons and related customer-facing text have been removed from sign-in, signup and account linking. The existing backend provider implementation is retained for compatibility but is not offered in the storefront UI.

The implementation does not open or edit the real backend .env file. Configure these values yourself in the backend runtime environment; never send secrets in chat or put them in frontend variables:

| Variable | Meaning |
| --- | --- |
| APP_ORIGIN | Frontend origin, e.g. http://localhost:5174 locally; HTTPS for production |
| GOOGLE_CLIENT_ID | Google OAuth web application's client ID |
| GOOGLE_CLIENT_SECRET | Its server-side secret |
| GOOGLE_REDIRECT_URI | Exact registered callback, locally http://localhost:3000/api/auth/social/google/callback |
| FACEBOOK_CLIENT_ID | Meta application's App ID |
| FACEBOOK_CLIENT_SECRET | Its server-side secret |
| FACEBOOK_REDIRECT_URI | Exact registered callback ending in /api/auth/social/facebook/callback |
| FACEBOOK_GRAPH_VERSION | A supported Graph API version enabled for the app, in vNN.N form |

Create web applications in Google Cloud and Meta for Developers and register the callback URLs exactly. Use an HTTPS test domain/tunnel where Facebook requires it, with the frontend and callback routed to this application. Complete the provider's production-access requirements before admitting the public. Request only basic identity and email, not friends or posting permissions. Until configuration is complete, the UI shows disabled provider buttons and email login remains usable. GET /api/auth/providers exposes only availability booleans.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Meta Graph API](https://developers.facebook.com/docs/graph-api/get-started/).

## Production topology

compose.production.yml supplies a starting topology: static frontend/Nginx, two Node API replicas, PostgreSQL, shared Redis and shared uploaded images. Redis/PostgreSQL are not published externally. API instances use connection pools of 10 by default, public catalog responses have a short 10-second cache, and catalog filters have database indexes. Nginx compresses responses and caches fingerprinted frontend assets. A CDN can sit in front of static assets; personal API responses are never proxy-cached.

Place the gateway behind HTTPS on the same public site as the API. The published gateway address is 127.0.0.1:8080; it is not a public TLS endpoint by itself. Configure TRUST_PROXY_HOPS for the actual trusted proxy chain, rather than accepting arbitrary X-Forwarded-For. OAuth and account URLs are excluded from API access logs. Nginx's upstream configuration follows its [official documentation](https://nginx.org/en/docs/http/ngx_http_upstream_module.html).

Before using the production template, supply HAVIE_APP_ORIGIN, HAVIE_RUNTIME_FILE (an absolute path to a private backend configuration file), and a strong URL-safe HAVIE_DB_PASSWORD. Back up any database before migrating an existing deployment. Do not point a fresh template database at the shop volume accidentally.

```powershell
docker compose -f deployment/compose.production.yml build
docker compose -f deployment/compose.production.yml up -d database redis
docker compose -f deployment/compose.production.yml run --rm --no-deps api npx prisma migrate deploy
docker compose -f deployment/compose.production.yml up -d
```

Chat is deliberately limited: at most two in-flight requests globally, with shared Redis leases (PostgreSQL advisory-lock fallback), plus per-IP limits. Extra callers receive CHAT_BUSY/429 and Retry-After instead of starting more Groq/Ollama jobs. No goal of 1,000 simultaneous chat completions is claimed. The production template uses BM25 by default; enabling local embeddings in containers requires a reachable **local** Ollama endpoint in the API network namespace, since the embedding client rejects external endpoints.

The template is not a promise about a particular server's capacity. Measure CPU, memory, PostgreSQL connections, error rate and latency on the deployment hardware. Limit connection pools across all API replicas to fit the database; adding replicas alone is insufficient.

## Reproduce isolated load testing

The load-test database is separate from the shop and uses synthetic products and accounts. compose.loadtest.yml binds its ports to loopback and uses disposable database storage. The test script refuses any database name other than havie_loadtest in NODE_ENV=test, restricted to localhost or the explicit test-container database service. It does not call Groq, send emails or exercise live payment/provider services.

For the Linux container profile used in the successful run:

```powershell
docker compose -f deployment/compose.loadtest.yml up -d --wait
docker compose -f deployment/compose.loadtest.yml --profile runner build runner
docker compose -f deployment/compose.loadtest.yml --profile runner run --rm --no-deps runner npx prisma migrate deploy
docker compose -f deployment/compose.loadtest.yml --profile runner run --rm --no-deps runner
```

From the repository root:

```powershell
docker compose -f deployment/compose.loadtest.yml up -d --wait
cd backend
$env:NODE_ENV = 'test'
$env:DATABASE_URL = 'postgresql://havie_test:local-loadtest-only@127.0.0.1:55432/havie_loadtest?schema=public&connection_limit=10&pool_timeout=30'
$env:REDIS_URL = 'redis://127.0.0.1:56379'
$env:JWT_SECRET = 'isolated-loadtest-only-secret-at-least-32-bytes'
$env:HAVIE_SEMANTIC_SEARCH = 'false'
.\node_modules\.bin\prisma.cmd migrate deploy
node scripts/loadtest-sessions.mjs
```

The default profile has 1,000 distinct signed-in virtual users, a 5-second arrival ramp, ten browsing rounds and one second of think time. It includes /me, products and carts, and first verifies password login, HttpOnly cookies, CSRF protection, server-side logout revocation, PostgreSQL session fallback, password-change invalidation and shared chat admission. Results are in backend/data/session-loadtest-report.json. The separate session-loadtest-burst-report.json and session-loadtest-windows-report.json preserve the earlier Windows runs and their TCP connection failures; these must not be interpreted as successful Windows capacity tests. The Linux run is a separate environment, not a fix claimed for the Windows networking limitation.

These are short local integration/load checks, not a sustained production soak test or a 1,000-user password-login burst. Repeat on the target server behind its real HTTPS gateway before claiming production capacity. When finished, return to the repository root and run:

The recorded Linux check on 15 November 2026 completed 10,000 browsing requests for 1,000 authenticated virtual users with zero errors, approximately 598 requests/second and P95 255 ms. It used one API process and an isolated 1,000-product fixture, with no Groq/provider/payment requests. The report includes successful checks for server-side revocation, account-version invalidation, PostgreSQL session fallback and shared chat admission. This is evidence for that local profile, not a hardware-independent capacity guarantee.

```powershell
docker compose -f deployment/compose.loadtest.yml down
```

## Auth API changes

Login and successful OTP signup now set the session cookie and return data.user and data.expiresIn; the web no longer receives an accessToken. Fetch clients must send credentials: include. POST /api/auth/activity renews a live session only when X-Havie-Activity is 1. POST /api/auth/logout revokes it. GET /api/me restores the current user without renewing idle time.

POST /api/auth/social/:provider/start accepts returnTo and mode (login or link), returning data.url. Navigate to that URL; the registered GET callback validates the provider and returns to /auth with a public success/error code, without putting tokens in the URL. Disabled providers are listed by GET /api/auth/providers. Update third-party API clients that previously used a browser JWT; stale bearer tokens are intentionally rejected.
