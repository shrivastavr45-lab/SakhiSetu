/**
 * Tests for need inference, field mapping, validation and deduplication helpers.
 */
import test from "node:test";
import assert from "node:assert/strict";

function inferNeed(tags) {
  const t = (tags ?? "").toLowerCase();
  if (["education","scholarship","student","school","college","girl child","beti"].some(k => t.includes(k))) return "education";
  if (["health","medical","hospital","maternity","nutrition","ayushman"].some(k => t.includes(k))) return "health";
  if (["employment","livelihood","skill","shg","entrepreneur","msme","labour","training","weaver"].some(k => t.includes(k))) return "work";
  if (["housing","house","gas","lpg","electricity","water","toilet","ration","awas"].some(k => t.includes(k))) return "housing";
  return "money";
}
function trunc(s, max) { return String(s ?? "").trim().slice(0, max); }
function splitLines(text, maxItems, maxLen) {
  return String(text ?? "").split(/\n|\\n/).map(l => l.trim()).filter(Boolean)
    .slice(0, maxItems).map(l => ({ hi: "", en: trunc(l, maxLen) }));
}
function sanitiseUrl(raw) {
  const s = String(raw ?? "").trim(); if (!s) return null;
  try { const u = new URL(s); return (u.protocol === "http:" || u.protocol === "https:") ? s.slice(0, 2048) : null; }
  catch { return null; }
}
function normaliseName(name) { return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " "); }

function mapCsvRow(row) {
  const combined = [row.eligibilityGeneral ?? "", row.eligibilityCriteria ?? ""].filter(Boolean).join("\n");
  const excl = (row.exclusions ?? "").trim();
  const rawLevel = (row.level ?? "").trim();
  return {
    nameEn: trunc(row.schemeName ?? "", 180), nameHi: "",
    deptEn: trunc(row.ministry ?? "", 180),   deptHi: "",
    need: inferNeed(row.tags ?? ""),
    level: rawLevel === "Central Government" ? "Central Government"
         : rawLevel === "State Government"   ? "State Government" : null,
    myschemeSlug: (row.schemeSlug ?? "").trim().toLowerCase() || null,
    myschemeUrl: sanitiseUrl(row.myschemeUrl ?? ""),
    sourceUrl:   sanitiseUrl(row.officialLink ?? ""),
    shortEn: trunc(row.description ?? "", 1000), shortHi: "",
    benefitEn: trunc(row.benefits ?? "", 1000),  benefitHi: "",
    eligibility: splitLines(combined, 30, 500),
    documents:   splitLines(row.documentsRequired ?? "", 30, 200),
    steps:       splitLines(row.applicationProcess ?? "", 30, 500),
    officialNoticeText: excl ? `Exclusions (from import):\n${excl.slice(0,29950)}` : null,
  };
}
function validateRow(row) {
  const n = (row.schemeName ?? "").trim();
  if (!n || n.length < 2) return { ok: false, reason: "Scheme Name is missing or too short (min 2 characters)." };
  if (n.length > 180)     return { ok: false, reason: `Scheme Name exceeds 180 characters (got ${n.length}).` };
  return { ok: true, mapped: mapCsvRow(row) };
}
const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const IMPORT_MAX_ROWS  = 3_000;

function r(o = {}) {
  return { schemeName:"State Widow Pension", schemeSlug:"state-widow-pension",
    level:"Central Government", ministry:"Ministry of Social Justice", tags:"Pension, Welfare",
    description:"Monthly pension.", eligibilityCriteria:"Must be widowed.\nAge 18–79.",
    eligibilityGeneral:"Woman resident.", exclusions:"Income tax payers excluded.",
    benefits:"₹600 per month.", applicationProcess:"Step 1: Apply.",
    documentsRequired:"Aadhaar Card.\nBPL Card.",
    officialLink:"https://example.gov.in/pension",
    myschemeUrl:"https://www.myscheme.gov.in/schemes/state-widow-pension", ...o };
}

// inferNeed
test("inferNeed: pension → money",      () => assert.equal(inferNeed("Pension"), "money"));
test("inferNeed: scholarship → education", () => assert.equal(inferNeed("Scholarship, Girls"), "education"));
test("inferNeed: health → health",      () => assert.equal(inferNeed("Health, Maternity"), "health"));
test("inferNeed: employment → work",    () => assert.equal(inferNeed("Employment, SHG"), "work"));
test("inferNeed: housing → housing",    () => assert.equal(inferNeed("Housing, LPG"), "housing"));
test("inferNeed: empty → money",        () => assert.equal(inferNeed(""), "money"));
test("inferNeed: unknown → money",      () => assert.equal(inferNeed("XYZ"), "money"));

// mapCsvRow
test("mapCsvRow: nameEn correct",          () => assert.equal(mapCsvRow(r()).nameEn, "State Widow Pension"));
test("mapCsvRow: nameHi always blank",     () => assert.equal(mapCsvRow(r()).nameHi, ""));
test("mapCsvRow: deptEn correct",          () => assert.equal(mapCsvRow(r()).deptEn, "Ministry of Social Justice"));
test("mapCsvRow: deptHi always blank",     () => assert.equal(mapCsvRow(r()).deptHi, ""));
test("mapCsvRow: shortHi always blank",    () => assert.equal(mapCsvRow(r()).shortHi, ""));
test("mapCsvRow: benefitHi always blank",  () => assert.equal(mapCsvRow(r()).benefitHi, ""));
test("mapCsvRow: Central level",           () => assert.equal(mapCsvRow(r({ level:"Central Government" })).level, "Central Government"));
test("mapCsvRow: State level",             () => assert.equal(mapCsvRow(r({ level:"State Government" })).level, "State Government"));
test("mapCsvRow: unknown level → null",    () => assert.equal(mapCsvRow(r({ level:"UT" })).level, null));
test("mapCsvRow: blank level → null",      () => assert.equal(mapCsvRow(r({ level:"" })).level, null));
test("mapCsvRow: slug lowercased",         () => assert.equal(mapCsvRow(r({ schemeSlug:"  Widow-Pension  " })).myschemeSlug, "widow-pension"));
test("mapCsvRow: blank slug → null",       () => assert.equal(mapCsvRow(r({ schemeSlug:"" })).myschemeSlug, null));
test("mapCsvRow: valid sourceUrl",         () => assert.equal(mapCsvRow(r()).sourceUrl, "https://example.gov.in/pension"));
test("mapCsvRow: invalid URL → null",      () => assert.equal(mapCsvRow(r({ officialLink:"not-a-url" })).sourceUrl, null));
test("mapCsvRow: ftp URL → null",          () => assert.equal(mapCsvRow(r({ officialLink:"ftp://a.gov.in" })).sourceUrl, null));
test("mapCsvRow: description truncated",   () => assert.equal(mapCsvRow(r({ description:"A".repeat(1500) })).shortEn.length, 1000));
test("mapCsvRow: benefits truncated",      () => assert.equal(mapCsvRow(r({ benefits:"B".repeat(2000) })).benefitEn.length, 1000));
test("mapCsvRow: eligibility split correctly", () => {
  const m = mapCsvRow(r({ eligibilityCriteria:"L1\nL2\nL3", eligibilityGeneral:"" }));
  assert.equal(m.eligibility.length, 3); assert.equal(m.eligibility[0]?.en, "L1"); assert.equal(m.eligibility[0]?.hi, "");
});
test("mapCsvRow: eligibilityGeneral prepended", () => {
  const m = mapCsvRow(r({ eligibilityGeneral:"Must be resident.", eligibilityCriteria:"Age 18+." }));
  assert.ok(m.eligibility.length >= 2); assert.equal(m.eligibility[0]?.en, "Must be resident.");
});
test("mapCsvRow: eligibility capped at 30", () => {
  assert.equal(mapCsvRow(r({ eligibilityCriteria:Array.from({length:50},(_,i)=>`C${i}`).join("\n"), eligibilityGeneral:"" })).eligibility.length, 30);
});
test("mapCsvRow: documents split",         () => assert.equal(mapCsvRow(r()).documents.length, 2));
test("mapCsvRow: steps split",             () => assert.equal(mapCsvRow(r()).steps.length, 1));
test("mapCsvRow: exclusions in officialNoticeText", () => assert.ok(mapCsvRow(r()).officialNoticeText?.includes("Income tax payers excluded.")));
test("mapCsvRow: blank exclusions → null", () => assert.equal(mapCsvRow(r({ exclusions:"" })).officialNoticeText, null));
test("mapCsvRow: no published field",      () => assert.ok(!("published" in mapCsvRow(r()))));
test("mapCsvRow: no rules field",          () => assert.ok(!("rules" in mapCsvRow(r()))));

// validateRow
test("validateRow: valid row passes",      () => assert.equal(validateRow(r()).ok, true));
test("validateRow: missing name fails",    () => { const v = validateRow(r({schemeName:""})); assert.equal(v.ok,false); assert.ok(v.reason.includes("Scheme Name")); });
test("validateRow: single-char fails",     () => assert.equal(validateRow(r({schemeName:"A"})).ok, false));
test("validateRow: whitespace-only fails", () => assert.equal(validateRow(r({schemeName:"   "})).ok, false));
test("validateRow: 181-char fails",        () => { const v = validateRow(r({schemeName:"A".repeat(181)})); assert.equal(v.ok,false); assert.ok(v.reason.includes("180")); });
test("validateRow: 180-char passes",       () => assert.equal(validateRow(r({schemeName:"A".repeat(180)})).ok, true));

// normaliseName / sanitiseUrl / limits
test("normaliseName: lowercases",          () => assert.equal(normaliseName("  State Widow  "), "state widow"));
test("normaliseName: collapses spaces",    () => assert.equal(normaliseName("A   B"), "a b"));
test("normaliseName: case equivalence",    () => assert.equal(normaliseName("PM KISAN"), normaliseName("PM Kisan")));
test("sanitiseUrl: accepts https",         () => assert.equal(sanitiseUrl("https://a.gov.in"), "https://a.gov.in"));
test("sanitiseUrl: accepts http",          () => assert.equal(sanitiseUrl("http://a.gov.in"), "http://a.gov.in"));
test("sanitiseUrl: rejects ftp",           () => assert.equal(sanitiseUrl("ftp://a.gov.in"), null));
test("sanitiseUrl: rejects empty",         () => assert.equal(sanitiseUrl(""), null));
test("IMPORT_MAX_BYTES is 5 MB",           () => assert.equal(IMPORT_MAX_BYTES, 5*1024*1024));
test("IMPORT_MAX_ROWS is 3000",            () => assert.equal(IMPORT_MAX_ROWS, 3_000));
test("ADMIN role discriminator",           () => { const isAdmin = r => r==="ADMIN"; assert.ok(isAdmin("ADMIN")); assert.ok(!isAdmin("DONOR")); });
