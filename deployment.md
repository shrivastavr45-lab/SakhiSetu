# SakhiSetu — Deployment and Local Runbook

## Architecture overview

| Layer | Platform | Notes |
|---|---|---|
| Frontend (SSR) | **Cloudflare Pages** | TanStack Start / Nitro builds a Cloudflare Worker; Render Static Site cannot host SSR |
| API proxy | **Built into the SSR Worker** | `/api/*` requests are intercepted before SSR and forwarded to Render |
| Backend API | **Render Web Service** (Node.js) | Express 5, TypeScript, port from `process.env.PORT` |
| Database | **Neon PostgreSQL** (ap-southeast-1) | Existing managed database |

> **Why Cloudflare Pages for the frontend?**
> The `@lovable.dev/vite-tanstack-config` package locks the Nitro preset to
> `cloudflare-module`. Every `npm run build` produces a Cloudflare Worker bundle
> in `.output/server/` and static assets in `.output/public/`. There is no
> root-level `index.html` — every route is server-rendered by the Worker.
> Cloudflare Pages hosts both the Worker and its static assets for free with
> global CDN. Deploying the frontend to Render Static Site is not supported
> by the current build toolchain.
>
> **How the API proxy works:**
> The SSR Worker entry (`src/server.ts`) intercepts every request to `/api/*`
> before passing it to the TanStack Start handler. It forwards the request to the
> Render backend URL (`BACKEND_URL` env var), preserving all headers including
> `Cookie` and `Set-Cookie`. This makes the API appear at the same Cloudflare
> Pages origin so that `SameSite=Lax` session cookies work correctly without any
> cross-origin issues.
>
> Note: Cloudflare Pages Functions (`/functions` directory) are **not used**
> here. When a custom `_worker.js` / advanced mode Worker handles all routes
> (as Nitro does), the `/functions` directory is silently ignored by Cloudflare.
> The proxy runs inside the Nitro Worker itself.

---

## Prerequisites

- Node.js ≥ 22.6.0 and npm.
- A Cloudflare account (free plan is sufficient for the frontend).
- A Render account (free Web Service tier is sufficient to start).
- Access to the Neon PostgreSQL project (ap-southeast-1).
- Optional: a Gemini API key for the AI assistant feature.
- Optional: Noto Sans Devanagari TTF font files for Hindi donor name PDFs (see [Hindi PDF font setup](#hindi-pdf-font-setup)).

---

## Local development setup

### 1 — Install dependencies

```bash
npm install
```

### 2 — Backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`. Generate fresh secrets first:

```bash
# JWT secret (minimum 32 characters)
openssl rand -base64 48

# AES-256 PAN encryption key (exactly 64 hex characters)
openssl rand -hex 32
```

Required variables in `backend/.env`:

| Variable | Purpose | Example / Constraint |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API listen port | `4000` |
| `FRONTEND_ORIGIN` | CORS: exact frontend origin | `http://localhost:3000` |
| `DATABASE_URL` | Neon / local PostgreSQL URL | `postgresql://...` |
| `JWT_SECRET` | JWT signing key | ≥ 32 random chars |
| `JWT_EXPIRES_IN` | Session TTL | `2h` (or `15m`, `30m`, `1h`, `4h`, `1d`) |
| `COOKIE_SECURE` | Secure cookie flag | `false` in local dev, `true` in production |
| `PAYMENT_MODE` | Payment mode | `mock` (only supported value) |
| `GEMINI_API_KEY` | Optional AI key | Leave blank to disable AI features |
| `GEMINI_MODEL` | Gemini model name | `gemini-3.5-flash` |
| `PDF_FONT_PATH` | Devanagari font (regular) | Absolute path or blank |
| `PDF_FONT_BOLD_PATH` | Devanagari font (bold/semibold) | Absolute path or blank |
| `PII_ENCRYPTION_KEY` | 64-hex-char AES-256 key | Required in production |
| `TRUST_NAME` | Trust name on PDF receipts | Replace placeholder in production |
| `TRUST_ADDRESS` | Trust address on PDF receipts | Replace placeholder in production |
| `TRUST_PAN` | Trust PAN for 80G receipts | Must match `[A-Z]{5}[0-9]{4}[A-Z]` in production |
| `TRUST_80G_REGISTRATION` | 80G registration identifier | Replace placeholder in production |
| `ADMIN_EMAIL` | Seed administrator email | Replace demo value in production |
| `ADMIN_PASSWORD` | Seed administrator password | ≥ 12 chars; replace demo value |

### 3 — Frontend environment

```bash
cp .env.example .env
```

`VITE_API_BASE_URL` defaults to `/api` (same-origin proxy in local dev).
`API_PROXY_TARGET` points the dev server proxy at `http://localhost:4000`.

### 4 — Database setup

```bash
npm run db:generate
npm run db:migrate:dev
npm run db:seed
```

### 5 — Run locally

Terminal 1 (backend):
```bash
npm run dev:backend
```

Terminal 2 (frontend):
```bash
npm run dev
```

Check `http://localhost:3000` and `http://localhost:4000/api/health`.

### Demo credentials

Seeded by `npm run db:seed` unless overridden before first seed:

- Email: `admin@sakhisetu.test`
- Password: `SakhiDemo!2026`

Do not use these credentials in any deployed environment.

---

## Production deployment

### Demo deployment vs live deployment

SakhiSetu supports two production deployment modes, controlled by `DEPLOYMENT_MODE`:

| Mode | When to use | Trust credentials | Receipt disclaimers |
|---|---|---|---|
| `live` | Genuine charitable deployment | Must be verified; PAN format enforced | TEST/PREVIEW (always) |
| `demo` | Demonstration / showcase | Synthetic credentials allowed | TEST/PREVIEW (always) + `[DEMO — NOT A REAL REGISTRATION]` |

**Demo mode is not a weaker mode** — it still enforces HTTPS, strong JWT secret, valid PII encryption key, secure cookies, and a non-default admin password. It only relaxes the requirement for verified trust registration credentials, because the receipts it generates are already irrevocably marked as invalid for tax purposes.

**Demo deployment environment (Render):**

Use these values in `DEPLOYMENT_MODE=demo` to deploy this as a showcase without real trust credentials:

```
NODE_ENV=production
DEPLOYMENT_MODE=demo
DATABASE_URL=<your Neon connection string>
FRONTEND_ORIGIN=https://<your-pages>.pages.dev
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN=2h
COOKIE_SECURE=true
PAYMENT_MODE=mock
PII_ENCRYPTION_KEY=<openssl rand -hex 32>
GEMINI_API_KEY=<your key or blank>
GEMINI_MODEL=gemini-3.5-flash
PDF_FONT_PATH=
PDF_FONT_BOLD_PATH=
TRUST_NAME=SakhiSetu Demonstration Trust
TRUST_ADDRESS=Bhopal, Madhya Pradesh
TRUST_PAN=NOT-CONFIGURED-DEMO
TRUST_80G_REGISTRATION=NOT-CONFIGURED-DEMO
ADMIN_EMAIL=admin@yourdomain.org
ADMIN_PASSWORD=<strong password ≥ 12 chars>
```

What changes in demo mode PDFs:
- "Trust PAN" row shows `[DEMO — NOT A REAL REGISTRATION]`
- "Trust 80G registration" row shows `[DEMO — NOT A REAL REGISTRATION]`
- All existing disclaimers remain: "TEST / PREVIEW — NOT VALID FOR TAX CLAIMS", "DEMO DOCUMENT — DO NOT SUBMIT TO THE INCOME TAX DEPARTMENT", and the footer note about demo placeholders

What does not change in demo mode:
- `PAYMENT_MODE=mock` — no real payments
- Receipt numbering, PDF generation, access control
- All security headers, rate limits, authentication
- `COOKIE_SECURE=true`, HTTPS `FRONTEND_ORIGIN`, strong secrets still required

### Step 1 — Backend: Render Web Service

#### 1a — Create the service

1. In the Render dashboard, click **New → Web Service**.
2. Connect the GitHub repository (`SakhiSetu` branch: `main`).
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `sakhisetu-api` |
| **Region** | Singapore (closest to Neon ap-southeast-1) |
| **Runtime** | Node |
| **Branch** | `main` |
| **Root Directory** | *(leave empty — project root)* |
| **Build Command** | `npm install && npm run db:generate && npm run build:backend` |
| **Start Command** | `npm run start:backend` |
| **Plan** | Free (or Starter for production SLA) |
| **Health Check Path** | `/api/health` |

#### 1b — Environment variables

Set all of the following in **Render → Environment** for the `sakhisetu-api` service.
Do not commit these values to the repository.

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | *(Render injects this automatically; do not set it manually)* |
| `DATABASE_URL` | Your Neon PostgreSQL connection string |
| `FRONTEND_ORIGIN` | `https://your-project.pages.dev` *(your Cloudflare Pages domain)* |
| `JWT_SECRET` | Random string ≥ 32 chars (`openssl rand -base64 48`) |
| `JWT_EXPIRES_IN` | `2h` |
| `COOKIE_SECURE` | `true` |
| `PAYMENT_MODE` | `mock` |
| `GEMINI_API_KEY` | Your Gemini API key (or blank) |
| `GEMINI_MODEL` | `gemini-3.5-flash` |
| `PDF_FONT_PATH` | *(blank unless Devanagari PDF support is needed)* |
| `PDF_FONT_BOLD_PATH` | *(blank)* |
| `PII_ENCRYPTION_KEY` | 64-char hex string (`openssl rand -hex 32`) |
| `TRUST_NAME` | Verified trust legal name |
| `TRUST_ADDRESS` | Verified trust registered address |
| `TRUST_PAN` | Verified trust PAN (format: `[A-Z]{5}[0-9]{4}[A-Z]`) |
| `TRUST_80G_REGISTRATION` | Verified 80G registration identifier |
| `ADMIN_EMAIL` | Production administrator email |
| `ADMIN_PASSWORD` | Strong password ≥ 12 chars |

> **Backend startup guards:** the server refuses to start in production if
> `JWT_SECRET` is the example placeholder, `PII_ENCRYPTION_KEY` is not 64 hex
> chars, `COOKIE_SECURE` is not `true`, `FRONTEND_ORIGIN` does not start with
> `https://`, `ADMIN_PASSWORD` is `SakhiDemo!2026`, or either trust registration
> field is `NOT-CONFIGURED-DEMO`. Fix these before the first deploy.

#### 1c — Database migrations on Render

Migrations must be run **before** the service starts serving traffic. There are two safe options:

**Option A — Pre-deploy command (recommended)**

In Render dashboard → Advanced → Pre-Deploy Command:

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

This runs automatically before each deploy and is safe to run repeatedly.
`prisma migrate deploy` never drops tables or modifies existing data.

**Option B — Manual one-off from Render Shell**

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

> **Never run `prisma migrate reset` or `prisma migrate dev` against the production database.** These commands drop and recreate the schema, destroying all data.
> Existing scheme records, donation records, and user accounts are preserved by `migrate deploy`.

#### 1d — Admin account bootstrap

The seed script creates the admin user. On a fresh production database:

1. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to your production values in Render environment.
2. Run the seed once from the Render Shell:

```bash
NODE_ENV=production npx tsx backend/prisma/seed.ts
```

Do not run the seed again after the first run — it is safe to re-run (the seed
uses `upsert` on the admin user by email, so it will not duplicate records), but
the admin password must be rotated via a controlled database operation, not via seed.

---

### Step 2 — Frontend: Cloudflare Pages

The TanStack Start frontend builds as a Cloudflare Worker (SSR) using the
`@lovable.dev/vite-tanstack-config` package. Cloudflare Pages hosts both
the Worker (for server-rendered HTML) and the static asset bundle (CSS/JS).

#### 2a — Create the Cloudflare Pages project

1. In the Cloudflare dashboard, go to **Pages → Create a project → Connect to Git**.
2. Select the `SakhiSetu` repository.
3. Configure the build:

| Setting | Value |
|---|---|
| **Project name** | `sakhisetu` *(your-project.pages.dev)* |
| **Production branch** | `main` |
| **Framework preset** | *(None — custom)* |
| **Build command** | `npm install && npm run build` |
| **Build output directory** | `.output/public` |
| **Root directory** | *(leave empty)* |

4. Under **Functions** (or in wrangler settings if prompted):
   - **Functions directory** / Worker output: `.output/server`
   - Cloudflare Pages automatically picks up `.output/server/index.mjs` as the Worker entry.
   - Compatibility date: `2026-11-07` (already set in `.output/server/wrangler.json`)
   - Compatibility flags: `nodejs_compat`

#### 2b — Environment variables in Cloudflare Pages

Set these in **Cloudflare Pages → Settings → Environment variables** (production):

| Variable | Value | Purpose |
|---|---|---|
| `BACKEND_URL` | `https://sakhisetu-api.onrender.com` | Backend URL for the API proxy in the SSR Worker |
| `VITE_API_BASE_URL` | `/api` | Frontend API base (same-origin; stays `/api` because the proxy handles it) |

> **`VITE_API_BASE_URL`** must be set at build time (Vite inlines it into the
> client bundle). Set it to `/api` — the proxy in `src/server.ts` automatically
> forwards `/api/*` requests to the `BACKEND_URL`.
>
> **`BACKEND_URL`** is read at Worker runtime (not build time). It tells the
> proxy where to forward requests. Must be the full base URL of the Render service
> with no trailing slash.

#### 2c — SPA routing and page refresh

TanStack Start handles all routing server-side via the Cloudflare Worker.
Every request (including deep links like `/finder` or `/schemes/SCH-014`) is
handled by the Worker, which renders the correct page. No `_redirects` file or
special SPA routing configuration is needed.

The existing `.output/public/_headers` file sets long-term cache headers for
hashed static assets. Cloudflare Pages respects this file automatically.

#### 2d — Verify the CORS chain

After both services are deployed:

1. The Render backend `FRONTEND_ORIGIN` must exactly match the Cloudflare Pages domain:
   `https://sakhisetu.pages.dev` (or your custom domain if configured).
2. The Cloudflare Pages `VITE_API_BASE_URL` is `/api` (same-origin proxy).
3. The Cloudflare Pages `BACKEND_URL` must point to the Render service:
   `https://sakhisetu-api.onrender.com`
4. The SSR Worker intercepts `/api/*` and proxies it to `BACKEND_URL`.
   Session cookies flow correctly because the browser and the API proxy
   share the same Cloudflare Pages origin.

The cross-origin cookie problem is solved by the built-in proxy.
No `SameSite=None` changes or separate CORS configuration are required.

---

### Step 3 — Database: Neon PostgreSQL

The Neon database is already configured and contains 581 schemes and existing
donation/user records. No data migration is needed.

#### Connection string

Use the connection string from the Neon console. Use the **pooled** connection
string for the application (recommended for serverless / long-running connections):

```
DATABASE_URL=postgresql://user:password@ep-....ap-southeast-1.aws.neon.tech/sakhisetu?sslmode=require&pgbouncer=true
```

Or the **direct** (non-pooled) connection string for Prisma migrations:

```
DATABASE_URL=postgresql://user:password@ep-....ap-southeast-1.aws.neon.tech/sakhisetu?sslmode=require
```

> Neon requires `sslmode=require`. If the connection string from the Neon console
> does not include it, append it manually.

#### Migration commands

Run migrations only against the correct database. Verify the `DATABASE_URL`
before running:

```bash
# Production-safe deploy (never destructive)
npx prisma migrate deploy --schema backend/prisma/schema.prisma

# Check current migration status
npx prisma migrate status --schema backend/prisma/schema.prisma
```

**Never run against production:**

```bash
# DANGER — drops and recreates the entire schema
npx prisma migrate reset

# DANGER — creates new migrations; only for local development
npx prisma migrate dev
```

---

## Security checklist

| Item | Status |
|---|---|
| `JWT_SECRET` ≥ 32 random chars, not the example placeholder | Must set |
| `PII_ENCRYPTION_KEY` is 64 hex chars (`openssl rand -hex 32`) | Must set |
| `COOKIE_SECURE=true` in production | Enforced by startup guard |
| `FRONTEND_ORIGIN` is an `https://` URL | Enforced by startup guard |
| `ADMIN_PASSWORD` is not `SakhiDemo!2026` | Enforced by startup guard |
| `TRUST_PAN` and `TRUST_80G_REGISTRATION` are not `NOT-CONFIGURED-DEMO` | Required in `live` mode; `demo` mode allows synthetic credentials |
| `.env` and `backend/.env` are gitignored | Confirmed in `.gitignore` |
| Stack traces suppressed in production responses | Yes — `error-handler.ts` |
| `X-Test-Payment-Outcome` removed from CORS in production | Yes — `app.ts` |
| All admin routes require `ADMIN` role | Yes — `requireRole(UserRole.ADMIN)` |
| Donation PAN stored AES-256 encrypted | Yes — requires `PII_ENCRYPTION_KEY` |
| Receipt download requires session or signed token | Yes — `auth.ts` + `receipt.service.ts` |

---

## File and PDF handling in production

### PDF receipts

PDFs are generated entirely in memory (no disk writes). The PDFKit buffer is
sent directly in the HTTP response. No persistent filesystem is required.
Render's ephemeral filesystem has no impact on PDF generation.

### Hindi PDF fonts

If donor names, `TRUST_NAME`, or `TRUST_ADDRESS` contain Devanagari characters,
a Unicode TTF font must be available on the server. On Render, the only reliable
option is to bake the font file into the repository or build artifact, because
Render's filesystem is ephemeral and does not support mounted volumes on the free tier.

**Recommended approach for Render:**

1. Add font files to the repository under `backend/fonts/` (these are OFL-licensed free fonts):

```bash
mkdir -p backend/fonts
# Copy NotoSansDevanagari-Regular.ttf to backend/fonts/
```

2. Set environment variables to a path relative to the working directory:

```
PDF_FONT_PATH=backend/fonts/NotoSansDevanagari-Regular.ttf
PDF_FONT_BOLD_PATH=backend/fonts/NotoSansDevanagari-SemiBold.ttf
```

3. The build command `npm run build:backend` does not strip font files from
   `backend/fonts/`, so they are available at `node dist/server.js` startup.

**If all content is Latin/English:** leave `PDF_FONT_PATH` and `PDF_FONT_BOLD_PATH`
empty. PDFKit's built-in Helvetica handles Latin text without any font file.

### CSV imports

- Maximum upload size: 10 MB (enforced by `IMPORT_MAX_BYTES` in `import.service.ts`).
- CSV bodies are parsed in memory; no temporary files are written.
- Render's 50 MB request body limit is well above the 10 MB CSV cap.

---

## Verification commands

Run these locally before deploying:

```bash
# Backend typecheck
cd backend && node_modules/.bin/tsc --noEmit -p tsconfig.json

# Frontend typecheck
node_modules/.bin/tsc --noEmit -p tsconfig.json

# Backend tests (183 tests)
cd backend && node --experimental-strip-types --test \
  tests/eligibility.test.mjs tests/donation-helpers.test.mjs \
  tests/admin-donations.test.mjs tests/donor-records.test.mjs \
  tests/reports.test.mjs tests/scheme-import-csv.test.mjs \
  tests/scheme-import-mapping.test.mjs tests/scheme-list.test.mjs

# Receipt tests (46 tests)
cd backend && node --experimental-strip-types --test tests/receipt.test.mjs

# Frontend build
npm run build

# Backend build
npm run build:backend
```

All commands must exit 0 before deploying.

---

## Troubleshooting

### Backend startup fails with "Invalid backend environment configuration"

A required env var is missing or invalid. The error message names the field.
Check that all required variables are set in the Render dashboard environment.

### Backend startup fails in production with a specific guard message

The startup guard in `backend/src/config/env.ts` rejects placeholder values.
Set the named variable to a real value and redeploy.

### `/api/health` returns 503

The backend cannot reach Neon. Check:
- `DATABASE_URL` is correct (including `sslmode=require`).
- The Neon database is not paused (free-tier Neon pauses after 5 days of inactivity; wake it via the Neon console).
- The Render service is deployed in Singapore (ap-southeast-1) to minimize latency to Neon.

### Session cookie not sent / admin login fails after correct credentials

This is the cross-origin cookie issue. The session cookie (`SameSite=Lax`)
is blocked when the frontend domain differs from the API domain.
The built-in proxy in `src/server.ts` solves this: verify that `BACKEND_URL`
is set correctly in Cloudflare Pages environment variables and that the
production build (after setting `BACKEND_URL`) is deployed.

### PDF download returns `503 PDF_UNICODE_FONT_REQUIRED`

A donor name, `TRUST_NAME`, or `TRUST_ADDRESS` contains Devanagari characters
and no font file is configured. Either:
- Set `PDF_FONT_PATH` to a valid TTF path (see Hindi PDF font setup above), or
- Ensure all trust identity fields in `TRUST_NAME` / `TRUST_ADDRESS` use Latin characters.

### Neon paused after inactivity

Free-tier Neon databases pause after 5 days without connections. Wake it from
the Neon console (Compute → Resume) or configure Neon's "Always active" setting.

---

## Appendix A — API proxy implementation

The proxy is implemented in `src/server.ts`, the Cloudflare Worker entry point
compiled and bundled by Nitro into `.output/server/_ssr/ssr.mjs` on every build.

**How it works:**

```
Browser → GET/POST /api/...
            ↓
Cloudflare Pages Worker (src/server.ts)
  if pathname.startsWith("/api/")
    → forward to BACKEND_URL (Render)
      preserve: method, headers (minus hop-by-hop), body
      return: upstream status, headers (including Set-Cookie), body
  else
    → TanStack Start SSR handler (normal page rendering)
```

**Why the `/functions` directory does not work here:**
Cloudflare Pages Functions (`/functions/*.ts`) are silently ignored when a
custom Worker entry controls all routes (advanced mode). Nitro's Worker is
advanced mode — it owns the entire request lifecycle.

**Environment variable required at runtime (Cloudflare Pages):**

| Variable | Value |
|---|---|
| `BACKEND_URL` | `https://sakhisetu-api.onrender.com` *(no trailing slash)* |

**What is proxied:**
All requests to `/api/*` — authentication (`/api/auth/*`), donations
(`/api/donations/*`), receipts (`/api/receipts/*`), schemes (`/api/schemes/*`),
eligibility (`/api/eligibility`), admin routes (`/api/admin/*`), health check
(`/api/health`).

**Security properties:**
- The browser never sends cookies to Render directly — it only sends them to
  the Cloudflare Pages origin, which is the Worker's own domain. The Worker then
  forwards them as a server-side fetch to Render. This is safe because the Worker
  runs in Cloudflare's infrastructure, not in the user's browser.
- Hop-by-hop headers (`host`, `connection`, `transfer-encoding`, etc.) are
  stripped before the upstream fetch to avoid HTTP/1.1 protocol errors.
- `redirect: "manual"` prevents the Worker from silently following redirects
  that should be surfaced to the browser.

---

## Appendix B — Environment variable quick reference

### Backend (Render Web Service environment)

```
NODE_ENV=production
DEPLOYMENT_MODE=demo          # or "live" for a genuine charitable deployment
DATABASE_URL=postgresql://...neon.tech/sakhisetu?sslmode=require
FRONTEND_ORIGIN=https://sakhisetu.pages.dev
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN=2h
COOKIE_SECURE=true
PAYMENT_MODE=mock
GEMINI_API_KEY=<your-key-or-blank>
GEMINI_MODEL=gemini-3.5-flash
PDF_FONT_PATH=
PDF_FONT_BOLD_PATH=
PII_ENCRYPTION_KEY=<openssl rand -hex 32>
TRUST_NAME=<trust name>
TRUST_ADDRESS=<trust address>
TRUST_PAN=NOT-CONFIGURED-DEMO              # demo mode only; live mode requires verified PAN
TRUST_80G_REGISTRATION=NOT-CONFIGURED-DEMO # demo mode only; live mode requires verified number
ADMIN_EMAIL=admin@yourdomain.org
ADMIN_PASSWORD=<strong password ≥ 12 chars>
```

### Frontend (Cloudflare Pages environment variables)

Build-time variables (Vite inlines these into the client bundle):
```
VITE_API_BASE_URL=/api
```

Runtime variables (read by the Cloudflare Worker at request time):
```
BACKEND_URL=https://sakhisetu-api.onrender.com
```

Both must be set in **Cloudflare Pages → Settings → Environment variables**.
`VITE_API_BASE_URL` requires a new build after changing; `BACKEND_URL` takes
effect immediately (no rebuild needed) because it is read at runtime.

---

## Demo boundary and known limitations

- **Payments are simulated.** No money moves. `PAYMENT_MODE=mock` is the only
  supported value. Monthly donations are intention records only — no recurring
  mandate is set up.
- **PDF receipts are preview/demo documents.** They are marked TEST and cannot
  be used for tax claims. Real 80G certificate issuance requires verified trust
  legal identity and an accountant/legal review.
- **All imported MP government schemes** — 22 are published and verified; 556 remain as drafts requiring admin review before publishing.
  Only published schemes appear in public eligibility results.
- **Gemini AI features** are inactive without a valid `GEMINI_API_KEY`.
- **Before public launch:** complete DPDP Act 2023 compliance (notice/consent,
  retention, data-subject requests, processor contracts, incident response, and
  a security review). This codebase is not a legal compliance certification.
