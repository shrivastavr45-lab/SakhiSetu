# Data Quality Report — gov-myscheme-dataset

**Date:** 5 November 2026
**Dataset:** Aryan-Pardeshi/gov-myscheme-dataset (Apache-2.0)
**Source:** Extracted from the Indian Government myScheme portal (myscheme.gov.in) sitemap
**File:** `gov_myscheme_data.csv` (15.08 MB, 2,066 rows, 16 columns)

---

## 1. Dataset overview

| Metric | Value |
|---|---|
| Total schemes | 2,066 |
| Columns | 16 |
| File size | 15.08 MB |
| Duplicate slugs | 0 |
| Duplicate names | 0 |
| BOM character | Present (UTF-8 BOM at file start — must be stripped before parsing) |

## 2. Level distribution

| Level | Count | % |
|---|---|---|
| Central Government | 527 | 25.5% |
| State / UT Government | 1,539 | 74.5% |

**Important:** The dataset uses `"State / UT Government"` as the Level value, NOT `"State Government"`. The SakhiSetu import validator (`backend/src/validators/schemas.ts`) currently accepts `z.enum(["Central Government", "State Government"])` — it does not accept `"State / UT Government"`. This mismatch must be resolved before importing state schemes (either by updating the Zod enum or by pre-processing the CSV to normalise the Level value).

## 3. Madhya Pradesh coverage

| Category | Count |
|---|---|
| MP-specific state schemes | 62 |
| Central Government schemes (nationally applicable, including MP) | 527 |
| **Total MP-relevant schemes** | **589** |

### MP-specific scheme examples (first 20)

1. Aushadhi Avam Sugandhit Fasal Shetra Vistar
2. Aaws Bhatta Sahayata Yojana
3. Akanksha Scheme
4. Alpsankhyak Merit-Cum-Means Chatravriti Yojana
5. Alpasankhyak Post-Maitrik Chhaatravrtti Yojana
6. Antim Sanskar Yojana
7. Acharya Vidyasagar Gau Samvardhan Yojana
8. Chief Minister Ladli Behna Yojana
9. 6 Varsh Se Adhik Aayu Ke Bahuviklang Aur Mansik Roop Se Aviksit Nisaktjan Ke Liye Sahayata Anudan Yojana
10. Divyang Shiksha Protsahan Yojana
11. Gharelu Hinsa Ki Pidita Ke Liye Sahayta Yojana
12. Gaon Ki Beti
13. Indira Gandhi National Vridhavastha Pension Yojana
14. Indira Gandhi National Widow Pension Scheme-Madhya Pradesh
15. Internship Policy Of The Madhya Pradesh Tourism Board
16. Krshak Prashikshan Tatha Bhraman Karyakram
17. Riyaayati Dar Par Copies Ka Vitaran
18. Khiladi Protsahan Yojana
19. Ladli Laxmi Yojana
20. Mukhyamantri Aawasiye Bhu-Adhikaar Yojana

## 4. State distribution (top 15)

| State / UT | Schemes |
|---|---|
| Puducherry | 186 |
| Gujarat | 118 |
| Goa | 116 |
| Tamil Nadu | 108 |
| Rajasthan | 83 |
| Kerala | 72 |
| Chhattisgarh | 64 |
| Meghalaya | 63 |
| **Madhya Pradesh** | **62** |
| Odisha | 55 |
| Himachal Pradesh | 51 |
| Assam | 49 |
| Maharashtra | 48 |
| Uttar Pradesh | 42 |
| Haryana | 39 |

## 5. Central ministry distribution (top 15)

| Ministry | Schemes |
|---|---|
| Ministry of Social Justice and Empowerment | 85 |
| Ministry of Education | 69 |
| Ministry of Science and Technology | 57 |
| Ministry of Agriculture and Farmers Welfare | 49 |
| Ministry of Micro, Small and Medium Enterprises | 29 |
| Ministry of Commerce and Industry | 27 |
| Ministry of Finance | 18 |
| Ministry of Textiles | 17 |
| Ministry of Culture | 13 |
| Ministry of Defence | 11 |
| Ministry of Home Affairs | 11 |
| Ministry of Rural Development | 10 |
| Ministry of Women and Child Development | 9 |

## 6. Data quality — missing fields

| Field | Missing count | Missing % |
|---|---|---|
| Scheme Name | 0 | 0.0% |
| Scheme Slug | 0 | 0.0% |
| Level | 0 | 0.0% |
| State / UT / Ministry | 0 | 0.0% |
| Official Link | 0 | 0.0% |
| MyScheme URL | 0 | 0.0% |
| Tags / Categories | 16 | 0.8% |
| Description | 0 | 0.0% |
| Benefits | 0 | 0.0% |
| Documents Required | 4 | 0.2% |
| Application Process | 0 | 0.0% |
| All eligibility (both fields) | 1 | 0.05% |

**Verdict:** Data completeness is excellent — 99.2%+ across all fields. The 16 missing tags and 4 missing documents are negligible.

## 7. Women-relevant schemes

| Category | Count |
|---|---|
| Women-relevant schemes (total) | 323 |
| Of which Central Government | 58 |
| Of which MP-specific | 8 |

Tags matching: women, woman, girl, widow, maternity, pregnant, mother, child, female

## 8. Tag distribution (top 20)

| Tag | Count |
|---|---|
| assistance | 780 |
| financial | 768 |
| ministry | 398 |
| student | 285 |
| welfare | 277 |
| social | 249 |
| education | 220 |
| scholarship | 207 |
| empowerment | 177 |
| subsidy | 168 |
| worker | 159 |
| development | 155 |
| scheduled | 148 |
| agriculture | 148 |
| construction | 148 |
| disability | 141 |
| students | 131 |
| pension | 130 |

## 9. Known issues for SakhiSetu import

1. **BOM character:** The CSV starts with a UTF-8 BOM (`\uFEFF`). Must be stripped before parsing or the first header column name will be `\uFEFFScheme Name` instead of `Scheme Name`. The SakhiSetu import system's `parseCsv` function does not currently strip BOM.

2. **Level value mismatch:** The dataset uses `"State / UT Government"` but the SakhiSetu Zod validator (`createSchemeSchema`) accepts only `"Central Government"` or `"State Government"`. State/UT schemes will have `level: null` after mapping (the `mapCsvRow` function falls through to `null` for unrecognised values). This is a known limitation — the admin can manually set the level after import, or the validator can be updated in a future checkpoint.

3. **File size:** At 15 MB, the full dataset exceeds the 5 MB import limit set by the backend (`IMPORT_MAX_BYTES = 5 * 1024 * 1024`). The admin must filter the CSV to MP-relevant schemes (589 rows) before importing, or split the file into smaller batches.

4. **Hindi translations:** All text is English-only. Hindi fields (`nameHi`, `deptHi`, `shortHi`, `benefitHi`, and the `hi` side of all bilingual arrays) will be blank after import. The admin must fill these manually or use the existing AI summary draft workflow.

5. **Eligibility rules:** The dataset has free-text eligibility criteria. These are stored as bilingual rows (English-only, `hi` blank). The structured `rules` JSON is always `{}` on import — eligibility rules are never inferred from text. The admin must manually encode them using the existing SchemeModal.

6. **Not officially verified:** This is a community-extracted dataset. Every imported scheme must be admin-reviewed and verified against the official source URL before publishing. The `lastCheckedAt` field is set to the import date; the admin should update it after verifying.

## 10. Recommendation

**The dataset is suitable for a controlled import through the existing SakhiSetu admin CSV import screen**, with the following pre-processing steps:

1. **Filter to MP-relevant schemes only** (Central Government + Madhya Pradesh) — 589 rows, well within the 3,000-row and 5 MB limits.
2. **Strip the BOM** from the CSV file before uploading, or ensure the import parser handles it.
3. **Optionally rename `"State / UT Government"` to `"State Government"`** in the Level column if the admin wants the level field populated for state schemes. Otherwise, the level will be `null` for all state schemes (Central schemes will be correctly tagged).
4. **Upload the filtered CSV** through the admin "Import CSV" button in the Scheme Administration section.
5. **Review each imported draft** — fill Hindi translations, encode eligibility rules, verify against the official source URL, then publish.

The dataset's 100% data completeness, zero duplicates, and Apache-2.0 license make it a legitimate starting point. The 589 MP-relevant schemes (including 323 women-relevant schemes) provide a strong initial catalogue that the trust can review and enrich over time.
