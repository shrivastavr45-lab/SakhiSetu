# SakhiSetu implementation status

**Snapshot:** 5 November 2026 (final — Checkpoint 8 QA complete)
**Workspace:** `sakhi-scheme-spark-main`
**Overall state:** All 8 admin dashboard checkpoints implemented. Backend and frontend pass TypeScript strict-mode checks. 121 backend unit tests pass. All user journeys verified by code-level audit. End-to-end browser acceptance requires a running PostgreSQL instance and `npm install`.

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

## User journey verification (Checkpoint 8 — code-level audit)

All journeys verified by reading the source code end-to-end (frontend route → API client → backend route → controller → service → Prisma). No browser runtime testing was possible in this environment.

| # | Journey | Status | Evidence |
|---|---|---|---|
| 1 | Browse schemes | **Complete** | `schemes.index.tsx` → `getSchemes({need,district,q})` → `GET /api/schemes` → `listPublicSchemes` → `listSchemes({published:true})`; need pill filters, district select, search, result count all wired |
| 2 | Scheme detail | **Complete** | `schemes.$id.tsx` → `getScheme(id)` → `GET /api/schemes/:id` → `findScheme` (throws 404 for unpublished); renders eligibility, documents, steps, source URL, lastCheckedAt, speak button |
| 3 | Eligibility finder | **Complete** | `finder.tsx` → 6 questions + need + district → `checkEligibility(profile)` → `POST /api/eligibility` → `evaluateEligibility()` in `eligibility-rules.ts`; age bands, boolean rules, district match, unansweredRules all implemented and unit-tested |
| 4 | Admin login | **Complete** | `admin.tsx` login form → `login()` → `POST /api/auth/login` → `verifyLogin()` → `setSessionCookie()`; checks `role !== ADMIN` and rejects donors with logout |
| 5 | Admin scheme management | **Complete** | `SchemesSection` + `SchemeModal` → `createAdminScheme/updateAdminScheme/deleteAdminScheme` → `POST/PATCH/DELETE /api/admin/schemes`; AI workflow via `draftSchemeSummary/approveSchemeSummary/dismissSchemeSummary` → `POST /api/admin/ai/schemes/:id/summary-*` |
| 6 | Admin campaign management | **Complete** | `CampaignsSection` + `CampaignGoalModal` → `updateAdminCampaign({goalAmount,active})` → `PATCH /api/admin/campaigns/:id` |
| 7 | Donor registration | **Complete** | `account.tsx` → `registerDonor({name,email,password})` → `POST /api/auth/register` → `registerDonor()` service → bcrypt hash + `prisma.user.create(role=DONOR)` |
| 8 | Mock one-time donation | **Complete** | `donate.tsx` → `createDonation(payload, idempotencyKey)` → `POST /api/donations` with `Idempotency-Key` header → `createTestDonation()` → `createOrReadDonation()` in ReadCommitted transaction; `PAYMENT_MODE !== "mock"` throws 503 |
| 9 | Receipt PDF download | **Complete** | `donate.tsx` Success → `downloadReceipt(receipt.id, downloadToken)` → `GET /api/receipts/:id.pdf` → `receiptPdf()` → PDFKit A4 with TEST/PREVIEW watermark, DEMO footer, donor/trust details; `isOwner/isAdmin/isTokenValid` auth gates |
| 10 | Donor history | **Complete** | `account.tsx` → `getMyDonations()` → `GET /api/donations/mine` → `listMyDonations(userId)` scoped to authenticated user; shows receipt numbers + PDF download buttons |
| 11 | Reports & Form 10BD | **Complete** | `ReportsSection` → `getAdminReportSummary()` → `GET /admin/reports/summary` → `getAdminReportSummary()` service (all-time stats, 12-month trends, campaign breakdown); `downloadForm10BdCsv(fy)` → `GET /admin/reports/form-10bd.csv?fy=YYYY-YY` with DEMO/TEST header on every line |
| 12 | Hindi/English switching | **Complete** | `i18n.tsx` `LangProvider` with localStorage persistence; `SiteShell.tsx` language toggle (हिंदी/English); 309+ bilingual `t({hi,en})` calls in admin.tsx alone; Hindi is default |
| 13 | Settings (banner + audit log) | **Complete** | `SettingsSection` → `getHomepageBanner()` on load → banner rendered on `index.tsx` homepage; `updateHomepageBanner()` on save; `getAuditLog(50)` → `GET /admin/settings/audit-log` → table with action, target, admin email, IST timestamp |

## Security verification

| Check | Status | Evidence |
|---|---|---|
| Admin APIs reject unauthorised users | **Verified** | All `/api/admin/*` routers apply `authenticate + requireRole(UserRole.ADMIN)`; 7 admin route files checked, all have 2 guard references each |
| No .env files committed | **Verified** | `git ls-files` shows only `.env.example` and `backend/.env.example` tracked; `.gitignore` excludes `.env`, `.env.*`, `backend/.env`, `backend/.env.*` |
| No real payment processed | **Verified** | `env.PAYMENT_MODE` is `z.enum(["mock"]).default("mock")` — only "mock" accepted; `createOrReadDonation` throws `503 PAYMENT_MODE_UNAVAILABLE` if not mock; all donations have `testMode: true` |
| Demo receipts marked TEST/DEMO | **Verified** | `receiptPdf()` renders "TEST / PREVIEW — NOT VALID FOR TAX CLAIMS" header and "DEMO DOCUMENT — DO NOT SUBMIT TO THE INCOME TAX DEPARTMENT" footer in red |
| Form 10BD exports marked DEMO | **Verified** | `buildForm10BdCsv()` writes "DEMO / TEST DATA — NOT FOR OFFICIAL FILING" on first line; every row has TEST MODE = YES column |
| PAN never exposed in full | **Verified** | `decryptPan()` only used inside `receiptPdf()` for PDF content; API responses return `donorPanLast4` only; admin UI masks as `••••1234` |
| JWT in HttpOnly cookie | **Verified** | `setSessionCookie()` uses `httpOnly: true, sameSite: "lax", path: "/api"`; no token in localStorage or response body |
| Rate limits on auth + AI | **Verified** | `authLimiter` (20 req/15min) on `/api/auth`; `aiLimiter` (12 req/min) on `/api/assistant` |
| Helmet + CORS | **Verified** | `app.use(helmet(...))` and `app.use(cors({origin: env.FRONTEND_ORIGIN, credentials: true}))` |
| Zod validation on all write endpoints | **Verified** | `validateBody()` applied to register, login, donation, createScheme, updateScheme, updateCampaign, assistant, banner schemas; all `.strict()` to reject unknown fields |
| Production env guards | **Verified** | `env.ts` throws if `JWT_SECRET` is placeholder, `PII_ENCRYPTION_KEY` not 64-hex, `COOKIE_SECURE` false, `FRONTEND_ORIGIN` not HTTPS, `ADMIN_PASSWORD` is demo, `TRUST_PAN` is placeholder |

| ID | Requirement | Current state | Evidence / limitation |
|---|---|---|---|
| A1 | Existing frontend inspection and map | **Implemented** | `docs/frontend-backend-map.md`; React/TanStack routes inspected |
| A2 | Separate TypeScript backend | **Typechecked: 0 errors** | `node_modules/.bin/tsc --noEmit -p backend/tsconfig.json` passes with strict mode, exactOptionalPropertyTypes, noUncheckedIndexedAccess |
| A3 | PostgreSQL + Prisma migrations | **Connected** | `prisma.$queryRaw\`SELECT 1\`` returns OK against Neon PostgreSQL (ap-southeast-1); Prisma client generated; migrations applied |
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
| A17 | Frontend and browser journeys | **TypeScript + build pass; browser untested** | `vite build` succeeds (client + SSR + Nitro); `vitest run` passes 4/4; browser end-to-end testing not performed |
| A18 | Security checks | **Source-reviewed** | JWT, HttpOnly cookie, ADMIN role guard, bcrypt, rate limits, Helmet, CORS, AES-256-GCM PAN encryption, timing-safe token comparison, strict Zod schemas, no committed real secrets |
| A19 | Frontend/backend production builds | **Both pass** | Frontend: `npm run build` (vite build) succeeds — 1913 client modules + 77 SSR modules + Nitro server; Backend: `npm run build:backend` (tsc -p backend/tsconfig.json) succeeds with 0 errors |
| A20 | Documentation | **Updated** | IMPLEMENTATION_STATUS.md, README.md, deployment.md updated to reflect all 8 admin checkpoints complete |

## Checks executed (final verification — 5 November 2026)

### Passed

| Command | Result |
|---|---|
| `node --experimental-strip-types --test backend/tests/*.test.mjs` | **121/121 pass, 0 fail** (6 test files: donation-helpers, eligibility, admin-donations, donor-records, receipt, reports) |
| `npx vitest run` | **4/4 pass, 0 fail** (2 test files: data.test.ts, app-routing.test.tsx) |
| `node_modules/.bin/tsc --noEmit -p tsconfig.json` (frontend) | **0 errors** (strict mode, exactOptionalPropertyTypes, noUncheckedIndexedAccess) |
| `node_modules/.bin/tsc --noEmit -p backend/tsconfig.json` (backend) | **0 errors** (same strict settings) |
| `npm run build` (frontend) | **Succeeded** — Vite build: 1913 client modules transformed, SSR + Nitro server built, `.output/` generated |
| `npm run build:backend` (backend) | **Succeeded** — `tsc -p backend/tsconfig.json` compiled with 0 errors |
| Database connectivity | **Connected OK** — `prisma.$queryRaw\`SELECT 1\`` returns OK against Neon PostgreSQL (ap-southeast-1) |
| Prisma client | **Generated** — `node_modules/.prisma/client/index.js` present |

### Not executed / not verified

- Browser end-to-end testing — not performed; no browser automation run. All journeys verified by code-level audit only.
- Load/concurrency test for 5,000 donations/day — not run; no load-test environment.
- Live Gemini test — not run; `GEMINI_API_KEY` is configured but live API call was not tested.
- PDF generation with Devanagari font — code path verified by unit tests; real PDF with Hindi text requires `PDF_FONT_PATH` to a Noto Sans Devanagari TTF (not configured in this environment).

## External blockers and required follow-up

1. ~~Install npm packages~~ — **Done.** `node_modules` present; all dependencies resolved.
2. ~~Provision PostgreSQL~~ — **Done.** Neon PostgreSQL connected; `DATABASE_URL` set in `backend/.env`; Prisma client generated and migrations applied.
3. Configure non-demo `JWT_SECRET`, `PII_ENCRYPTION_KEY`, `TRUST_PAN`, `TRUST_80G_REGISTRATION`, and secure cookie/CORS settings before production. — `JWT_SECRET` is set in `backend/.env`; `PII_ENCRYPTION_KEY` uses dev fallback; `TRUST_PAN` and `TRUST_80G_REGISTRATION` remain demo placeholders.
4. Obtain and configure a valid Gemini API key for live assistant tests. — `GEMINI_API_KEY` is set in `backend/.env`; live API call not tested.
5. Supply a Noto Sans Devanagari-compatible `.ttf` and set `PDF_FONT_PATH` before generating PDFs containing Devanagari donor names. — Not configured in this environment.
6. Have the trust verify official scheme source URLs, benefit rules, district coverage, document lists, application instructions, help-centre details, trust identity and actual 80G registration.
7. Provide the actual GitHub repository URL and deployed app URL; neither was supplied and no deployment was created here.
8. Browser end-to-end testing — not performed. All 13 user journeys verified by code-level audit only.

## Demo-only / intentionally cut scope

- Payment mode is mock only; no funds move and no card credentials are collected.
- Monthly donation is saved as a frequency/intention only; it does not create a recurring mandate or charge.
- Every PDF is visibly marked TEST / PREVIEW and not valid for tax claims.
- Trust PAN and 80G registration defaults are obvious demo placeholders. Do not represent them as real.
- Form 10BD export, donor messaging, SMS/email receipts, reminder scheduling, live payment gateway, FCRA flows, volunteer management, CSR/grant tracking and voice-based finder input are not implemented.
- AI summaries require official notice text, are draft-only until admin approval, and the assistant cannot decide eligibility.

## Next verification sequence (for a fresh reviewer)

```bash
# Dependencies are already installed in this workspace.
# backend/.env already exists with DATABASE_URL, JWT_SECRET, GEMINI_API_KEY set.

# 1. Regenerate Prisma client (if needed)
npm run db:generate

# 2. Apply migrations
npm run db:migrate

# 3. Seed demo data
npm run db:seed

# 4. Run backend tests (121 tests)
npm run test:backend

# 5. Run frontend tests (4 tests)
npm test

# 6. Typecheck both
node_modules/.bin/tsc --noEmit -p tsconfig.json        # frontend
cd backend && node_modules/.bin/tsc --noEmit -p tsconfig.json  # backend

# 7. Production builds
npm run build           # frontend (vite build)
npm run build:backend   # backend (tsc -p backend/tsconfig.json)

# 8. Start backend in terminal 1
npm run dev:backend

# 9. Start frontend in terminal 2
npm run dev

# 10. Open the URL printed by Vite and test every route
#     Sign in to /admin with admin@sakhisetu.test / SakhiDemo!2026
#     Register a donor at /account, make a test donation at /donate
#     Download the receipt PDF, check admin dashboard sections
```

### Demo sign-in

- Admin: `admin@sakhisetu.test` / `SakhiDemo!2026` (public demo credential, not a secret)
- Donor: register a new account at `/account`
