/**
 * Data quality analysis script for the gov-myscheme-dataset CSV.
 * Uses a streaming approach that handles multi-line quoted fields.
 * Run: node data/scheme-dataset/analyze.mjs
 */
import fs from "node:fs";

const csvPath = "data/scheme-dataset/gov_myscheme_data.csv";
const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""); // strip BOM

// Proper CSV parser that handles embedded newlines in quoted fields
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        // skip CR
      } else {
        field += ch;
      }
    }
  }
  // Last field
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const allRows = parseCsv(text);
const headers = allRows[0] ?? [];
const dataRows = allRows.slice(1).filter((r) => r.some((v) => v.trim()));

// Map to objects
const rows = dataRows.map((values) => {
  const obj = {};
  for (let i = 0; i < headers.length && i < values.length; i++) {
    obj[headers[i]] = values[i]?.trim() ?? "";
  }
  return obj;
});

const H = headers.map((h) => h.trim());
function col(row, name) { return row[name]?.trim() ?? ""; }

console.log("=== DATASET OVERVIEW ===");
console.log("Total data rows:", rows.length);
console.log("Columns:", H.length);
console.log("Column names:", H.join(", "));
console.log("File size (MB):", (fs.statSync(csvPath).size / 1024 / 1024).toFixed(2));

// Level distribution
const central = rows.filter((r) => col(r, "Level") === "Central Government");
const state = rows.filter((r) => col(r, "Level") === "State / UT Government");
const other = rows.filter((r) => col(r, "Level") !== "Central Government" && col(r, "Level") !== "State / UT Government");

console.log("\n=== LEVEL DISTRIBUTION ===");
console.log("Central Government:", central.length);
console.log("State Government:", state.length);
console.log("Other/Unknown:", other.length);

// Madhya Pradesh schemes
const mp = rows.filter((r) =>
  col(r, "State / UT / Ministry").toLowerCase().includes("madhya pradesh") ||
  col(r, "State / UT / Ministry").toLowerCase().includes("pradesh")
  // Note: "pradesh" is broad — also check for MP abbreviation
);

const mpExact = rows.filter((r) =>
  col(r, "State / UT / Ministry").toLowerCase().includes("madhya pradesh")
);

console.log("\n=== MADHYA PRADESH ===");
console.log("MP-specific schemes (exact match):", mpExact.length);
console.log("MP scheme names:");
mpExact.slice(0, 20).forEach((r, i) => console.log("  " + (i + 1) + ". " + col(r, "Scheme Name")));

// Data quality
console.log("\n=== DATA QUALITY (missing fields) ===");
const checks = [
  ["Scheme Name", "Missing Name"],
  ["Scheme Slug", "Missing Slug"],
  ["Level", "Missing Level"],
  ["State / UT / Ministry", "Missing Ministry/State"],
  ["Official Link", "Missing Official Link"],
  ["MyScheme URL", "Missing MyScheme URL"],
  ["Tags / Categories", "Missing Tags"],
  ["Description", "Missing Description"],
  ["Benefits", "Missing Benefits"],
  ["Documents Required", "Missing Documents"],
  ["Application Process", "Missing Application Process"],
];
for (const [colName, label] of checks) {
  const missing = rows.filter((r) => !col(r, colName));
  console.log(label + ":", missing.length, "(" + ((missing.length / rows.length) * 100).toFixed(1) + "%)");
}

// Eligibility completeness (both criteria and general missing)
const missingEligibility = rows.filter((r) => !col(r, "Eligibility Criteria") && !col(r, "Eligibility (General)"));
console.log("Missing all eligibility:", missingEligibility.length, "(" + ((missingEligibility.length / rows.length) * 100).toFixed(1) + "%)");

// Duplicate detection
const slugMap = new Map();
const nameMap = new Map();
let dupSlugs = 0;
let dupNames = 0;
for (const r of rows) {
  const slug = col(r, "Scheme Slug").toLowerCase();
  const name = col(r, "Scheme Name").toLowerCase().replace(/\s+/g, " ");
  if (slug) { if (slugMap.has(slug)) dupSlugs++; else slugMap.set(slug, true); }
  if (name) { if (nameMap.has(name)) dupNames++; else nameMap.set(name, true); }
}
console.log("\n=== DUPLICATES ===");
console.log("Duplicate slugs:", dupSlugs);
console.log("Duplicate normalised names:", dupNames);

// State distribution (top 15)
console.log("\n=== STATE DISTRIBUTION (top 15) ===");
const stateCounts = {};
for (const r of state) {
  const s = col(r, "State / UT / Ministry") || "Unknown";
  stateCounts[s] = (stateCounts[s] || 0) + 1;
}
Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([s, c]) => console.log("  " + s + ": " + c));

// Central ministry distribution (top 15)
console.log("\n=== CENTRAL MINISTRY DISTRIBUTION (top 15) ===");
const minCounts = {};
for (const r of central) {
  const m = col(r, "State / UT / Ministry") || "Unknown";
  minCounts[m] = (minCounts[m] || 0) + 1;
}
Object.entries(minCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([m, c]) => console.log("  " + m + ": " + c));

// Tag distribution (top 20)
console.log("\n=== TAG DISTRIBUTION (top 20) ===");
const tagCounts = {};
for (const r of rows) {
  const tags = col(r, "Tags / Categories").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
}
Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([t, c]) => console.log("  " + t + ": " + c));

// Summary: schemes relevant to MP residents
const mpRelevant = [...central, ...mpExact];
console.log("\n=== MP-RELEVANT SCHEMES (Central + MP-specific) ===");
console.log("Total MP-relevant:", mpRelevant.length);
console.log("Central (national, applies to MP):", central.length);
console.log("MP-specific:", mpExact.length);

// Women-relevant tags
const womenRelevant = rows.filter((r) => {
  const tags = col(r, "Tags / Categories").toLowerCase();
  return tags.includes("women") || tags.includes("woman") || tags.includes("girl") ||
         tags.includes("widow") || tags.includes("maternity") || tags.includes("pregnant") ||
         tags.includes("mother") || tags.includes("child") || tags.includes("female");
});
console.log("\n=== WOMEN-RELEVANT SCHEMES ===");
console.log("Women-relevant schemes:", womenRelevant.length);
console.log("Of which Central:", womenRelevant.filter((r) => col(r, "Level") === "Central Government").length);
console.log("Of which MP-specific:", womenRelevant.filter((r) => col(r, "State / UT / Ministry").toLowerCase().includes("madhya pradesh")).length);
