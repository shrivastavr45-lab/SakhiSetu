import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility } from "../src/services/eligibility-rules.ts";

const widowScheme = {
  id: "SCH-014",
  need: "money",
  districts: "all",
  rules: { minAge: 18, maxAge: 79, bpl: true, widowed: true },
};

const shgScheme = {
  id: "SCH-022",
  need: "work",
  districts: "all",
  rules: { shgMember: true },
};

const maternityScheme = {
  id: "SCH-031",
  need: "health",
  districts: "all",
  rules: { pregnant: true, firstChild: true },
};

test("widow pension matches inclusive age boundaries and required boolean rules", () => {
  const result = evaluateEligibility({ age: 79, bpl: true, widowed: true }, widowScheme);
  assert.equal(result.matched, true);
  assert.deepEqual(result.unansweredRules, []);
  assert.ok(result.rulesApplied.includes("minAge"));
  assert.ok(result.rulesApplied.includes("maxAge"));
});

test("widow pension excludes applicants below or above its age range", () => {
  assert.equal(evaluateEligibility({ age: 17, bpl: true, widowed: true }, widowScheme).matched, false);
  assert.equal(evaluateEligibility({ age: 80, bpl: true, widowed: true }, widowScheme).matched, false);
});

test("an unanswered criterion remains a possible match and is disclosed", () => {
  const result = evaluateEligibility({ age: 35, bpl: true }, widowScheme);
  assert.equal(result.matched, true);
  assert.deepEqual(result.unansweredRules, ["widowed"]);
});

test("a negative answer to a required criterion excludes the scheme", () => {
  assert.equal(evaluateEligibility({ shgMember: false }, shgScheme).matched, false);
  assert.equal(evaluateEligibility({ pregnant: true, firstChild: false }, maternityScheme).matched, false);
});

test("registered SHG membership matches the loan support scheme", () => {
  const result = evaluateEligibility({ shgMember: true, need: "work" }, shgScheme);
  assert.equal(result.matched, true);
  assert.deepEqual(result.unansweredRules, []);
  assert.ok(result.rulesApplied.includes("needPreference"));
});

test("maternity support requires both pregnancy and first child", () => {
  const result = evaluateEligibility({ pregnant: true, firstChild: true }, maternityScheme);
  assert.equal(result.matched, true);
  assert.deepEqual(result.unansweredRules, []);
});

test("district restriction excludes a different district", () => {
  const scheme = { ...shgScheme, districts: ["bhopal", "sehore"] };
  assert.equal(evaluateEligibility({ shgMember: true, district: "bhopal" }, scheme).matched, true);
  assert.equal(evaluateEligibility({ shgMember: true, district: "betul" }, scheme).matched, false);
});


test("age bands fully inside a rule are matched without inventing a midpoint", () => {
  const result = evaluateEligibility({ ageMin: 18, ageMax: 20, widowed: true, bpl: true }, widowScheme);
  assert.equal(result.matched, true);
  assert.deepEqual(result.unansweredRules, []);
});

test("an age band crossing a rule boundary is retained as a possible match with an unanswered rule", () => {
  const result = evaluateEligibility({ ageMin: 61, ageMax: 79, widowed: true, bpl: true }, {
    ...widowScheme,
    rules: { minAge: 18, maxAge: 74, widowed: true, bpl: true },
  });
  assert.equal(result.matched, true);
  assert.ok(result.unansweredRules.includes("maxAge"));
  assert.ok(result.rulesApplied.includes("minAge"));
});

// ---------------------------------------------------------------------------
// hasStructuredRules tests
// ---------------------------------------------------------------------------

test("hasStructuredRules is false when rules object is empty (no minAge, maxAge, booleans, or district restriction)", () => {
  const emptyRulesScheme = { id: "SCH-999", need: "money", districts: "all", rules: {} };
  const result = evaluateEligibility({ age: 30, bpl: true }, emptyRulesScheme);
  assert.equal(result.hasStructuredRules, false);
  // Still a possible match — an empty-rules scheme is never excluded
  assert.equal(result.matched, true);
});

test("hasStructuredRules is true when rules contain a boolean field (widowed)", () => {
  const result = evaluateEligibility({ widowed: true }, shgScheme);
  // shgScheme has shgMember:true — that's a boolean rule
  assert.equal(result.hasStructuredRules, true);
});

test("hasStructuredRules is true when rules contain minAge", () => {
  const result = evaluateEligibility({ age: 30, bpl: true, widowed: true }, widowScheme);
  assert.equal(result.hasStructuredRules, true);
});

test("hasStructuredRules is true when scheme has a district restriction even with empty boolean rules", () => {
  const districtOnlyScheme = { id: "SCH-998", need: "health", districts: ["bhopal", "sehore"], rules: {} };
  const result = evaluateEligibility({ district: "bhopal" }, districtOnlyScheme);
  assert.equal(result.hasStructuredRules, true);
});

test("hasStructuredRules is false for an empty-rules scheme regardless of profile completeness", () => {
  const emptyRulesScheme = { id: "SCH-997", need: "work", districts: "all", rules: {} };
  // Complete profile — but no rules to apply
  const result = evaluateEligibility(
    { age: 35, bpl: true, widowed: true, shgMember: true, pregnant: false, firstChild: false, district: "betul" },
    emptyRulesScheme,
  );
  assert.equal(result.hasStructuredRules, false);
  assert.equal(result.matched, true);
  // needPreference may appear if need matches, but rulesApplied otherwise empty
  const structuredRulesKeys = result.rulesApplied.filter((k) => k !== "needPreference" && k !== "districtAvailability");
  assert.deepEqual(structuredRulesKeys, []);
});

// ---------------------------------------------------------------------------
// Realistic applicant profile tests — 5 profiles against actual published
// scheme rules (as they now exist in the database after add-eligibility-rules.mjs).
// Tests use inline scheme snapshots so they stay pure unit tests with no DB.
// ---------------------------------------------------------------------------

// Schemes with rules now in the DB:
const pmmvyScheme = {
  id: "import-04859e8a",
  need: "health",
  districts: "all",
  rules: { pregnant: true, firstChild: true, minAge: 19 },
};

const jsskScheme = {
  id: "import-6d6a7761",
  need: "money",
  districts: "all",
  rules: { pregnant: true },
};

const sumanScheme = {
  id: "import-2a275e27",
  need: "health",
  districts: "all",
  rules: { pregnant: true },
};

const vridhavasthaPensionScheme = {
  id: "import-299a2b7e",
  need: "money",
  districts: "all",
  rules: { minAge: 61 },
};

const parityaktaPensionScheme = {
  id: "import-5fc1a8c5",
  need: "money",
  districts: "all",
  rules: { minAge: 18, maxAge: 59, bpl: true },
};

const ujjwalaScheme = {
  id: "import-5283b3d9",
  need: "housing",
  districts: "all",
  rules: { bpl: true },
};

const sagScheme = {
  id: "import-b019ab1d",
  need: "health",
  districts: "all",
  rules: { minAge: 11, maxAge: 14 },
};

const ladliBehnaScheme = {
  id: "import-6c4e345f",
  need: "money",
  districts: "all",
  rules: { maxAge: 59 },
};

// ── Profile 1: Pregnant woman, 25 years, first child, BPL ─────────────────
// Expected: PMMVY ✓ (pregnant+firstChild+age≥19), JSSK ✓ (pregnant),
//           SUMAN ✓ (pregnant), Ladli Behna ✓ (age≤59), Ujjwala ✓ (BPL),
//           Parityakta pension ✗ (not applicable — no widowed/abandoned context,
//           but engine only checks rules: age 18–59 ✓ + bpl ✓ → matched)
test("profile 1: pregnant BPL woman aged 25 expecting first child matches maternity schemes", () => {
  const profile = { ageMin: 25, ageMax: 25, pregnant: true, firstChild: true, bpl: true };

  const pmmvy = evaluateEligibility(profile, pmmvyScheme);
  assert.equal(pmmvy.matched, true, "PMMVY should match");
  assert.ok(pmmvy.rulesApplied.includes("pregnant"), "pregnant rule applied");
  assert.ok(pmmvy.rulesApplied.includes("firstChild"), "firstChild rule applied");
  assert.ok(pmmvy.rulesApplied.includes("minAge"), "minAge rule applied for 25 ≥ 19");
  assert.deepEqual(pmmvy.unansweredRules, [], "no unanswered rules");
  assert.equal(pmmvy.hasStructuredRules, true);

  const jssk = evaluateEligibility(profile, jsskScheme);
  assert.equal(jssk.matched, true, "JSSK should match");
  assert.ok(jssk.rulesApplied.includes("pregnant"));

  const suman = evaluateEligibility(profile, sumanScheme);
  assert.equal(suman.matched, true, "SUMAN should match");
  assert.ok(suman.rulesApplied.includes("pregnant"));

  const ujjwala = evaluateEligibility(profile, ujjwalaScheme);
  assert.equal(ujjwala.matched, true, "Ujjwala should match (BPL)");

  const ladliBehna = evaluateEligibility(profile, ladliBehnaScheme);
  assert.equal(ladliBehna.matched, true, "Ladli Behna should match (age 25 ≤ 59)");
});

// ── Profile 2: Non-pregnant woman, 25 years, not BPL ─────────────────────
// Expected: PMMVY ✗ (not pregnant), JSSK ✗ (not pregnant), SUMAN ✗,
//           Ladli Behna ✓ (age≤59)
test("profile 2: non-pregnant woman aged 25 is excluded from maternity schemes", () => {
  const profile = { ageMin: 25, ageMax: 25, pregnant: false, firstChild: false, bpl: false };

  assert.equal(evaluateEligibility(profile, pmmvyScheme).matched, false, "PMMVY: not pregnant");
  assert.equal(evaluateEligibility(profile, jsskScheme).matched, false, "JSSK: not pregnant");
  assert.equal(evaluateEligibility(profile, sumanScheme).matched, false, "SUMAN: not pregnant");

  const ladliBehna = evaluateEligibility(profile, ladliBehnaScheme);
  assert.equal(ladliBehna.matched, true, "Ladli Behna: age 25 ≤ 59");

  const ujjwala = evaluateEligibility(profile, ujjwalaScheme);
  assert.equal(ujjwala.matched, false, "Ujjwala: not BPL");
});

// ── Profile 3: Elderly woman aged 65, not BPL ─────────────────────────────
// Expected: Vridhavastha pension ✓ (age 65 > 60), Parityakta ✗ (age > 59),
//           Ladli Behna ✗ (age > 59), PMMVY ✗ (not pregnant)
test("profile 3: elderly woman aged 65 matches old-age pension but not younger-woman schemes", () => {
  const profile = { ageMin: 65, ageMax: 65, pregnant: false, bpl: false };

  const vridha = evaluateEligibility(profile, vridhavasthaPensionScheme);
  assert.equal(vridha.matched, true, "Vridhavastha pension: 65 > 60");
  assert.ok(vridha.rulesApplied.includes("minAge"), "minAge applied");
  assert.equal(vridha.hasStructuredRules, true);

  assert.equal(evaluateEligibility(profile, parityaktaPensionScheme).matched, false, "Parityakta: 65 > maxAge 59");
  assert.equal(evaluateEligibility(profile, ladliBehnaScheme).matched, false, "Ladli Behna: 65 > maxAge 59");
  assert.equal(evaluateEligibility(profile, pmmvyScheme).matched, false, "PMMVY: not pregnant");
});

// ── Profile 4: Abandoned/widowed BPL woman aged 35 ────────────────────────
// Expected: Parityakta pension ✓ (18–59 + BPL), Ujjwala ✓ (BPL),
//           Vridhavastha ✗ (35 < 61), Ladli Behna ✓ (35 ≤ 59),
//           PMMVY ✗ (not pregnant)
test("profile 4: BPL woman aged 35 matches abandoned-pension and Ujjwala but not elderly pension", () => {
  const profile = { ageMin: 35, ageMax: 35, bpl: true, pregnant: false, widowed: true };

  const parityakta = evaluateEligibility(profile, parityaktaPensionScheme);
  assert.equal(parityakta.matched, true, "Parityakta: 35 in 18–59 and BPL");
  assert.ok(parityakta.rulesApplied.includes("bpl"), "BPL rule applied");
  assert.ok(parityakta.rulesApplied.includes("minAge"), "minAge 18 applied");
  assert.ok(parityakta.rulesApplied.includes("maxAge"), "maxAge 59 applied");
  assert.deepEqual(parityakta.unansweredRules, []);

  assert.equal(evaluateEligibility(profile, ujjwalaScheme).matched, true, "Ujjwala: BPL");
  assert.equal(evaluateEligibility(profile, vridhavasthaPensionScheme).matched, false, "Vridhavastha: 35 < 61");
  assert.equal(evaluateEligibility(profile, ladliBehnaScheme).matched, true, "Ladli Behna: 35 ≤ 59");
  assert.equal(evaluateEligibility(profile, pmmvyScheme).matched, false, "PMMVY: not pregnant");
});

// ── Profile 5: Young woman aged 13 (adolescent) ────────────────────────────
// Expected: SAG ✓ (11–14), all adult schemes ✗ (age too young)
test("profile 5: adolescent girl aged 13 matches SAG but not adult schemes", () => {
  const profile = { ageMin: 13, ageMax: 13, pregnant: false, bpl: false };

  const sag = evaluateEligibility(profile, sagScheme);
  assert.equal(sag.matched, true, "SAG: 13 in 11–14");
  assert.ok(sag.rulesApplied.includes("minAge"), "minAge 11 applied");
  assert.ok(sag.rulesApplied.includes("maxAge"), "maxAge 14 applied");
  assert.equal(sag.hasStructuredRules, true);

  assert.equal(evaluateEligibility(profile, pmmvyScheme).matched, false, "PMMVY: 13 < minAge 19");
  assert.equal(evaluateEligibility(profile, ladliBehnaScheme).matched, true, "Ladli Behna: maxAge:59 only; 13 ≤ 59 — possible match");
  assert.equal(evaluateEligibility(profile, vridhavasthaPensionScheme).matched, false, "Vridhavastha: 13 < 61");
  assert.equal(evaluateEligibility(profile, parityaktaPensionScheme).matched, false, "Parityakta: not BPL → excluded");
  assert.equal(evaluateEligibility(profile, ujjwalaScheme).matched, false, "Ujjwala: not BPL");
});

// ── Unanswered rules propagation ────────────────────────────────────────────
test("profile with skipped pregnancy answer leaves pregnant rule unanswered for JSSK", () => {
  // User skipped the pregnancy question — profile has no pregnant key at all.
  const profile = { ageMin: 28, ageMax: 28, bpl: true };
  const result = evaluateEligibility(profile, jsskScheme);
  assert.equal(result.matched, true, "still a possible match when rule is unanswered");
  assert.ok(result.unansweredRules.includes("pregnant"), "pregnant rule is unanswered");
  assert.deepEqual(result.rulesApplied.filter(k => k !== "needPreference"), [], "no rules confirmed");
});

test("PMMVY is excluded when applicant is pregnant but this is not her first child", () => {
  const profile = { ageMin: 28, ageMax: 28, pregnant: true, firstChild: false };
  const result = evaluateEligibility(profile, pmmvyScheme);
  assert.equal(result.matched, false, "firstChild: false excludes PMMVY");
});
