# SakhiSetu

Hindi-first scheme discovery and test-mode donation prototype for a charitable trust in Madhya Pradesh. The implemented core slice covers public scheme discovery, a deterministic eligibility finder, scheme administration with AI Hindi-summary draft/review, test-mode donations, donor account/history, receipt PDF downloads, an admin analytics dashboard with a Form 10BD demo CSV export, and a settings panel with banner editor and audit log. It is a test-mode prototype, not a live fundraising or legally valid tax-certificate system. No real payment gateway or external donor messaging provider is connected.

## Project layout

- `src/` — React 19 + TanStack Start frontend.
- `backend/` — Express 5 API, TypeScript services, Prisma schema, migration and seed data.
- `docs/frontend-backend-map.md` — routes/components mapped to API and persistence.
- `IMPLEMENTATION_STATUS.md` — implementation status, verification evidence and blockers.
- `deployment.md` — local setup, environment variables and demo sign-in.
- `docs/technical-design.md` — technical design source for the submitted TDD.

## Quick start

See [`deployment.md`](deployment.md) for complete instructions. You need Node.js 22.6+, npm, and a reachable PostgreSQL database. Install dependencies, create `backend/.env` from `backend/.env.example`, apply the Prisma migration, seed the database, then run the frontend and backend.

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

Start the services in separate terminals:

```bash
npm run dev:backend
npm run dev
```

## Important demo limitations

- Payments are simulated. No funds move; monthly donations are stored as an intention only.
- Every generated receipt / 80G document is labelled TEST / PREVIEW and is not legally valid or tax-deductible.
- Trust PAN and 80G registration values are placeholders until supplied and verified by the trust.
- The supplied brief does not include the three schemes' official URLs, documents, application steps or local help-centre addresses. Those fields are deliberately left blank instead of fabricated.
- Campaigns, their targets and starting totals are illustrative seed data from the provided frontend and must be verified/replaced by the trust.
- The nine district names and the assumption that the three sample schemes apply across all nine are carried over as demo assumptions; actual district coverage must be verified.
- Gemini features require a server-side API key. They return a controlled unavailable response when no key is configured.
- Devanagari receipt names require a Noto Sans Devanagari-compatible TTF configured through `PDF_FONT_PATH`.

This repository does not contain the original `.git` metadata because the input arrived as a ZIP. The original commit history therefore cannot be preserved in this workspace.
