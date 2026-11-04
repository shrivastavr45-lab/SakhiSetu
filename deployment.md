# SakhiSetu deployment and local runbook

## Current deployment state

No live deployment exists in this workspace. The project was supplied as a ZIP without a Git remote or repository URL. The API and frontend are configured for local development; production hosting, DNS, TLS, managed PostgreSQL, secrets, monitoring and backups must be provisioned before a public release.

## Prerequisites

- Node.js 22.6+ and npm.
- PostgreSQL 14+ accessible from the API host.
- A network-enabled environment for installing npm packages.
- Optional: a Gemini API key for the AI assistant and scheme-summary drafting.
- Optional: a Noto Sans Devanagari-compatible TTF for PDFs with Hindi donor names.

## Local setup

1. Extract the project and open a terminal in its root directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the database and a PostgreSQL application user using your local PostgreSQL administration workflow. Do not use a superuser account for a deployed application.
4. Copy the backend environment template:

   ```bash
   cp backend/.env.example backend/.env
   ```

5. Edit `backend/.env`. Required environment variable names:

   | Variable | Purpose |
   |---|---|
   | `NODE_ENV` | Runtime mode |
   | `PORT` | API listen port |
   | `FRONTEND_ORIGIN` | Exact frontend origin allowed by CORS |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_SECRET` | Session-signing secret; 32+ random characters |
   | `JWT_EXPIRES_IN` | Session TTL (`15m`, `30m`, `1h`, `2h`, `4h` or `1d`) |
   | `COOKIE_SECURE` | Secure-cookie switch; `true` in HTTPS deployment |
   | `PAYMENT_MODE` | Only `mock` is supported |
   | `GEMINI_API_KEY` | Optional server-side Gemini credential |
   | `GEMINI_MODEL` | Gemini model identifier |
   | `PDF_FONT_PATH` | Optional absolute path to Devanagari TTF font |
   | `PII_ENCRYPTION_KEY` | 64-hex-character AES-256 key for PAN encryption |
   | `TRUST_NAME` | Trust display name on preview PDF |
   | `TRUST_ADDRESS` | Trust address on preview PDF |
   | `TRUST_PAN` | Trust PAN; use only verified value in a real deployment |
   | `TRUST_80G_REGISTRATION` | 80G registration identifier; use only verified value |
   | `ADMIN_EMAIL` | Email for seeded demo administrator |
   | `ADMIN_PASSWORD` | Initial seeded administrator password |

6. Generate a fresh secret and encryption key for the local environment. Example commands:

   ```bash
   openssl rand -base64 48
   openssl rand -hex 32
   ```

   Use the first output as `JWT_SECRET` and the second output as `PII_ENCRYPTION_KEY`. Keep both values private and out of source control.

7. Configure root frontend environment settings:

   ```bash
   cp .env.example .env
   ```

   `VITE_API_BASE_URL` defaults to `/api`. `API_PROXY_TARGET` defaults to the local API at port `4000`; change it only when the backend is hosted elsewhere.

8. Generate Prisma Client, apply the migration and seed the local database:

   ```bash
   npm run db:generate
   npm run db:migrate:dev
   npm run db:seed
   ```

9. Start the backend in terminal 1:

   ```bash
   npm run dev:backend
   ```

10. Start the frontend in terminal 2:

    ```bash
    npm run dev
    ```

    Open the local URL printed by Vite. Set `FRONTEND_ORIGIN` to that exact origin if it differs from the template default.

11. Check the API health endpoint at `/api/health`. It reports healthy only when PostgreSQL can answer a query.

## Demo sign-in

The seed creates a local administrator using the values below unless the values were changed before the first seed:

- Email: `admin@sakhisetu.test`
- Password: `SakhiDemo!2026`

This is a public demo credential, not a secret. Do not use it in a deployed environment. Set a new `ADMIN_PASSWORD` before the initial seed in a fresh database. Existing seeded administrator records are not overwritten on subsequent seed runs; rotate a password through a controlled administrative/database operation rather than expecting a repeated seed to reset it.

A donor account can be created from `/account` using the registration form. To have a donation appear in that account's history, the donor must remain signed in when submitting the donation.

## Production deployment outline

1. Provision the frontend and API on trusted hosting with HTTPS and a managed PostgreSQL database.
2. Configure all backend environment variables in the platform's secret manager, not in the repository or image.
3. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, exact `FRONTEND_ORIGIN`, a unique strong `JWT_SECRET`, and a random 64-hex-character `PII_ENCRYPTION_KEY`.
4. Supply only verified organization identity and registration information. The application intentionally refuses production startup with demo trust registration placeholders.
5. Install dependencies and generate Prisma Client during the build. In a release environment where secrets are injected as process environment variables (rather than mounted in `backend/.env`), run `npx prisma migrate deploy --schema backend/prisma/schema.prisma`; the local `npm run db:migrate` helper loads `backend/.env` and is intended for local setup.
6. Do not run the demo seed against an existing production database unless its content and administrator bootstrap have been reviewed. The seed is intended for the sample database.
7. Build with `npm run build:all`; start the API using `npm run start:backend` and deploy the frontend using the hosting adapter appropriate to the final TanStack Start target.
8. Prefer a same-origin `/api` reverse proxy for the frontend and API. The current session cookie is SameSite=Lax; a fully cross-site API origin needs a deliberate cookie/CSRF design change and security review, not only a CORS setting.
9. Configure TLS termination, database backups, restore tests, structured logs, error monitoring, health checks, rate limits and operational alerts before launch.
10. Run API, frontend, security and load tests against a staging PostgreSQL environment before accepting donations.

## Demo boundary and known requirements before real use

- Payments are simulated; no money moves. Monthly is an intention record only, not a recurring mandate.
- PDF receipts and 80G certificate previews are explicitly marked TEST / PREVIEW and cannot be used for tax claims. Actual tax-compliant issuance requires the trust's verified legal identity/registration data and an accountant/legal review.
- The sample brief did not provide official source links, detailed document lists, application steps or local help-centre information for the sample schemes. These have not been invented.
- Nine district names were retained from the supplied frontend; broad scheme coverage is only a demo assumption until verified.
- The campaign figures are illustrative seed data inherited from the prototype.
- Gemini features are unavailable until a valid key is configured. Voice input, donor email/SMS delivery, Form 10BD export, recurring payment scheduling and real payment gateway integration are not included.
- Before public launch, complete DPDP Act 2023 compliance work, including notice/consent and retention policies, data-subject request handling, processor contracts, incident response and a privacy/security review. This code is not a legal compliance certification.

## Verification commands

```bash
npm run test:backend
npm test
npm run build:all
```

The current workspace could run only the pure eligibility unit tests and a TypeScript syntax-transpile pass. It could not install all dependencies or connect to PostgreSQL, so migrations, the full test suites, builds, API integration and browser flows remain unverified. See `IMPLEMENTATION_STATUS.md` for the evidence and blockers.
