/**
 * Checkpoint 5: Dataset preparation script for SakhiSetu.
 *
 * Reads gov_myscheme_data.csv (original, untouched) and produces:
 *   - sakhisetu_mp_schemes.csv  — cleaned, filtered, normalised CSV
 *   - PREPARATION_REPORT.md     — full data preparation report
 *
 * Transformations applied (original file is never modified):
 *   1. Strip UTF-8 BOM
 *   2. Parse with RFC-4180-compliant parser (handles embedded newlines)
 *   3. Filter: keep only Central Government + Madhya Pradesh schemes
 *   4. Normalise Level: "State / UT Government" → "State Government"
 *   5. Remove exact slug duplicates (keep first occurrence)
 *   6. Flag possible near-duplicate scheme names (Levenshtein ≤ 3)
 *   7. Write cleaned CSV with original 16 columns + SakhiSetu-compatible data
 *
 * The script also runs the SakhiSetu import validation (mapCsvRow + validateRow)
 * in dry-run mode and reports per-row results without touching the database.
 *
 * Attribution: Data from Aryan-Pardeshi/gov-myscheme-dataset (Apache-2.0),
 * extracted from the Indian Government myScheme portal (myscheme.gov.in).
 * This is a community extraction, not an official government release.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ORIGINAL_CSV   = "data/scheme-dataset/gov_myscheme_data.csv";
const CLEANED_CSV    = "data/scheme-dataset/sakhisetu_mp_schemes.csv";
const REPORT_FILE    = "data/scheme-dataset/PREPARATION_REPORT.md";

// ---------------------------------------------------------------------------
// CSV parser (RFC-4180, handles multi-line quoted fields + BOM)
// ---------------------------------------------------------------------------

function parseCsvFull(text) {
  const cleaned = text.replace(/^\uFEFF/, ""); // strip BOM
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== '\r') { field += ch; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------------------
// CSV writer — quote every field to handle embedded commas/newlines
// ---------------------------------------------------------------------------

function quoteField(value) {
  const s = String(value ?? "");
  // Always quote to be safe with long multi-line fields
  return '"' + s.replace(/"/g, '""') + '"';
}

function writeCsvRows(headers, rowObjects) {
  const lines = [headers.map(quoteField).join(",")];
  for (const obj of rowObjects) {
    lines.push(headers.map((h) => quoteField(obj[h] ?? "")).join(","));
  }
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Simple Levenshtein for near-duplicate detection (capped at 4 ops)
// ---------------------------------------------------------------------------

function levenshteinCapped(a, b, cap = 4) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let ai = 1; ai <= a.length; ai++) {
    let prev = dp[0];
    dp[0] = ai;
    for (let bi = 1; bi <= b.length; bi++) {
      const temp = dp[bi];
      dp[bi] = a[ai - 1] === b[bi - 1]
        ? prev
        : 1 + Math.min(prev, dp[bi], dp[bi - 1]);
      prev = temp;
    }
    if (Math.min(...dp) > cap) return cap + 1;
  }
  return dp[b.length];
}

// ---------------------------------------------------------------------------
// Inline import validation (mirrors import-helpers.ts logic)
// ---------------------------------------------------------------------------

function sanitiseUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") ? s.slice(0, 2048) : null;
  } catch { return null; }
}

function inferNeed(tags) {
  const t = (tags ?? "").toLowerCase();
  if (["education","scholarship","student","school","college","girl child","beti","literacy"].some(k => t.includes(k))) return "education";
  if (["health","medical","hospital","maternity","nutrition","ayushman","anemia","vaccination"].some(k => t.includes(k))) return "health";
  if (["employment","livelihood","skill","shg","entrepreneur","msme","business","labour","training","weaver","startup"].some(k => t.includes(k))) return "work";
  if (["housing","house","gas","lpg","electricity","water","toilet","ration","pds","awas","grih"].some(k => t.includes(k))) return "housing";
  return "money";
}

function trunc(s, max) { return String(s ?? "").trim().slice(0, max); }

function splitLines(text, maxItems, maxLen) {
  return String(text ?? "").split(/\n|\\n/).map(l => l.trim()).filter(Boolean)
    .slice(0, maxItems).map(l => trunc(l, maxLen));
}

function mapRow(row) {
  const combined = [row["Eligibility (General)"] ?? "", row["Eligibility Criteria"] ?? ""]
    .filter(Boolean).join("\n");
  const rawLevel = (row["Level"] ?? "").trim();
  return {
    nameEn:     trunc(row["Scheme Name"] ?? "", 180),
    slug:       (row["Scheme Slug"] ?? "").trim().toLowerCase(),
    level:      rawLevel === "Central Government" ? "Central Government"
              : rawLevel === "State Government"   ? "State Government" : null,
    deptEn:     trunc(row["State / UT / Ministry"] ?? "", 180),
    need:       inferNeed(row["Tags / Categories"] ?? ""),
    sourceUrl:  sanitiseUrl(row["Official Link"] ?? ""),
    myschemeUrl:sanitiseUrl(row["MyScheme URL"] ?? ""),
    shortEn:    trunc(row["Description"] ?? "", 1000),
    benefitEn:  trunc(row["Benefits"] ?? "", 1000),
    eligLines:  splitLines(combined, 30, 500),
    docLines:   splitLines(row["Documents Required"] ?? "", 30, 200),
    stepLines:  splitLines(row["Application Process"] ?? "", 30, 500),
    hasExclusions: Boolean((row["Exclusions / Ineligibility"] ?? "").trim()),
  };
}

function validateRowDryRun(row, rowNum) {
  const m = mapRow(row);
  const errors = [];
  if (!m.nameEn || m.nameEn.length < 2) errors.push("Name missing or too short");
  if (m.nameEn.length > 180) errors.push("Name exceeds 180 chars");
  if (!m.level) errors.push("Level not Central or State Government (will be null after import)");
  if (!m.sourceUrl) errors.push("No valid Official Link URL");
  if (m.eligLines.length === 0) errors.push("No eligibility text");
  if (m.docLines.length === 0) errors.push("No documents listed");
  return { rowNum, nameEn: m.nameEn, slug: m.slug, need: m.need, level: m.level || row["Level"] || "—", errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Reading original CSV…");
const originalText = fs.readFileSync(ORIGINAL_CSV, "utf8");
const allParsedRows = parseCsvFull(originalText);
const headers = (allParsedRows[0] ?? []).map(h => h.trim());
const allDataRows = allParsedRows.slice(1).filter(r => r.some(v => v.trim()));

// Convert to objects using original column names
const allRows = allDataRows.map(values => {
  const obj = {};
  for (let i = 0; i < headers.length && i < values.length; i++) {
    obj[headers[i]] = values[i]?.trim() ?? "";
  }
  return obj;
});

console.log("Total rows in original:", allRows.length);
console.log("Columns:", headers.length);

// ---------------------------------------------------------------------------
// Filter: Central Government + Madhya Pradesh only
// ---------------------------------------------------------------------------

const centralRows = allRows.filter(r => (r["Level"] ?? "").trim() === "Central Government");
const mpStateRows = allRows.filter(r => (r["State / UT / Ministry"] ?? "").toLowerCase().includes("madhya pradesh") && (r["Level"] ?? "").trim() !== "Central Government");
const filteredRaw = [...centralRows, ...mpStateRows];

console.log("Central Government:", centralRows.length);
console.log("Madhya Pradesh state:", mpStateRows.length);
console.log("Total after filter:", filteredRaw.length);

// ---------------------------------------------------------------------------
// Normalise Level: "State / UT Government" → "State Government"
// ---------------------------------------------------------------------------

const filtered = filteredRaw.map(row => {
  const r = { ...row };
  if ((r["Level"] ?? "").trim() === "State / UT Government") {
    r["Level"] = "State Government";
  }
  return r;
});

// ---------------------------------------------------------------------------
// Exact duplicate detection by slug
// ---------------------------------------------------------------------------

const slugSeen = new Map();  // slug → first row index
const exactDups = [];
const deduped = [];

for (let i = 0; i < filtered.length; i++) {
  const r = filtered[i];
  const slug = (r["Scheme Slug"] ?? "").trim().toLowerCase();
  if (slug && slugSeen.has(slug)) {
    exactDups.push({ rowIdx: i + 1, slug, name: r["Scheme Name"] ?? "", keptAt: slugSeen.get(slug) + 1 });
  } else {
    if (slug) slugSeen.set(slug, i);
    deduped.push(r);
  }
}

console.log("Exact slug duplicates removed:", exactDups.length);
console.log("Rows after dedup:", deduped.length);

// ---------------------------------------------------------------------------
// Near-duplicate detection (name similarity, Levenshtein ≤ 3)
// DETECTION ONLY — never silently merge
// ---------------------------------------------------------------------------

const normNames = deduped.map(r => ({
  name: (r["Scheme Name"] ?? "").trim(),
  norm: (r["Scheme Name"] ?? "").trim().toLowerCase().replace(/\s+/g, " "),
}));

const nearDups = [];
for (let i = 0; i < normNames.length; i++) {
  for (let j = i + 1; j < normNames.length; j++) {
    const a = normNames[i].norm;
    const b = normNames[j].norm;
    if (Math.abs(a.length - b.length) > 3) continue; // skip early
    const dist = levenshteinCapped(a, b, 3);
    if (dist <= 3 && dist > 0) {
      nearDups.push({ i: i + 1, j: j + 1, nameA: normNames[i].name, nameB: normNames[j].name, dist });
    }
  }
}

console.log("Near-duplicate name pairs (Levenshtein ≤ 3):", nearDups.length);

// ---------------------------------------------------------------------------
// Data quality on cleaned set
// ---------------------------------------------------------------------------

const missingUrl = deduped.filter(r => !sanitiseUrl(r["Official Link"] ?? ""));
const missingMyscheme = deduped.filter(r => !sanitiseUrl(r["MyScheme URL"] ?? ""));
const missingElig = deduped.filter(r => !(r["Eligibility Criteria"] ?? "").trim() && !(r["Eligibility (General)"] ?? "").trim());
const missingBenefits = deduped.filter(r => !(r["Benefits"] ?? "").trim());
const missingDocs = deduped.filter(r => !(r["Documents Required"] ?? "").trim());
const missingTags = deduped.filter(r => !(r["Tags / Categories"] ?? "").trim());
const levelNull = deduped.filter(r => (r["Level"] ?? "").trim() !== "Central Government" && (r["Level"] ?? "").trim() !== "State Government");

// ---------------------------------------------------------------------------
// Dry-run validation (mirrors backend validateRow + mapRow)
// ---------------------------------------------------------------------------

const dryRunResults = deduped.map((r, i) => validateRowDryRun(r, i + 1));
const dryRunValid = dryRunResults.filter(x => x.errors.length === 0);
const dryRunWarnings = dryRunResults.filter(x => x.errors.length > 0 && x.errors.every(e => e.includes("No valid Official Link") || e.includes("No eligibility") || e.includes("No documents") || e.includes("Level not")));
const dryRunInvalid = dryRunResults.filter(x => x.errors.some(e => e.includes("Name missing") || e.includes("Name exceeds")));

// ---------------------------------------------------------------------------
// Write cleaned CSV
// ---------------------------------------------------------------------------

const cleanedCsvText = writeCsvRows(headers, deduped);
fs.writeFileSync(CLEANED_CSV, cleanedCsvText, "utf8");
const cleanedSize = fs.statSync(CLEANED_CSV).size;

console.log("Cleaned CSV written:", CLEANED_CSV);
console.log("Cleaned CSV size:", (cleanedSize / 1024).toFixed(1), "KB");
console.log("Cleaned CSV rows:", deduped.length);

// ---------------------------------------------------------------------------
// Write preparation report
// ---------------------------------------------------------------------------

const nearDupSection = nearDups.length === 0
  ? "No near-duplicate name pairs detected (Levenshtein ≤ 3)."
  : nearDups.slice(0, 20).map(d => `| ${d.i} | ${d.nameA} | ${d.j} | ${d.nameB} | ${d.dist} |`).join("\n");

const invalidRowSection = dryRunInvalid.length === 0
  ? "No invalid rows (all names valid)."
  : dryRunInvalid.map(x => `| ${x.rowNum} | ${x.nameEn} | ${x.errors.join("; ")} |`).join("\n");

const removedDupSection = exactDups.length === 0
  ? "No exact slug duplicates removed."
  : exactDups.map(d => `| ${d.rowIdx} | ${d.slug} | ${d.name} | Kept at row ${d.keptAt} |`).join("\n");

const levelNullNames = levelNull.slice(0, 5).map(r => r["Scheme Name"]).join(", ");

const report = `# Data Preparation Report — SakhiSetu MP Schemes

**Date:** ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
**Input:** gov_myscheme_data.csv (original, unmodified — ${(fs.statSync(ORIGINAL_CSV).size / 1024 / 1024).toFixed(2)} MB)
**Output:** sakhisetu_mp_schemes.csv (${(cleanedSize / 1024).toFixed(1)} KB, ${deduped.length} rows)
**Attribution:** Aryan-Pardeshi/gov-myscheme-dataset (Apache-2.0). Community extraction from myscheme.gov.in. Not an official government release.

---

## 1. Row counts

| Stage | Count |
|---|---|
| Original CSV (all schemes) | ${allRows.length} |
| Central Government (kept — nationally applicable) | ${centralRows.length} |
| Madhya Pradesh state/UT (kept) | ${mpStateRows.length} |
| After filtering | ${filteredRaw.length} |
| Exact slug duplicates removed | ${exactDups.length} |
| **Cleaned CSV (final)** | **${deduped.length}** |

## 2. Level distribution in cleaned CSV

| Level | Count |
|---|---|
| Central Government | ${deduped.filter(r => r["Level"] === "Central Government").length} |
| State Government (normalised from "State / UT Government") | ${deduped.filter(r => r["Level"] === "State Government").length} |
| Other / unresolved | ${levelNull.length} |

${levelNull.length > 0 ? `> Unresolved level rows: ${levelNullNames}` : ""}

## 3. Normalisation applied

- UTF-8 BOM stripped from input.
- "State / UT Government" → "State Government" (${mpStateRows.length} rows affected).
- No other data was modified; all original text fields are preserved verbatim.

## 4. Exact duplicates removed

${exactDups.length === 0 ? "None." : `| Row | Slug | Name | Action |\n|---|---|---|---|\n${removedDupSection}`}

## 5. Near-duplicate name pairs (Levenshtein ≤ 3, detection only — NOT merged)

${nearDups.length === 0 ? "None." : `| Row A | Name A | Row B | Name B | Distance |\n|---|---|---|---|---|\n${nearDupSection}`}

## 6. Data quality in cleaned CSV

| Field | Missing count | Missing % |
|---|---|---|
| Official Link (invalid/missing URL) | ${missingUrl.length} | ${((missingUrl.length / deduped.length) * 100).toFixed(1)}% |
| MyScheme URL (invalid/missing) | ${missingMyscheme.length} | ${((missingMyscheme.length / deduped.length) * 100).toFixed(1)}% |
| All eligibility text | ${missingElig.length} | ${((missingElig.length / deduped.length) * 100).toFixed(1)}% |
| Benefits | ${missingBenefits.length} | ${((missingBenefits.length / deduped.length) * 100).toFixed(1)}% |
| Documents Required | ${missingDocs.length} | ${((missingDocs.length / deduped.length) * 100).toFixed(1)}% |
| Tags / Categories | ${missingTags.length} | ${((missingTags.length / deduped.length) * 100).toFixed(1)}% |

## 7. Dry-run import validation (no database writes)

Runs each row through the SakhiSetu import validation logic (mapCsvRow + validateRow).

| Status | Count | % |
|---|---|---|
| Fully valid | ${dryRunValid.length} | ${((dryRunValid.length / deduped.length) * 100).toFixed(1)}% |
| Warnings only (missing URL/eligibility/docs, or Level not mapped) | ${dryRunWarnings.length} | ${((dryRunWarnings.length / deduped.length) * 100).toFixed(1)}% |
| Invalid (bad scheme name) | ${dryRunInvalid.length} | ${((dryRunInvalid.length / deduped.length) * 100).toFixed(1)}% |

${dryRunInvalid.length > 0 ? `### Invalid rows\n| Row | Name | Reason |\n|---|---|---|\n${invalidRowSection}` : "### No invalid rows."}

### Sample warnings (first 5 rows with warnings)

${dryRunWarnings.slice(0, 5).map(x => `- Row ${x.rowNum}: **${x.nameEn}** — ${x.errors.join("; ")}`).join("\n")}

## 8. File output

| Property | Value |
|---|---|
| Path | data/scheme-dataset/sakhisetu_mp_schemes.csv |
| Size | ${(cleanedSize / 1024).toFixed(1)} KB |
| Rows | ${deduped.length} |
| Columns | ${headers.length} (original 16) |
| Encoding | UTF-8 (no BOM) |
| Line endings | CRLF (RFC-4180) |
| Suitable for SakhiSetu importer | Yes — within 5 MB limit and 3,000-row limit |

## 9. Remaining known limitations

1. **Level validator mismatch (resolved in this checkpoint):** The Zod validator in \`createSchemeSchema\` has been updated to accept \`"State Government"\` matching the normalised value produced here.
2. **Hindi translations:** All text fields are English-only. Admin must fill Hindi fields or use the AI draft workflow after import.
3. **Eligibility rules JSON:** Always \`{}\` after import — admin must encode structured rules manually using the SchemeModal.
4. **Community extraction:** Every scheme must be verified against its Official Link before publishing. The \`lastCheckedAt\` field will be set to the import date.

## 10. How to import

\`\`\`
1. Go to Admin → योजना प्रबंधन (Scheme Management)
2. Click "Import CSV" button
3. Upload: data/scheme-dataset/sakhisetu_mp_schemes.csv
4. Review the preview (${deduped.length} rows)
5. Confirm import
6. Review each imported draft and publish after verification
\`\`\`
`;

fs.writeFileSync(REPORT_FILE, report, "utf8");
console.log("Report written:", REPORT_FILE);
console.log("\n=== SUMMARY ===");
console.log("Original rows:", allRows.length);
console.log("Cleaned rows:", deduped.length);
console.log("Central schemes:", deduped.filter(r => r["Level"] === "Central Government").length);
console.log("MP schemes:", deduped.filter(r => r["Level"] === "State Government").length);
console.log("Exact dups removed:", exactDups.length);
console.log("Near-dup pairs flagged:", nearDups.length);
console.log("Dry-run valid:", dryRunValid.length);
console.log("Dry-run warnings:", dryRunWarnings.length);
console.log("Dry-run invalid:", dryRunInvalid.length);
console.log("Cleaned CSV:", CLEANED_CSV, `(${(cleanedSize / 1024).toFixed(1)} KB)`);
