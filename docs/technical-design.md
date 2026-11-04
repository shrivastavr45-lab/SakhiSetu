# SakhiSetu — Technical Design Document

**Repository URL:** Not provided. Add the public GitHub URL before submission.  
**Live application URL:** Not deployed.  
**Client:** Company A, Bhopal (as described in the supplied brief).  
**Document status:** Design and implementation record for the submitted demo source; see `IMPLEMENTATION_STATUS.md` for verification boundaries.

## 1. Executive summary

SakhiSetu is a Hindi-first web application intended to help women in Madhya Pradesh discover welfare schemes and to let donors submit a donation in a short, testable workflow. The existing React/TanStack frontend has been retained and connected to a separate Express API designed around PostgreSQL and Prisma. Express routes delegate to dedicated controllers, which call the existing service layer; shared validation, authentication and error middleware handle request boundaries.

The implemented core slice covers public scheme discovery, a deterministic eligibility finder, scheme administration with an AI Hindi-summary draft/review step, simulated donations, donor account/history, and a downloadable receipt/80G preview PDF. It is a test-mode prototype, not a live fundraising or legally valid tax-certificate system. No real payment gateway or external donor messaging provider is connected.

## 2. Scope and requirements

### In-scope core build

- Public, Hindi-first home page led by scheme discovery.
- Scheme browse, filter and detail pages.
- Six-question eligibility flow with district/need preferences and understandable match rules.
- Admin interface for scheme content and campaign status/goal; drafts require review before publishing.
- Donation form with one-time and monthly-intention options, test payment outcomes and PAN capture.
- Donor registration/login, donation history and authorized receipt downloads.
- PDF receipt/80G preview with sequence-backed number allocation and prominent test warnings.
- AI-generated Hindi scheme-summary drafts based only on stored official notice text, subject to admin review.

### Deliberately limited or out of scope

Real payment rails, foreign contribution/FCRA payments, real recurring mandates, donor email/SMS, reminders, Form 10BD export, voice input, volunteer management, CSR/grant tracking and legal issuance of 80G certificates are not implemented in this phase.

## 3. Assumptions and source limitations

The implementation uses only the assignment and uploaded frontend sample data, and labels assumptions where the brief is incomplete.

| ID | Assumption / limitation | Treatment |
|---|---|---|
| AS-01 | The nine district names in the existing frontend are the demo districts. | Reused as demo configuration. The brief states nine districts but does not name them. Verify with the trust. |
| AS-02 | The three supplied example schemes apply across all nine configured demo districts. | Seeded with `districts: "all"`; marked as an assumption. Verify actual district coverage. |
| AS-03 | The assignment's three sample scheme benefits and eligibility statements are the only authoritative sample rules available. | Encoded as deterministic rule criteria; official sources/documents/steps were not supplied and are left blank. |
| AS-04 | Campaign cards in the supplied frontend can be retained to populate a demo donation journey. | Existing campaign titles/targets/raised totals/donor counts are seeded as illustrative, unverified data. They are not real fundraising records. |
| AS-05 | Admin seed account is required to demonstrate scheme review. | A local demo admin is seeded. Replace credentials before a real deployment; no public admin self-registration exists. |
| AS-06 | Test mode is sufficient for this implementation phase. | Payment outcomes are explicitly simulated; no card data or money movement. |
| AS-07 | A legal trust PAN and 80G registration number were not present in the brief. | Preview uses obvious placeholders. Production startup blocks while these remain placeholders. Preview PDFs are never represented as valid tax certificates. |
| AS-08 | Scheme information can be AI-summarized only if official notice text is supplied by an editor. | Draft generation is disabled until notice text exists; drafts need admin approval. |
| AS-09 | Monthly giving can be represented as an intent during the mock phase. | Monthly choice is stored as a frequency/intention; it does not create a recurring payment. |
| AS-10 | Scheme pages should not fabricate a helpline or help-centre address. | Missing contacts are not invented. The UI reports missing information until the trust supplies it. |

The brief contains an internal scope tension: it lists AI summaries/finder assistance in the user ask and core build, while also naming “AI or automation” under out-of-scope. This design treats the explicit core-build AI requirement as in-scope for the demo, while excluding the broader automation/reminder work. This assumption should be confirmed with the client.

## 4. Architecture

### Components

- **Web application:** React 19, TypeScript, TanStack Start/Router, Tailwind CSS 4 and existing Radix/shadcn-style components.
- **HTTP API:** Express 5 + TypeScript, separate `backend/` process, API prefix `/api`.
- **Database:** PostgreSQL, accessed through Prisma ORM and versioned SQL migration.
- **Authentication:** bcryptjs password hashes, JWT session cookie marked HttpOnly and SameSite=Lax, backend user/role lookup.
- **AI:** Google Gemini SDK invoked only by the backend. No key is delivered to the browser.
- **Documents:** PDFKit; Devanagari PDF output requires a configured Noto Sans Devanagari-compatible TTF font.
- **Validation/security:** Zod schemas, Helmet, CORS allowlist, rate limiting, role middleware, AES-256-GCM PAN encryption, centralized errors.

### Request path

1. Browser route renders the existing UI and calls functions in `src/lib/api.ts`.
2. Vite development proxy forwards `/api` to Express at port 4000.
3. Express middleware parses JSON/cookies, applies security headers/CORS and request limits.
4. Route middleware validates input and reads the current user/session when required.
5. Service modules perform domain logic and Prisma queries/transactions.
6. PostgreSQL persists durable entities; API maps records to existing frontend view models.
7. Frontend renders returned data and has loading/error/empty states. No success response is hardcoded into the API client.

### Why this architecture

The frontend already uses TanStack Start, React and TypeScript. Replacing it would risk losing the supplied design and interactions. A separate Express service is compatible with the specified stack while preserving the UI. Prisma supplies explicit schema/migration history, and PostgreSQL provides unique constraints and transactions needed for duplicate-safe donation processing and receipt numbers. The route/service separation keeps HTTP handling, validation and business rules distinct without introducing a microservice estate.

## 5. Data model

| Entity | Key fields | Purpose |
|---|---|---|
| `User` | ID, name, unique email, password hash, role | Donor/admin identity |
| `Scheme` | ID/code, bilingual content, need, eligibility/documents/steps/rules/districts JSON, source/last checked, publication and AI editorial state | Published scheme catalogue and admin drafts |
| `Campaign` | ID, bilingual title/story/impact, district, goal, demo seed totals, active | Campaign pages and contribution allocation |
| `Donation` | donor/user, campaign, amount/currency/frequency/status, encrypted PAN, idempotency key + request hash, test flag and payment reference | Durable test donation record |
| `PaymentTransaction` | donation ID, provider, status, test flag and detail JSON | Audit of the mock payment outcome |
| `Receipt` | donation ID, unique receipt number, access-token hash, generated time | Exactly one preview receipt per successful donation |
| `SiteSetting` | key, JSON value, updated time | Homepage notice and district configuration |

Monetary values use PostgreSQL `DECIMAL(14,2)` through Prisma `Decimal`. Receipt numbers are generated from a PostgreSQL sequence and protected by a unique index. Sequence values can have gaps after transaction failures; uniqueness and concurrency safety take priority over gapless numbering.

## 6. Main user flows

### 6.1 Scheme discovery

The landing page and scheme list request published rows from PostgreSQL. Search uses the Hindi/English names and summary/benefit fields; district filtering checks the stored district coverage. Scheme detail pages show eligibility, benefits, supplied documents/steps, source URL and last checked date. Missing sample information stays visibly unavailable rather than being invented.

### 6.2 Eligibility finder

The UI collects an age band, widow status, BPL-card status, SHG membership, pregnancy and first-child status, with need/district preference. Age bands are sent as ranges, not midpoints; when a band crosses an admin-defined age boundary, the result remains a possible match with an unanswered rule instead of assuming an exact age. The API evaluates the scheme's stored rules deterministically. An unknown answer produces a possible match with an `unansweredRules` list; a known contradiction removes the match. Result displays which criteria were applied. This finder is an information aid, not a government decision or eligibility guarantee. Gemini is not allowed to override the rule engine.

### 6.3 Admin scheme edit and review

An admin authenticates and can create/update/delete scheme records, edit bilingual copy, source and official notice text, rules and district coverage, and publish. AI summary generation reads the official notice text, stores a draft, and resets approval. An editor must approve or dismiss the draft. A scheme cannot be published while an AI draft remains pending review. Public APIs exclude unpublished schemes and editorial-only source text.

### 6.4 Donation and preview receipt

The donor selects a campaign, amount and frequency, then provides donor name, email and PAN. PAN is validated and encrypted before persistence. The API requires an `Idempotency-Key`, computes a request fingerprint and creates donation/payment rows in a PostgreSQL Read Committed transaction protected by unique idempotency and receipt constraints. A failed test result is stored as `FAILED` with no receipt. A successful test result creates one `Receipt` row and assigns a sequence-backed number. The PDF is generated from database values and marked TEST / PREVIEW; it explicitly says no funds were collected and it is not valid for tax claims.

Guest receipt download is protected by a high-entropy token derived server-side from the donation ID, idempotency key and JWT secret; only the token hash is stored. The same idempotent request can recover a stable token. Signed-in owners and admins can retrieve the associated receipt after authorization.

### 6.5 Donor history

A donor creates an account or signs in. The HttpOnly cookie is sent by the browser API client. The API uses the database user ID to scope donation history; the client cannot request arbitrary donor history. Each completed donation can link to its preview PDF.

## 7. Donation concurrency and receipt correctness

- `Donation.idempotencyKey` has a database unique constraint.
- A keyed HMAC request fingerprint prevents reusing one idempotency key with different donation data without storing an unkeyed digest of low-entropy personal fields such as PAN.
- User ownership is part of the idempotency check.
- Donation, mock payment and receipt are written within one Prisma Read Committed transaction; unique database constraints arbitrate duplicate idempotency keys and receipt ownership.
- The sequence-backed receipt number is allocated in PostgreSQL, not generated by browser timestamps.
- `Receipt.donationId` and `Receipt.receiptNumber` are both unique.
- P2002/P2034 collisions are resolved by returning the matching prior result or requiring the client to retry with the same key.
- The design has not been load-tested at the brief's campaign peak (5,000 donations in a few hours); staging load/concurrency tests and database capacity planning remain required.

## 8. AI design and failure handling

There are two server-side Gemini uses:

1. **Public question helper:** obtains up to 30 published scheme rows as context and instructs Gemini to answer in the selected language, use only supplied facts, avoid invented figures/URLs/helpline numbers, and never decide legal eligibility.
2. **Admin scheme summary draft:** requires official notice text, passes that text as untrusted source data, asks for a short plain Hindi summary and stores the output as an unapproved draft. An admin must review and approve it before it replaces the published summary.

The model is configured by backend environment variables. The request is rate-limited and has a 15-second application timeout. Missing API key, timeout, empty response and provider errors return controlled errors. A model response is not shown as an approved fact; source link and last-checked date remain visible. Live provider behavior has not been tested because no credential was supplied.

## 9. Security and privacy

- Passwords are bcrypt-hashed; raw passwords and hashes are not returned by API responses.
- Public registration always creates a DONOR; it cannot accept a role field.
- Every admin route checks the user role on the server.
- JWT cookies are HttpOnly, SameSite=Lax, scoped to `/api`, and have a TTL aligned to JWT expiry. HTTPS deployment must enable Secure cookies.
- Auth endpoints and AI endpoint are rate-limited.
- Zod rejects unknown fields on key write payloads and enforces field sizes/formats.
- CORS is restricted to configured frontend origin; Helmet is enabled; Express JSON body size is bounded.
- PAN is encrypted with AES-256-GCM using a dedicated 256-bit backend key; only last four digits are separately stored for display/audit use.
- Guest receipt download uses a separate token; receipt lookups require owner/admin/valid token.
- Environment files are ignored by Git and example files contain placeholders only.
- Scheme pages avoid ad trackers; no analytics/tracking SDK has been introduced.

This code does not by itself establish DPDP Act 2023 legal compliance. Before live use the trust must complete privacy notices/consent, purpose/retention controls, data-subject request and deletion workflows, processor/vendor contracts, incident response, security review and legal validation.

## 10. UI and design decisions

The supplied frontend's warm, minimal visual system is retained: warm terracotta/turmeric/cream/green palette, readable Devanagari copy, simple icons, white space, compact choice sets and responsive layouts. The implementation adds API loading/error/empty feedback using the existing component language rather than generating a replacement interface.

Key screens:

- **Home:** leads with schemes and the finder, supports quick need navigation and campaign entry points.
- **Finder:** short sequential questions reduce cognitive load; possible matches surface criteria and missing answers.
- **Scheme detail:** benefits, criteria, documents, steps, official source and check date are separated for scanability; unknown source material is not fabricated.
- **Donate:** one-time/monthly intent in a short form; the test-only condition is visible and PAN is requested because a preview document includes it.
- **Account:** authentication state, donation history and receipt links.
- **Admin:** bilingual scheme fields, rule/district editor and explicit AI draft approval/dismissal controls.

## 11. Seed data

The seed creates the three examples from the brief:

- `SCH-014` — State widow pension, widow aged 18–79 with BPL card, ₹600/month.
- `SCH-022` — Self-help group loan support, registered SHG member, loan up to ₹3 lakh at lower interest.
- `SCH-031` — Maternity cash benefit, pregnant woman expecting first child, ₹5,000 in instalments.

The three source URLs, source text, document lists, application steps and help-centre details are absent from the brief, so they are blank until an editor supplies them. Existing frontend campaign content is seeded for demonstration and clearly treated as illustrative, not as actual donor/fundraising data.

## 12. Verification status

At the time of this document:

- Fourteen pure unit tests passed: nine deterministic eligibility tests and five donation-helper tests covering request fingerprints and Indian financial-year/receipt-number formatting.
- A TypeScript transpile-only syntax check covered 105 `.ts`/`.tsx` files and reported no syntax diagnostics. This is not a semantic typecheck or a production build.
- Dependency installation timed out at the package registry.
- PostgreSQL, Docker and psql were not available.
- Full typecheck/build, Prisma validation/client generation/migrations, database/API integration tests, PDF execution, browser journeys, Gemini live checks and load tests were not run.

See `IMPLEMENTATION_STATUS.md` for the exact command evidence and blockers. The verified local unit-test count is 14 (nine eligibility and five donation-helper tests); the database-backed flows and full builds remain unverified until dependencies and PostgreSQL are available. Do not interpret syntax transpilation as a TypeScript typecheck or production build.

## 13. What was cut and next steps

**Cut from this core build:** real payment gateway, FCRA/foreign payment support, actual monthly recurring mandates, Form 10BD export, email/SMS receipts, reminders, voice input, volunteer management, CSR/grant tracking and broader CMS page builder.

**Next:** deploy staging Postgres, install dependencies, run migrations and complete all automated tests; run browser end-to-end journeys; conduct 5,000-in-few-hours donation load test; test failure/retry behavior; configure and validate the PDF font; obtain verified trust and scheme information; add Form 10BD export and notifications; complete DPDP/legal review; create the public GitHub repository and live deployment URL; preserve the commit history.
