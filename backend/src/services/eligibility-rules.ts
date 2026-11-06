export type ApplicantProfile = {
  age?: number;
  ageMin?: number;
  ageMax?: number;
  married?: boolean;
  pregnant?: boolean;
  hasDaughter?: boolean;
  bpl?: boolean;
  rural?: boolean;
  widowed?: boolean;
  shgMember?: boolean;
  firstChild?: boolean;
  need?: string;
  district?: string;
};

type Rules = {
  minAge?: number;
  maxAge?: number;
  married?: boolean;
  pregnant?: boolean;
  hasDaughter?: boolean;
  bpl?: boolean;
  rural?: boolean;
  widowed?: boolean;
  shgMember?: boolean;
  firstChild?: boolean;
};

type BooleanRuleKey = "married" | "pregnant" | "hasDaughter" | "bpl" | "rural" | "widowed" | "shgMember" | "firstChild";

export type EligibilityRuleKey = keyof Rules | "districtAvailability" | "needPreference";

export type EligibilityMatch = {
  schemeId: string;
  matched: boolean;
  rulesApplied: EligibilityRuleKey[];
  unansweredRules: EligibilityRuleKey[];
  /** True when the scheme has at least one structured eligibility rule (age, boolean, or district restriction). */
  hasStructuredRules: boolean;
  disclaimer: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function evaluateEligibility(
  profile: ApplicantProfile,
  scheme: { id: string; need: string; districts: unknown; rules: unknown },
): EligibilityMatch {
  const rules = (isRecord(scheme.rules) ? scheme.rules : {}) as Rules;
  const rulesApplied: EligibilityRuleKey[] = [];
  const unansweredRules: EligibilityRuleKey[] = [];
  let matched = true;

  const ageMin = profile.age ?? profile.ageMin;
  const ageMax = profile.age ?? profile.ageMax;
  if (rules.minAge !== undefined) {
    if (ageMin === undefined || ageMax === undefined) unansweredRules.push("minAge");
    else if (ageMax < rules.minAge) matched = false;
    else if (ageMin >= rules.minAge) rulesApplied.push("minAge");
    else unansweredRules.push("minAge");
  }
  if (rules.maxAge !== undefined) {
    if (ageMin === undefined || ageMax === undefined) unansweredRules.push("maxAge");
    else if (ageMin > rules.maxAge) matched = false;
    else if (ageMax <= rules.maxAge) rulesApplied.push("maxAge");
    else unansweredRules.push("maxAge");
  }

  const booleanFields: BooleanRuleKey[] = [
    "married", "pregnant", "hasDaughter", "bpl", "rural", "widowed", "shgMember", "firstChild",
  ];
  for (const field of booleanFields) {
    const required = rules[field];
    if (typeof required !== "boolean") continue;
    const answer = profile[field];
    if (answer === undefined) unansweredRules.push(field);
    else if (answer !== required) matched = false;
    else rulesApplied.push(field);
  }

  if (profile.district) {
    const districts = scheme.districts;
    if (districts !== "all" && Array.isArray(districts) && !districts.includes(profile.district)) matched = false;
    else rulesApplied.push("districtAvailability");
  } else if (scheme.districts !== "all") {
    unansweredRules.push("districtAvailability");
  }

  if (profile.need && profile.need === scheme.need) rulesApplied.push("needPreference");

  // hasStructuredRules: true when the scheme encodes at least one verifiable rule.
  // Schemes imported with rules:{} can still appear as possible matches but the UI
  // must flag them so users know no structured check was performed.
  const hasStructuredRules =
    rules.minAge !== undefined ||
    rules.maxAge !== undefined ||
    booleanFields.some((f) => typeof rules[f] === "boolean") ||
    scheme.districts !== "all";

  return {
    schemeId: scheme.id,
    matched,
    rulesApplied,
    unansweredRules,
    hasStructuredRules,
    disclaimer: "Possible match only. The relevant government department makes the final eligibility decision.",
  };
}
