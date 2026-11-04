import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";
import { evaluateEligibility, type ApplicantProfile } from "./eligibility-rules.js";

export { evaluateEligibility } from "./eligibility-rules.js";
export type { ApplicantProfile, EligibilityMatch } from "./eligibility-rules.js";

export async function findEligibleSchemes(profile: ApplicantProfile) {
  const schemes = await prisma.scheme.findMany({ where: { published: true }, orderBy: [{ need: "asc" }, { nameHi: "asc" }] });
  const evaluated = schemes.map((scheme) => ({ scheme, result: evaluateEligibility(profile, scheme) })).filter(({ result }) => result.matched);
  evaluated.sort((a, b) => Number(b.scheme.need === profile.need) - Number(a.scheme.need === profile.need));

  return evaluated.map(({ scheme, result }) => ({
    id: scheme.id,
    need: scheme.need,
    name: { hi: scheme.nameHi, en: scheme.nameEn },
    dept: { hi: scheme.deptHi, en: scheme.deptEn },
    short: { hi: scheme.shortHi, en: scheme.shortEn },
    benefit: { hi: scheme.benefitHi, en: scheme.benefitEn },
    eligibility: scheme.eligibility,
    documents: scheme.documents,
    steps: scheme.steps,
    rules: scheme.rules,
    districts: scheme.districts,
    published: scheme.published,
    sourceUrl: scheme.sourceUrl,
    lastCheckedAt: scheme.lastCheckedAt?.toISOString() ?? null,
    match: result,
  }));
}

export async function getSchemeOrThrow(id: string) {
  const scheme = await prisma.scheme.findUnique({ where: { id } });
  if (!scheme) throw new AppError(404, "SCHEME_NOT_FOUND", "Scheme not found.");
  return scheme;
}
