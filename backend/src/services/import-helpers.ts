/**
 * Pure helper functions for the scheme CSV import pipeline.
 * No database, no environment variables — safe to import in unit tests.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ImportSummary = {
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  errors: Array<{ row: number; reason: string }>;
};

export type CsvRow = Record<string, string>;

// ---------------------------------------------------------------------------
// Column header normalisation
// ---------------------------------------------------------------------------

/** Normalise a raw CSV header to a consistent lowercase trimmed key. */
function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

/** Map of normalised header → canonical camelCase field key used throughout the service. */
const HEADER_MAP: Record<string, string> = {
  scheme_name:                "schemeName",
  scheme_slug:                "schemeSlug",
  level:                      "level",
  state___ut___ministry:      "ministry",
  state_ut_ministry:          "ministry",
  state___ut__ministry:       "ministry",
  application_mode:           "applicationMode",
  tags___categories:          "tags",
  tags__categories:           "tags",
  description:                "description",
  eligibility_criteria:       "eligibilityCriteria",
  eligibility__general_:      "eligibilityGeneral",
  eligibility__general:       "eligibilityGeneral",
  exclusions___ineligibility: "exclusions",
  exclusions__ineligibility:  "exclusions",
  benefits:                   "benefits",
  application_process:        "applicationProcess",
  documents_required:         "documentsRequired",
  frequently_asked_questions: "faqs",
  official_link:              "officialLink",
  myscheme_url:               "myschemeUrl",
};

function mapHeader(raw: string): string {
  const norm = normaliseHeader(raw);
  return HEADER_MAP[norm] ?? norm;
}

// ---------------------------------------------------------------------------
// CSV parser (no external dependency, RFC-4180 compliant for common cases)
// ---------------------------------------------------------------------------

/**
 * Splits one CSV line into fields, honouring RFC-4180 quoting rules.
 * Handles embedded commas in quoted fields and escaped double-quotes (two
 * consecutive double-quotes → one literal double-quote).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      i++;
      let val = "";
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') { val += '"'; i += 2; }
          else { i++; break; }
        } else {
          val += line[i++];
        }
      }
      fields.push(val);
      if (line[i] === ",") i++;
    } else {
      const start = i;
      while (i < line.length && line[i] !== ",") i++;
      fields.push(line.slice(start, i));
      if (i < line.length) i++;
    }
  }
  return fields;
}

/**
 * Parse a raw CSV string into header-keyed row objects.
 * Returns canonical field keys (via HEADER_MAP) so consumers are decoupled
 * from the physical column order.
 *
 * Uses a character-level RFC-4180 state machine so embedded newlines inside
 * quoted fields are handled correctly. The previous line-split approach
 * (text.split(/\r?\n/)) destroyed multi-line fields and caused RangeError
 * crashes when a fragment line was passed to splitCsvLine.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const src = text.startsWith("\uFEFF") ? text.slice(1) : text;
  if (!src.trim()) return { headers: [], rows: [] };

  // Build all logical rows using a state machine that tracks whether we are
  // inside a quoted field — never splits on newlines while inQuotes is true.
  const allRows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else { inQuotes = false; }                         // closing quote
      } else {
        field += ch;                                       // char inside quoted field (may be \n)
      }
    } else {
      if (ch === '"')  { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); allRows.push(row); row = []; field = ""; }
      else if (ch !== '\r') { field += ch; }
    }
  }
  // Flush last field / row
  if (field || row.length > 0) { row.push(field); allRows.push(row); }

  if (allRows.length === 0) return { headers: [], rows: [] };

  const rawHeaders = allRows[0] ?? [];
  const headers = rawHeaders.map(mapHeader);
  const rows: CsvRow[] = [];

  for (let li = 1; li < allRows.length; li++) {
    const values = allRows[li] ?? [];
    if (!values.some((v) => v.trim())) continue; // skip blank rows
    const row: CsvRow = {};
    for (let hi = 0; hi < headers.length; hi++) {
      row[headers[hi] ?? `col_${hi}`] = values[hi]?.trim() ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Tag → Need category mapping
// ---------------------------------------------------------------------------

export type Need = "money" | "health" | "work" | "education" | "housing";

const NEED_KEYWORDS: Array<{ need: Need; keywords: string[] }> = [
  {
    need: "education",
    keywords: ["education", "scholarship", "student", "school", "college", "girl child", "beti", "literacy"],
  },
  {
    need: "health",
    keywords: ["health", "medical", "hospital", "maternity", "nutrition", "ayushman", "anemia", "vaccination"],
  },
  {
    need: "work",
    keywords: ["employment", "livelihood", "skill", "shg", "entrepreneur", "msme", "business", "labour", "training", "weaver", "self-help", "self help", "startup", "craftsman"],
  },
  {
    need: "housing",
    keywords: ["housing", "house", "gas", "lpg", "electricity", "water", "toilet", "ration", "pds", "awas", "grih"],
  },
  {
    need: "money",
    keywords: ["pension", "financial", "cash", "dbt", "assistance", "social welfare", "welfare", "insurance", "relief", "aid", "subsidy", "allowance", "grant", "compensation"],
  },
];

export function inferNeed(tags: string): Need {
  const lower = tags.toLowerCase();
  for (const { need, keywords } of NEED_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return need;
  }
  return "money"; // safe default — most welfare schemes involve financial assistance
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function trunc(s: string, max: number): string {
  return s.trim().slice(0, max);
}

/** Split newline-separated text into bilingual rows ({hi: "", en: line}). */
function splitLines(text: string, maxItems: number, maxLen: number): Array<{ hi: string; en: string }> {
  return text
    .split(/\n|\\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, maxItems)
    .map((line) => ({ hi: "", en: trunc(line, maxLen) }));
}

/** Validate and sanitise a URL; returns the URL string or null. */
export function sanitiseUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return s.slice(0, 2048);
  } catch {
    return null;
  }
}

/** Normalise a scheme name for duplicate checking. */
export function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Single-row mapping (CSV row → create-scheme input shape)
// ---------------------------------------------------------------------------

export type MappedRow = {
  nameEn: string;
  nameHi: string;
  deptEn: string;
  deptHi: string;
  need: Need;
  level: "Central Government" | "State Government" | null;
  myschemeSlug: string | null;
  myschemeUrl: string | null;
  sourceUrl: string | null;
  shortEn: string;
  shortHi: string;
  benefitEn: string;
  benefitHi: string;
  eligibility: Array<{ hi: string; en: string }>;
  documents: Array<{ hi: string; en: string }>;
  steps: Array<{ hi: string; en: string }>;
  officialNoticeText: string | null;
};

export function mapCsvRow(row: CsvRow): MappedRow {
  // Merge general qualifications + full eligibility criteria
  const combinedEligibility = [row["eligibilityGeneral"] ?? "", row["eligibilityCriteria"] ?? ""]
    .filter(Boolean)
    .join("\n");

  // Exclusions stored as officialNoticeText for admin reference
  const exclusions = (row["exclusions"] ?? "").trim();
  const officialNoticeText = exclusions
    ? `Exclusions / Ineligibility (from import source):\n${exclusions.slice(0, 29950)}`
    : null;

  const rawLevel = (row["level"] ?? "").trim();
  const level: "Central Government" | "State Government" | null =
    rawLevel === "Central Government"    ? "Central Government"
    : rawLevel === "State Government"    ? "State Government"
    : rawLevel === "State / UT Government" ? "State Government"
    : null;

  const rawSlug = (row["schemeSlug"] ?? "").trim().toLowerCase();

  return {
    nameEn: trunc(row["schemeName"] ?? "", 180),
    nameHi: "",    // admin fills or AI draft workflow
    deptEn: trunc(row["ministry"] ?? "", 180),
    deptHi: "",
    need: inferNeed(row["tags"] ?? ""),
    level,
    myschemeSlug:  rawSlug || null,
    myschemeUrl:   sanitiseUrl(row["myschemeUrl"] ?? ""),
    sourceUrl:     sanitiseUrl(row["officialLink"] ?? ""),
    shortEn:       trunc(row["description"] ?? "", 1000),
    shortHi:       "",
    benefitEn:     trunc(row["benefits"] ?? "", 1000),
    benefitHi:     "",
    eligibility:   splitLines(combinedEligibility, 30, 500),
    documents:     splitLines(row["documentsRequired"] ?? "", 30, 200),
    steps:         splitLines(row["applicationProcess"] ?? "", 30, 500),
    officialNoticeText,
  };
}

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

export type RowValidationResult =
  | { ok: true; mapped: MappedRow }
  | { ok: false; reason: string };

export function validateRow(row: CsvRow, _rowNumber: number): RowValidationResult {
  const nameEn = (row["schemeName"] ?? "").trim();
  if (!nameEn || nameEn.length < 2) {
    return { ok: false, reason: "Scheme Name is missing or too short (min 2 characters)." };
  }
  if (nameEn.length > 180) {
    return { ok: false, reason: `Scheme Name exceeds 180 characters (got ${nameEn.length}).` };
  }
  return { ok: true, mapped: mapCsvRow(row) };
}

// ---------------------------------------------------------------------------
// Limits (exported so controller and tests can reference the same values)
// ---------------------------------------------------------------------------

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — large enough for the cleaned MP dataset (~5.6 MB)
export const IMPORT_MAX_ROWS  = 3_000;
