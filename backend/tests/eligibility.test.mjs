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
