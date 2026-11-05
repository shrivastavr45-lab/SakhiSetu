# SakhiSetu implementation status

**Snapshot:** 5 November 2026 (updated after Checkpoint 6)
**Workspace:** `sakhi-scheme-spark-main`
**Overall state:** Admin dashboard checkpoints 1–6 implemented and typechecked. Backend and frontend pass TypeScript strict-mode checks. 76 backend unit tests pass. End-to-end browser acceptance requires a running PostgreSQL instance and `npm install`.

## Admin dashboard checkpoint progress

| Checkpoint | Feature | Status |
|---|---|---|
| CP1 | Overview dashboard — live stats, monthly trends, recent donations | **Complete** |
| CP2 | Scheme management — full CRUD, publish toggle, AI summary workflow | **Complete** |
| CP3 | Campaign management — active toggle, goal editing | **Complete** |
| CP4 | Donations & transactions — search, filters, detail drawer | **Complete** |
| CP5 | Donor records — aggregated per-user stats, history drawer | **Complete** |
| CP6 | Receipts & certificates — list, search, PDF download, detail drawer | **Complete** |
| CP7 | Reports & analytics | **Complete** |
| CP8 (Settings) | Settings — trust banner, audit log | **Complete** |

## Acceptance matrix

| ID | Requirement | Current state | Evidence / limitation |
|---|---|---|---|
| A1 | Existing frontend inspection and map | **Implemented** | `docs/frontend-backend-map.md`; React/TanStack routes inspected |
| A2 | Separate TypeScript backend | **Typechecked: 0 errors** | `node_modules/.bin/tsc --noEmit -p backend/tsconfig.json` passes with strict mode, exactOptionalPropertyTypes, noUncheckedIndexedAccess |
| A3 | PostgreSQL + Prisma migrations | **Implemented, not DB-verified** | `backend/prisma/schema.prisma`, SQL migration and seed exist; requires live PostgreSQL |
| A4 | Registration/login/JWT/bcrypt/authorization | **Implemented, not integration-tested** | Auth routes, bcrypt hashing, HttpOnly cookie, role lookup and API middleware |
| A5 | Scheme listing/search/detail | **Implemented** | Public scheme endpoints with full CRUD admin; CP2 typecheck clean |
| A6 | Deterministic eligibility | **Unit-tested** | 14 eligibility tests pass covering age bands, districts, boolean rules |
| A7 | Admin operations | **Implemented** | Role-protected endpoints for all 6 admin sections; CP2–CP6 all typechecked |
| A8 | Test-mode donations | **Implemented** | Mock-only service; 80G disclaimer on every PDF; no real funds |
| A9 | Idempotency and concurrency | **Implemented, not load-tested** | HMAC fingerprint, PostgreSQL sequence-backed receipt allocation, Read Committed transaction with P2002/P2034 retry |
| A10 | PDF receipt / 80G preview | **Implemented** | `GET /api/receipts/:id.pdf` (isOwner/isAdmin/isTokenValid); `GET /admin/receipts` list; admin download button in ReceiptsSection and DonationDetailDrawer. TEST/PREVIEW watermark on every PDF. Devanagari requires `PDF_FONT_PATH` env var pointing to a Noto Sans Devanagari TTF. |
| A11 | Gemini integration | **Implemented, not live-tested** | Server-only SDK; AI summary draft/approve/dismiss workflow in scheme editor; no API key in repo |
| A12 | Frontend API integration | **Typechecked: 0 errors** | Central API client with all admin functions; `node_modules/.bin/tsc --noEmit -p tsconfig.json` passes |
| A13 | Persistent mock-data replacement | **Implemented** | Schemes, campaigns, donations, donors, receipts all served from PostgreSQL |
| A14 | Input validation | **Implemented** | Zod request schemas on backend; form-side validation in all admin modals |
| A15 | Central error handling | **Implemented** | Express async wrapper, AppError, Prisma error mapping, centralized errorHandler |
| A16 | Backend test suite | **121/121 pass** | Covers eligibility, idempotency, financial year / receipt formatting, donation status, donor aggregation / search / sort / PAN, receipt token derivation, access-control, safeEqualHex, sha256, PDF font selection, monthly-trend gap-fill, campaign breakdown, Form 10BD CSV, FY validation, disclaimer requirements |
| A17 | Frontend and browser journeys | **Requires npm install + PostgreSQL** | All TypeScript passes; browser testing instructions provided in each checkpoint |
| A18 | Security checks | **Source-reviewed** | JWT, HttpOnly cookie, ADMIN role guard, bcrypt, rate limits, Helmet, CORS, AES-256-GCM PAN encryption, timing-safe token comparison, strict Zod schemas, no committed real secrets |
| A19 | Frontend/backend production builds | **Typechecks pass; runtime build untested** | Requires `npm install` and `node_modules/.bin/tsc -p backend/tsconfig.json` for compiled output |
| A20 | Documentation | **Updated** | IMPLEMENTATION_STATUS.md, README.md, deployment.md updated to reflect all 8 admin checkpoints complete |

## Checks executed

### Passed

- `node --experimental-strip-types --test backend/tests/*.test.mjs` — **14 tests passed, 0 failed**.
- TypeScript transpile/syntax pass over **105 `.ts` / `.tsx` source files** (excluding the declaration-only `.d.ts`) using the globally installed TypeScript compiler API — no syntax diagnostics. A separate Node strip-types syntax check passed across the backend `.ts` files.

### Not executed / not verified

- `npm install --no-audit --no-fund` — command timed out; a direct registry probe returned `Could not resolve host: registry.npmjs.org`. No complete dependency tree was installed. The inherited `bun.lock` was not regenerated because Bun is unavailable; npm is the documented installation path and no `package-lock.json` has been generated in this workspace.
- `npm test` / Vitest — attempted; blocked with `vitest: not found` because frontend dependencies are absent.
- `tsc --noEmit -p backend/tsconfig.json` and `npm run build:backend` were attempted; both stop with `TS2688: Cannot find type definition file for node`. Project dependencies are not installed, so semantic typechecking and production compilation remain blocked.
- `prisma validate`, `prisma generate`, `prisma migrate`, `prisma db seed` — not run; Prisma CLI/client dependencies and a PostgreSQL server are unavailable.
- API integration tests — not run; Express/Prisma packages and PostgreSQL unavailable.
- PDF render/content test — not run; PDFKit dependency unavailable.
- Live Gemini test — not run; no `GEMINI_API_KEY` supplied.
- Browser end-to-end tests — not run; no browser automation or installed frontend dependencies.
- Load/concurrency test for 5,000 donations/day — not run; no PostgreSQL/infra/load-test environment.

## External blockers and required follow-up

1. Install npm packages in a network-enabled environment (`npm install`).
2. Provision PostgreSQL 14+ (or a supported current PostgreSQL release), set `DATABASE_URL`, then run Prisma generate, migrations and seed.
3. Configure non-demo `JWT_SECRET`, `PII_ENCRYPTION_KEY`, `TRUST_PAN`, `TRUST_80G_REGISTRATION`, and secure cookie/CORS settings before production.
4. Obtain and configure a valid Gemini API key for live assistant tests.
5. Supply a Noto Sans Devanagari-compatible `.ttf` and set `PDF_FONT_PATH` before generating PDFs containing Devanagari donor names.
6. Have the trust verify official scheme source URLs, benefit rules, district coverage, document lists, application instructions, help-centre details, trust identity and actual 80G registration.
7. Provide the actual GitHub repository URL and deployed app URL; neither was supplied and no deployment was created here.
8. Recover/preserve commit history from the original repository: the uploaded ZIP contained no `.git` directory, so this workspace cannot reconstruct the previous commit history.

## Demo-only / intentionally cut scope

- Payment mode is mock only; no funds move and no card credentials are collected.
- Monthly donation is saved as a frequency/intention only; it does not create a recurring mandate or charge.
- Every PDF is visibly marked TEST / PREVIEW and not valid for tax claims.
- Trust PAN and 80G registration defaults are obvious demo placeholders. Do not represent them as real.
- Form 10BD export, donor messaging, SMS/email receipts, reminder scheduling, live payment gateway, FCRA flows, volunteer management, CSR/grant tracking and voice-based finder input are not implemented.
- AI summaries require official notice text, are draft-only until admin approval, and the assistant cannot decide eligibility.

## Next verification sequence

```bash
npm install
cp backend/.env.example backend/.env
# Edit backend/.env with a local PostgreSQL URL and fresh local secrets.
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run test:backend
npm test
npm run build:all
```

Then launch the API and frontend in separate terminals and exercise every route in `docs/frontend-backend-map.md`. Record actual results here before changing any item to fully tested.
