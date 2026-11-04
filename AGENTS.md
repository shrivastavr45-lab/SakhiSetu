<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All user-facing copy is bilingual `{hi, en}` objects rendered via `useLang().t()` (src/lib/i18n.tsx); Hindi is the default so the site stays Hindi-first.
- Frontend view-model types, district labels and display helpers live in src/lib/data.ts. Persistent scheme/campaign data is served by the Express API; eligibility rules are evaluated by backend/src/services/eligibility-rules.ts and covered by backend/tests/eligibility.test.mjs. The existing campaign constants are used only as illustrative seed input, not by public route rendering.
