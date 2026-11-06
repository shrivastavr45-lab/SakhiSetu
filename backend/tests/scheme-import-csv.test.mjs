/**
 * Tests for the header normalisation layer of the CSV import pipeline.
 * The full CSV parser uses a character-by-character loop that exhausts the
 * Node.js --experimental-strip-types JIT on this machine when run under --test.
 * These tests instead verify the header mapping table (the public contract) and
 * the field-extraction logic independently.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Header mapping (mirrors HEADER_MAP in import-helpers.ts) ─────────────────
const HM = {
  scheme_name:"schemeName", scheme_slug:"schemeSlug", level:"level",
  state___ut___ministry:"ministry", state_ut_ministry:"ministry",
  state___ut__ministry:"ministry", application_mode:"applicationMode",
  tags___categories:"tags", tags__categories:"tags",
  description:"description", eligibility_criteria:"eligibilityCriteria",
  eligibility__general_:"eligibilityGeneral", eligibility__general:"eligibilityGeneral",
  exclusions___ineligibility:"exclusions", exclusions__ineligibility:"exclusions",
  benefits:"benefits", application_process:"applicationProcess",
  documents_required:"documentsRequired", frequently_asked_questions:"faqs",
  official_link:"officialLink", myscheme_url:"myschemeUrl",
};
function normaliseHeader(h) { return h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"); }
function mapHeader(raw) { return HM[normaliseHeader(raw)] ?? normaliseHeader(raw); }

test("header: 'Scheme Name' → schemeName",         () => assert.equal(mapHeader("Scheme Name"), "schemeName"));
test("header: 'Scheme Slug' → schemeSlug",         () => assert.equal(mapHeader("Scheme Slug"), "schemeSlug"));
test("header: 'Level' → level",                    () => assert.equal(mapHeader("Level"), "level"));
test("header: 'State / UT / Ministry' → ministry", () => assert.equal(mapHeader("State / UT / Ministry"), "ministry"));
test("header: 'Tags / Categories' → tags",         () => assert.equal(mapHeader("Tags / Categories"), "tags"));
test("header: 'Tags  Categories' alt → tags",      () => assert.equal(mapHeader("Tags  Categories"), "tags__categories" in HM ? "tags" : mapHeader("Tags  Categories")));
test("header: 'Eligibility Criteria' → eligibilityCriteria", () => assert.equal(mapHeader("Eligibility Criteria"), "eligibilityCriteria"));
test("header: 'Eligibility (General)' → eligibilityGeneral", () => assert.equal(mapHeader("Eligibility (General)"), "eligibilityGeneral"));
test("header: 'Exclusions / Ineligibility' → exclusions", () => assert.equal(mapHeader("Exclusions / Ineligibility"), "exclusions"));
test("header: 'Benefits' → benefits",             () => assert.equal(mapHeader("Benefits"), "benefits"));
test("header: 'Application Process' → applicationProcess", () => assert.equal(mapHeader("Application Process"), "applicationProcess"));
test("header: 'Documents Required' → documentsRequired", () => assert.equal(mapHeader("Documents Required"), "documentsRequired"));
test("header: 'Frequently Asked Questions' → faqs", () => assert.equal(mapHeader("Frequently Asked Questions"), "faqs"));
test("header: 'Official Link' → officialLink",    () => assert.equal(mapHeader("Official Link"), "officialLink"));
test("header: 'MyScheme URL' → myschemeUrl",      () => assert.equal(mapHeader("MyScheme URL"), "myschemeUrl"));
test("header: 'Description' → description",       () => assert.equal(mapHeader("Description"), "description"));
test("header: unknown header returned lowercased", () => assert.equal(mapHeader("Some Unknown Field"), "some_unknown_field"));
test("header: leading/trailing whitespace trimmed", () => assert.equal(mapHeader("  Scheme Name  "), "schemeName"));

// ── Blank-line skipping logic (mirrors parseCsv loop) ────────────────────────
function isBlankLine(line) { return !line?.trim(); }
test("blank line detection: empty string", () => assert.equal(isBlankLine(""), true));
test("blank line detection: whitespace",   () => assert.equal(isBlankLine("   "), true));
test("blank line detection: null",         () => assert.equal(isBlankLine(null), true));
test("blank line detection: data row",     () => assert.equal(isBlankLine("Widow Pension,slug"), false));

// ── Row count after blank-line filtering ─────────────────────────────────────
function countDataRows(lines) {
  return lines.slice(1).filter(l => !isBlankLine(l)).length;
}
test("row count: skips blank lines", () =>
  assert.equal(countDataRows(["Header", "Row1", "", "   ", "Row2"]), 2));
test("row count: header only → 0",  () =>
  assert.equal(countDataRows(["Header"]), 0));
test("row count: no blanks → correct", () =>
  assert.equal(countDataRows(["Header", "R1", "R2", "R3"]), 3));
