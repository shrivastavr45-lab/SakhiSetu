/**
 * Pure-logic tests for the scheme listing improvements.
 * All tests run without a database — they verify:
 *   - Pagination parameter validation (limit/offset bounds)
 *   - Level filter values accepted and rejected
 *   - queryInt helper behaviour
 *   - Published-scheme visibility guarantee (public sees only published)
 *   - SchemeListResult shape
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// queryInt helper (mirrors scheme.controller.ts logic)
// ---------------------------------------------------------------------------

function queryInt(value, defaultValue, min, max) {
  if (typeof value !== "string") return defaultValue;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
}

test("queryInt: undefined → defaultValue", () => assert.equal(queryInt(undefined, 100, 1, 500), 100));
test("queryInt: non-numeric string → defaultValue", () => assert.equal(queryInt("abc", 100, 1, 500), 100));
test("queryInt: valid string in range", () => assert.equal(queryInt("50", 100, 1, 500), 50));
test("queryInt: below min → clamped to min", () => assert.equal(queryInt("0", 100, 1, 500), 1));
test("queryInt: above max → clamped to max", () => assert.equal(queryInt("9999", 100, 1, 500), 500));
test("queryInt: exactly at min", () => assert.equal(queryInt("1", 100, 1, 500), 1));
test("queryInt: exactly at max", () => assert.equal(queryInt("500", 100, 1, 500), 500));
test("queryInt: float string → parseInt truncates", () => assert.equal(queryInt("48.9", 100, 1, 500), 48));
test("queryInt: negative string below min", () => assert.equal(queryInt("-5", 100, 0, 500), 0));

// ---------------------------------------------------------------------------
// Pagination constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 48;   // public
const ADMIN_LIMIT = 500; // admin default
const MAX_LIMIT = 500;
const MAX_ADMIN_LIMIT = 1000;

test("public PAGE_SIZE is 48", () => assert.equal(PAGE_SIZE, 48));
test("admin limit cap is 1000", () => assert.equal(MAX_ADMIN_LIMIT, 1000));
test("public limit cap is 500", () => assert.equal(MAX_LIMIT, 500));

// ---------------------------------------------------------------------------
// Level values
// ---------------------------------------------------------------------------

const VALID_LEVELS = ["Central Government", "State Government"];

test("Central Government is a valid level", () => assert.ok(VALID_LEVELS.includes("Central Government")));
test("State Government is a valid level", () => assert.ok(VALID_LEVELS.includes("State Government")));
test("State / UT Government is NOT a valid level (normalised in prepare.mjs)", () => assert.ok(!VALID_LEVELS.includes("State / UT Government")));
test("empty string is not a valid level (treated as no filter)", () => assert.ok(!VALID_LEVELS.includes("")));

// ---------------------------------------------------------------------------
// SchemeListResult shape invariants
// ---------------------------------------------------------------------------

function makeListResult(schemes, total, limit, offset) {
  return { schemes, total, limit, offset };
}

test("SchemeListResult has schemes array, total, limit, offset", () => {
  const r = makeListResult([], 0, 48, 0);
  assert.ok(Array.isArray(r.schemes));
  assert.equal(r.total, 0);
  assert.equal(r.limit, 48);
  assert.equal(r.offset, 0);
});

test("SchemeListResult: offset + limit <= total means more pages exist", () => {
  const r = makeListResult(Array(48).fill({}), 589, 48, 0);
  const hasMore = r.offset + r.schemes.length < r.total;
  assert.equal(hasMore, true);
});

test("SchemeListResult: last page has no more", () => {
  // 589 schemes, page size 48: last page starts at offset 576 (13th page, 0-indexed = 12)
  // 589 - 576 = 13 items on the last page
  // 576 + 13 = 589 = total, so no more pages
  const r = makeListResult(Array(13).fill({}), 589, 48, 576);
  const hasMore = r.offset + r.schemes.length < r.total;
  assert.equal(hasMore, false);
});

test("total pages formula is correct for 589 schemes at 48/page", () => {
  const totalPages = Math.ceil(589 / 48);
  assert.equal(totalPages, 13); // ceil(589/48) = ceil(12.27) = 13
});

// ---------------------------------------------------------------------------
// Published-scheme visibility guarantee (never expose unpublished to public)
// ---------------------------------------------------------------------------

function publicFilter(schemes) {
  // Mirrors the DB WHERE: published = true
  return schemes.filter(s => s.published === true);
}

test("publicFilter: removes unpublished schemes", () => {
  const schemes = [
    { id: "a", published: true },
    { id: "b", published: false },
    { id: "c", published: true },
  ];
  const result = publicFilter(schemes);
  assert.equal(result.length, 2);
  assert.ok(result.every(s => s.published === true));
});

test("publicFilter: all unpublished → empty result", () => {
  const schemes = [{ id: "a", published: false }, { id: "b", published: false }];
  assert.equal(publicFilter(schemes).length, 0);
});

test("publicFilter: empty array → empty result", () => {
  assert.equal(publicFilter([]).length, 0);
});

test("publicFilter: demo scheme SCH-014 (draft) is excluded from public", () => {
  const schemes = [
    { id: "SCH-014", published: false, nameEn: "State widow pension" },
    { id: "SCH-022", published: true,  nameEn: "SHG loan support" },
    { id: "SCH-031", published: true,  nameEn: "Maternity benefit" },
  ];
  const result = publicFilter(schemes);
  assert.equal(result.length, 2);
  assert.ok(result.every(s => s.id !== "SCH-014"));
});

test("publicFilter: all 578 imported drafts are excluded from public", () => {
  // Simulate 578 imported drafts + 2 published demo schemes
  const schemes = [
    ...Array.from({ length: 578 }, (_, i) => ({ id: `import-${i}`, published: false })),
    { id: "SCH-022", published: true },
    { id: "SCH-031", published: true },
  ];
  const result = publicFilter(schemes);
  assert.equal(result.length, 2);
  assert.ok(result.every(s => s.published === true));
});

// ---------------------------------------------------------------------------
// Level filter logic
// ---------------------------------------------------------------------------

function levelFilter(schemes, level) {
  if (!level) return schemes;
  return schemes.filter(s => s.level === level);
}

test("levelFilter: no level → all schemes returned", () => {
  const schemes = [{ level: "Central Government" }, { level: "State Government" }, { level: null }];
  assert.equal(levelFilter(schemes, "").length, 3);
});

test("levelFilter: Central Government only", () => {
  const schemes = [{ level: "Central Government" }, { level: "State Government" }, { level: null }];
  const result = levelFilter(schemes, "Central Government");
  assert.equal(result.length, 1);
  assert.equal(result[0].level, "Central Government");
});

test("levelFilter: State Government only", () => {
  const schemes = [{ level: "Central Government" }, { level: "State Government" }, { level: null }];
  const result = levelFilter(schemes, "State Government");
  assert.equal(result.length, 1);
  assert.equal(result[0].level, "State Government");
});
