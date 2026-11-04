# SakhiSetu implementation status

**Snapshot:** 4 November 2026  
**Workspace:** `sakhi-scheme-spark-main`  
**Overall state:** Backend source and frontend integration are implemented in the workspace, including explicit controller modules. End-to-end acceptance is **not yet verified** because npm registry DNS resolution and PostgreSQL infrastructure were unavailable in this execution environment.

## Acceptance matrix

| ID | Requirement | Current state | Evidence / limitation |
|---|---|---|---|
| A1 | Existing frontend inspection and map | **Implemented** | `docs/frontend-backend-map.md`; React/TanStack routes inspected |
| A2 | Separate TypeScript backend | **Implemented, syntax-checked; build blocked** | `backend/package.json` now declares backend runtime/dev dependencies and scripts; Express app/server, environment/Prisma config, explicit controllers, endpoint routers, middleware and reused services exist. Registry DNS prevented dependency installation |
| A3 | PostgreSQL + Prisma migrations | **Implemented, not DB-verified** | `backend/prisma/schema.prisma`, SQL migration and seed exist; no PostgreSQL server/client available |
| A4 | Registration/login/JWT/bcrypt/authorization | **Implemented, not integration-tested** | Auth routes, bcrypt hashing, HttpOnly cookie, role lookup and API middleware; no DB available |
| A5 | Scheme listing/search/detail | **Implemented, not integration-tested** | Public scheme endpoints query Prisma-backed records |
| A6 | Deterministic eligibility | **Unit-tested** | Nine rule-engine tests pass; API/database integration not available |
| A7 | Admin operations | **Implemented, not integration-tested** | Role-protected scheme/campaign/donation/settings and AI review endpoints |
| A8 | Test-mode donations | **Implemented, not integration-tested** | Mock-only service; no actual funds/card details; DB unavailable |
| A9 | Idempotency and concurrency | **Implemented, not load-tested** | Unique idempotency key, keyed-HMAC request fingerprint, transactional donation/payment/receipt writes, PostgreSQL sequence-backed receipt allocation and duplicate conflict recovery under Read Committed; concurrency/load behaviour not exercised against PostgreSQL |
| A10 | PDF receipt / 80G preview | **Implemented, not runtime-tested** | PDFKit code and preview warning exist; PDFKit not installed; Devanagari needs configured font |
| A11 | Gemini integration | **Implemented, not live-tested** | Server-only SDK client, scheme-context prompting and controlled unavailable/error responses; no API key supplied |
| A12 | Frontend API integration | **Implemented, not browser-tested** | Central API client and route-level calls in `src/routes`; dependencies/browser unavailable |
| A13 | Persistent mock-data replacement | **Partially implemented** | Schemes, campaigns, finder results, donations and homepage banner now use APIs. Illustrative campaign seed values remain intentionally. Static public trust statistics remain based on the brief. |
| A14 | Input validation | **Implemented, not full-suite-tested** | Zod request schemas on backend; form-side constraints in the existing UI |
| A15 | Central error handling | **Implemented, not integration-tested** | Express async wrapper, malformed/oversized JSON handling, Prisma error mapping and centralized error middleware |
| A16 | Backend test suite | **Partially verified** | `node --experimental-strip-types --test backend/tests/*.test.mjs`: 14 passed, 0 failed. Coverage includes pure eligibility rules, idempotency request fingerprints and Indian financial-year/receipt-number formatting. Database transaction/concurrency behaviour is still not exercised. |
| A17 | Frontend and browser journeys | **Blocked** | `npm install` timed out; no `node_modules`, so Vitest/Playwright/browser checks could not run |
| A18 | Security checks | **Source-reviewed, not penetration-tested** | JWT, HttpOnly cookie, role checks, bcrypt, rate limits, Helmet, CORS, PAN encryption, strict request schemas, no committed real secrets. No security scan/penetration test ran. |
| A19 | Frontend/backend production builds | **Blocked** | Dependencies unavailable; a transpile-only syntax pass is not a build or typecheck |
| A20 | Documentation | **Implemented** | `README.md`, `backend/README.md`, `deployment.md`, `docs/frontend-backend-map.md`, `docs/technical-design.md`, this file |

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
