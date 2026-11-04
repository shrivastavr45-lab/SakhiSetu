# SakhiSetu API

Express 5 + TypeScript API for the existing React 19 / TanStack Start frontend. The API is mounted under `/api` and uses PostgreSQL through Prisma.

## Structure

```text
backend/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    config/       # environment validation and Prisma client
    controllers/  # HTTP request/response handlers
    middleware/   # auth, role checks, validation and centralized errors
    routes/       # endpoint declarations and middleware wiring
    services/     # reusable auth, scheme, campaign, eligibility, donation and AI logic
    types/        # Express request/response augmentation
    utils/        # errors, crypto and async wrapper
    validators/   # Zod request schemas
    app.ts
    server.ts
  tests/          # Node test runner tests for pure eligibility and donation helper logic
```

## Runtime requirements

- Node.js 22.6 or later.
- npm.
- PostgreSQL reachable using `DATABASE_URL`.
- A configured environment file at `backend/.env`.

## Environment

Copy `backend/.env.example` to `backend/.env`. Set at minimum:

- `DATABASE_URL`
- `JWT_SECRET` (32+ random characters)
- `PII_ENCRYPTION_KEY` (64 hexadecimal characters for AES-256-GCM PAN encryption)
- `FRONTEND_ORIGIN` (exact browser origin)
- `COOKIE_SECURE` (`false` only for local HTTP; `true` behind HTTPS)

Set `GEMINI_API_KEY` for assistant/draft generation. Set `TRUST_PAN` and `TRUST_80G_REGISTRATION` only to verified organization credentials. Set `PDF_FONT_PATH` to a valid Noto Sans Devanagari-compatible TTF when rendering a donor name containing Devanagari.

Never commit `backend/.env` or production credentials.

## Database setup

From the project root:

```bash
npm install
npm run db:generate
npm run db:migrate:dev
npm run db:seed
```

For an already-migrated deployment, use `npm run db:migrate` instead of `db:migrate:dev`.

Run the commands below from the repository root. For standalone backend commands, `cd backend` first and use the equivalent scripts in `backend/package.json`. The backend environment loader supports either working directory.

The initial SQL migration also creates the PostgreSQL `receipt_number_seq` sequence. The donation transaction consumes it with `nextval()` for globally unique receipt numbers; PostgreSQL sequence allocation is atomic under concurrent requests (numbers may have gaps, which is intentional).

The seed inserts the three schemes supplied in the assignment. It also inserts illustrative campaign rows inherited from the prototype and a local demo administrator. Scheme documentation/source details not supplied by the brief remain blank; assumed district coverage is documented in the UI and TDD. Re-running the seed does not overwrite editorial changes to existing schemes, campaigns or the seeded admin.

## Development and production

```bash
# API
npm run dev:backend

# Frontend, in a second terminal
npm run dev
```

Build the API with `npm run build:backend`; run the compiled API with `npm run start:backend`. `npm run build:all` attempts both frontend and backend production builds.

## Tests

```bash
npm run test:backend
npm test
```

The backend test suite currently contains nine deterministic eligibility tests and five donation-helper tests (keyed request fingerprinting, Indian financial-year boundaries and receipt-number formatting). Authentication, database transaction behavior, receipt concurrency, Gemini, and browser flows still require dependency installation and an available PostgreSQL/environment; see `IMPLEMENTATION_STATUS.md` for exact verification state.

## Endpoint overview

See [`../docs/frontend-backend-map.md`](../docs/frontend-backend-map.md) for the full endpoint inventory and associated screens. Core route groups:

- `/api/auth`
- `/api/schemes`
- `/api/eligibility`
- `/api/campaigns`
- `/api/donations`
- `/api/receipts`
- `/api/assistant`
- `/api/settings`
- `/api/admin/*`

## Security and demo boundaries

- Donor passwords are hashed with bcryptjs. JWTs are delivered in an HttpOnly cookie and checked against the current database user/role.
- Donor PAN is AES-256-GCM encrypted at rest. The PAN encryption key is a backend-only environment value. Idempotency request fingerprints use a keyed HMAC so the database does not expose an unkeyed digest of PAN.
- All payment handling is mock/test-mode only. No card credentials or money movement are involved.
- PDFs are labelled TEST / PREVIEW and are not legal 80G certificates.
- Gemini is called only from the API. Without a configured key the API responds with a controlled unavailable error.
- Rate limiting, request validation, Helmet, CORS and role checks are configured in the API layer.
