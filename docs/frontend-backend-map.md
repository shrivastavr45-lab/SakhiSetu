# SakhiSetu frontend-to-backend map

This map records the actual React/TanStack routes and their backend contracts. The route paths and API names below match the current source tree. All paths are relative to the API base URL (`/api` by default).

## Runtime boundary

- Frontend: React 19 + TypeScript + TanStack Start/Router, Tailwind CSS 4.
- API: Express 5 + TypeScript, mounted at `/api`; route modules delegate to request/response controllers and reusable services.
- Persistence: PostgreSQL via Prisma.
- The browser uses `src/lib/api.ts` as its centralized API client. Requests include cookies (`credentials: include`).
- In development, Vite proxies `/api` to `http://localhost:4000` (override with `API_PROXY_TARGET`).

## Route and screen mapping

| Frontend route / component | Existing interaction | API endpoint(s) | Persistent data | Authentication |
|---|---|---|---|---|
| `/` — `src/routes/index.tsx` | Hindi-first landing page; current schemes, campaigns, homepage notice | `GET /schemes`, `GET /campaigns`, `GET /settings/homepage-banner` | `Scheme`, `Campaign`, `SiteSetting` | Public |
| `/finder` — `src/routes/finder.tsx` | Six profile questions, need/district preference, possible scheme matches, Hindi/English typed assistant question | `POST /eligibility`, `POST /assistant` | Published `Scheme` records; assistant uses published scheme context | Public; assistant rate-limited |
| `/schemes` — `src/routes/schemes.index.tsx` | Scheme list, text query and district filter | `GET /schemes?q=&district=&need=` | Published `Scheme` records | Public |
| `/schemes/$id` — `src/routes/schemes.$id.tsx` | Individual scheme details, benefits, criteria, documents, steps, source and last-checked information | `GET /schemes/:id` | `Scheme` | Public |
| `/donate` — `src/routes/donate.tsx` | Campaign choice, one-time/monthly intent, amount, donor name/email/PAN, test payment, preview PDF download | `GET /campaigns`, `POST /donations`, `GET /receipts/:id.pdf` | `Campaign`, `Donation`, `PaymentTransaction`, `Receipt` | Public or signed-in donor; receipt uses owner/admin access or one-time download token |
| `/account` — `src/routes/account.tsx` | Donor registration/login/logout, donation history and receipt downloads | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /donations/mine`, `GET /receipts/:id.pdf` | `User`, `Donation`, `Campaign`, `Receipt` | Public for sign-in; authenticated donor for history |
| `/admin` — `src/routes/admin.tsx` | Admin login; scheme CRUD; source/notice editing; AI draft/approve/dismiss; campaign status/goal; donation view; homepage banner | `GET /auth/me`, `POST /auth/login`, `POST /auth/logout`, `GET/POST /admin/schemes`, `PATCH/DELETE /admin/schemes/:id`, `PATCH /admin/campaigns/:id`, `GET /admin/campaigns`, `GET /admin/donations`, `POST /admin/ai/schemes/:id/summary-draft`, `POST /admin/ai/schemes/:id/summary-approve`, `POST /admin/ai/schemes/:id/summary-dismiss`, `PUT /admin/settings/homepage-banner` | `User`, `Scheme`, `Campaign`, `Donation`, `SiteSetting` | Admin only; role is checked by API middleware |

## API endpoint inventory

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `GET` | `/health` | Readiness check including PostgreSQL connectivity | Public |
| `POST` | `/auth/register` | Create a donor account and set HttpOnly session cookie | Public; rate-limited |
| `POST` | `/auth/login` | Verify credentials and set session cookie | Public; rate-limited |
| `POST` | `/auth/logout` | Clear session cookie | Public |
| `GET` | `/auth/me` | Return current session user | Authenticated |
| `GET` | `/schemes` | List/search/filter published schemes | Public |
| `GET` | `/schemes/:id` | Read one published scheme | Public |
| `POST` | `/eligibility` | Deterministic rule-based possible-match evaluation | Public |
| `GET` | `/campaigns` | List active campaigns | Public |
| `POST` | `/donations` | Create a simulated donation; requires `Idempotency-Key` | Public or authenticated donor |
| `GET` | `/donations/mine` | Current donor's donation history | Authenticated donor |
| `GET` | `/receipts/:id.pdf` | Download a test/preview PDF after authorization | Owner, admin, or valid download token |
| `POST` | `/assistant` | Ask the Gemini-backed Hindi/English assistant | Public; rate-limited |
| `GET` | `/settings/homepage-banner` | Read public homepage notice | Public |
| `GET` | `/admin/schemes` | List schemes including unpublished editorial fields | Admin |
| `POST` | `/admin/schemes` | Create an unpublished scheme | Admin |
| `PATCH` | `/admin/schemes/:id` | Update scheme fields / publish after editorial checks | Admin |
| `DELETE` | `/admin/schemes/:id` | Delete a scheme | Admin |
| `GET` | `/admin/campaigns` | List active and inactive campaigns | Admin |
| `PATCH` | `/admin/campaigns/:id` | Update campaign goal/active status | Admin |
| `GET` | `/admin/donations` | Read latest admin donation list | Admin |
| `POST` | `/admin/ai/schemes/:id/summary-draft` | Draft Hindi summary from stored official notice text | Admin |
| `POST` | `/admin/ai/schemes/:id/summary-approve` | Approve draft and apply as Hindi short summary | Admin |
| `POST` | `/admin/ai/schemes/:id/summary-dismiss` | Discard a draft | Admin |
| `PUT` | `/admin/settings/homepage-banner` | Update public homepage notice | Admin |

## Data contracts and integration notes

- Localized strings use `{ hi, en }` pairs, consistent with `src/lib/i18n.tsx` and the existing display model in `src/lib/data.ts`.
- Scheme districts are either the string `"all"` or an array of known district IDs. District coverage in seeded scheme rows is an explicitly labelled assumption, not confirmed programme geography.
- Eligibility returns a possible-match result, `rulesApplied`, `unansweredRules`, and a disclaimer. Age-band answers are represented as ranges, not midpoints; boundary-crossing age bands remain uncertain. This is not an approval or government eligibility decision.
- Donation creation returns `mode: "TEST"`. A failed simulated payment is persisted as `FAILED` and has no receipt. A successful simulated payment is persisted as `SUCCEEDED` and receives one receipt row.
- Donation requests carry an `Idempotency-Key`; its unique database constraint is the final duplicate guard. Donation, mock payment, and receipt rows are written in one transaction. Receipt numbers come from the migration-created PostgreSQL sequence, not a browser timestamp. Simulated/test donations do not increase campaign raised amounts or donor counts.
- The PDF endpoint is not a legally valid 80G issue flow. All generated documents are labelled TEST / PREVIEW and explicitly state that no funds were collected.
- `POST /assistant` now maps to Express router root `/` under the `/api/assistant` mount; this keeps it aligned with the frontend client path.

## Known UI-level limitations

- The assistant accepts typed questions. Speech input is not implemented.
- No real help-centre addresses or phone numbers were present in the brief or frontend data; none are fabricated.
- No scheme official source URLs, document checklists or application steps were supplied for the three sample schemes. Admin editors can enter them; until then the public detail page indicates the information is unavailable.
- The campaign seed rows retain illustrative figures that came from the provided frontend prototype. They are explicitly identified as demo data.
- There is no donor email/SMS delivery provider, scheduled reminder service, live payment gateway, Form 10BD export, or recurring payment scheduler in this core build.
