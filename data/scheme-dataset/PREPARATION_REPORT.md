# Data Preparation Report — SakhiSetu MP Schemes

**Date:** 6/11/2026
**Input:** gov_myscheme_data.csv (original, unmodified — 15.08 MB)
**Output:** sakhisetu_mp_schemes.csv (5687.2 KB, 589 rows)
**Attribution:** Aryan-Pardeshi/gov-myscheme-dataset (Apache-2.0). Community extraction from myscheme.gov.in. Not an official government release.

---

## 1. Row counts

| Stage | Count |
|---|---|
| Original CSV (all schemes) | 2066 |
| Central Government (kept — nationally applicable) | 527 |
| Madhya Pradesh state/UT (kept) | 62 |
| After filtering | 589 |
| Exact slug duplicates removed | 0 |
| **Cleaned CSV (final)** | **589** |

## 2. Level distribution in cleaned CSV

| Level | Count |
|---|---|
| Central Government | 527 |
| State Government (normalised from "State / UT Government") | 62 |
| Other / unresolved | 0 |



## 3. Normalisation applied

- UTF-8 BOM stripped from input.
- "State / UT Government" → "State Government" (62 rows affected).
- No other data was modified; all original text fields are preserved verbatim.

## 4. Exact duplicates removed

None.

## 5. Near-duplicate name pairs (Levenshtein ≤ 3, detection only — NOT merged)

| Row A | Name A | Row B | Name B | Distance |
|---|---|---|---|---|
| 142 | ICAR Junior Research Fellowship For Post-Graduate Studies In Agricultural Sciences | 146 | ICAR Senior Research Fellowship For Post-Graduate Studies In Agricultural Sciences | 2 |
| 144 | ICAR - Post Matric Scholarship For Scheduled Caste / Scheduled Tribes Candidates | 145 | ICAR Post Matric Scholarship For Scheduled Caste / Scheduled Tribes Candidates | 2 |
| 340 | PM-YASASVI: Post-Matric Scholarship for OBC, EBC and DNT Students | 381 | PM-YASASVI: Pre-Matric Scholarship for OBC, EBC and DNT Students | 3 |
| 385 | Post Matric Scholarship For Minorities | 392 | Pre Matric Scholarship For Minorities | 3 |
| 523 | Women Scientist Scheme-A | 524 | Women Scientist Scheme-B | 1 |
| 523 | Women Scientist Scheme-A | 525 | Women Scientist Scheme-C | 1 |
| 524 | Women Scientist Scheme-B | 525 | Women Scientist Scheme-C | 1 |

## 6. Data quality in cleaned CSV

| Field | Missing count | Missing % |
|---|---|---|
| Official Link (invalid/missing URL) | 0 | 0.0% |
| MyScheme URL (invalid/missing) | 0 | 0.0% |
| All eligibility text | 1 | 0.2% |
| Benefits | 0 | 0.0% |
| Documents Required | 3 | 0.5% |
| Tags / Categories | 1 | 0.2% |

## 7. Dry-run import validation (no database writes)

Runs each row through the SakhiSetu import validation logic (mapCsvRow + validateRow).

| Status | Count | % |
|---|---|---|
| Fully valid | 585 | 99.3% |
| Warnings only (missing URL/eligibility/docs, or Level not mapped) | 4 | 0.7% |
| Invalid (bad scheme name) | 0 | 0.0% |

### No invalid rows.

### Sample warnings (first 5 rows with warnings)

- Row 229: **Market Research Information Network** — No eligibility text
- Row 356: **Pradhan Mantri Jeevan Jyoti Bima Yojana** — No documents listed
- Row 366: **Pradhan Mantri Suraksha Bima Yojana** — No documents listed
- Row 413: **Rashtriya Krishi Vikas Yojana** — No documents listed

## 8. File output

| Property | Value |
|---|---|
| Path | data/scheme-dataset/sakhisetu_mp_schemes.csv |
| Size | 5687.2 KB |
| Rows | 589 |
| Columns | 16 (original 16) |
| Encoding | UTF-8 (no BOM) |
| Line endings | CRLF (RFC-4180) |
| Suitable for SakhiSetu importer | Yes — within 5 MB limit and 3,000-row limit |

## 9. Remaining known limitations

1. **Level validator mismatch (resolved in this checkpoint):** The Zod validator in `createSchemeSchema` has been updated to accept `"State Government"` matching the normalised value produced here.
2. **Hindi translations:** All text fields are English-only. Admin must fill Hindi fields or use the AI draft workflow after import.
3. **Eligibility rules JSON:** Always `{}` after import — admin must encode structured rules manually using the SchemeModal.
4. **Community extraction:** Every scheme must be verified against its Official Link before publishing. The `lastCheckedAt` field will be set to the import date.

## 10. How to import

```
1. Go to Admin → योजना प्रबंधन (Scheme Management)
2. Click "Import CSV" button
3. Upload: data/scheme-dataset/sakhisetu_mp_schemes.csv
4. Review the preview (589 rows)
5. Confirm import
6. Review each imported draft and publish after verification
```
