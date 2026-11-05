import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

export type Localized = { hi: string; en: string };

export function presentScheme(scheme: {
  id: string; code: string | null; need: string; nameHi: string; nameEn: string; deptHi: string; deptEn: string;
  shortHi: string; shortEn: string; benefitHi: string; benefitEn: string; eligibility: Prisma.JsonValue;
  documents: Prisma.JsonValue; steps: Prisma.JsonValue; rules: Prisma.JsonValue; districts: Prisma.JsonValue;
  sourceUrl: string | null; lastCheckedAt: Date | null; published: boolean; aiSummaryDraftHi?: string | null;
  aiSummaryApproved?: boolean;
  officialNoticeText?: string | null;
  myschemeSlug?: string | null;
  level?: string | null;
  myschemeUrl?: string | null;
}, includeEditorialFields = false) {
  return {
    id: scheme.id,
    code: scheme.code,
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
    sourceUrl: scheme.sourceUrl,
    lastCheckedAt: scheme.lastCheckedAt?.toISOString() ?? null,
    published: scheme.published,
    // Import-sourced metadata — always included so the admin UI and API clients
    // can display the origin of a scheme without needing an editorial flag.
    myschemeSlug: scheme.myschemeSlug ?? null,
    level: scheme.level ?? null,
    myschemeUrl: scheme.myschemeUrl ?? null,
    ...(includeEditorialFields && scheme.aiSummaryDraftHi !== undefined ? { aiSummaryDraftHi: scheme.aiSummaryDraftHi } : {}),
    ...(includeEditorialFields && scheme.aiSummaryApproved !== undefined ? { aiSummaryApproved: scheme.aiSummaryApproved } : {}),
    ...(includeEditorialFields && scheme.officialNoticeText !== undefined ? { officialNoticeText: scheme.officialNoticeText } : {}),
  };
}

export async function listSchemes(filters: { q?: string; need?: string; district?: string; includeDrafts?: boolean }) {
  const rows = await prisma.scheme.findMany({
    where: filters.includeDrafts ? {} : { published: true },
    orderBy: [{ published: "desc" }, { nameHi: "asc" }],
  });
  const query = filters.q?.trim().toLocaleLowerCase("hi-IN");
  return rows
    .filter((row) => !filters.need || row.need === filters.need)
    .filter((row) => !filters.district || row.districts === "all" || (Array.isArray(row.districts) && row.districts.includes(filters.district)))
    .filter((row) => !query || [row.nameHi, row.nameEn, row.shortHi, row.shortEn, row.benefitHi, row.benefitEn].some((value) => value.toLocaleLowerCase("hi-IN").includes(query)))
    .map((row) => presentScheme(row, filters.includeDrafts === true));
}

export async function findScheme(id: string) {
  const scheme = await prisma.scheme.findUnique({ where: { id } });
  if (!scheme || !scheme.published) throw new AppError(404, "SCHEME_NOT_FOUND", "This scheme is not available.");
  return presentScheme(scheme);
}

export async function createScheme(input: {
  id?: string; code?: string | null; need: string; name: Localized; dept?: Localized; short?: Localized; benefit?: Localized;
  eligibility?: Localized[]; documents?: Localized[]; steps?: Localized[]; rules?: Record<string, unknown>;
  districts?: "all" | string[]; sourceUrl?: string | null; officialNoticeText?: string | null;
  published?: boolean; lastCheckedAt?: string | Date | null;
  myschemeSlug?: string | null; level?: string | null; myschemeUrl?: string | null;
}) {
  const id = input.id ?? `scheme-${randomUUID().slice(0, 8)}`;
  const lastChecked = input.lastCheckedAt ? new Date(input.lastCheckedAt) : (input.sourceUrl ? new Date() : null);
  const row = await prisma.scheme.create({
    data: {
      id,
      code: input.code?.trim() || null,
      need: input.need,
      nameHi: input.name.hi,
      nameEn: input.name.en,
      deptHi: input.dept?.hi ?? "",
      deptEn: input.dept?.en ?? "",
      shortHi: input.short?.hi ?? "",
      shortEn: input.short?.en ?? "",
      benefitHi: input.benefit?.hi ?? "",
      benefitEn: input.benefit?.en ?? "",
      eligibility: (input.eligibility ?? []) as Prisma.InputJsonValue,
      documents: (input.documents ?? []) as Prisma.InputJsonValue,
      steps: (input.steps ?? []) as Prisma.InputJsonValue,
      rules: (input.rules ?? {}) as Prisma.InputJsonValue,
      districts: (input.districts ?? "all") as Prisma.InputJsonValue,
      sourceUrl: input.sourceUrl ?? null,
      officialNoticeText: input.officialNoticeText ?? null,
      lastCheckedAt: lastChecked,
      published: input.published ?? false,
      myschemeSlug: input.myschemeSlug?.trim() || null,
      level: input.level?.trim() || null,
      myschemeUrl: input.myschemeUrl?.trim() || null,
    },
  });
  return presentScheme(row, true);
}

export async function updateScheme(id: string, input: {
  code?: string | null; need?: string; name?: Localized; dept?: Localized; short?: Localized; benefit?: Localized;
  eligibility?: Localized[]; documents?: Localized[]; steps?: Localized[]; rules?: Record<string, unknown>;
  districts?: "all" | string[]; sourceUrl?: string | null; officialNoticeText?: string | null; published?: boolean;
  lastCheckedAt?: string | Date | null;
  myschemeSlug?: string | null; level?: string | null; myschemeUrl?: string | null;
}) {
  const current = await prisma.scheme.findUnique({ where: { id } });
  if (!current) throw new AppError(404, "SCHEME_NOT_FOUND", "Scheme not found.");
  if (input.published === true && current.aiSummaryDraftHi && !current.aiSummaryApproved) {
    throw new AppError(409, "AI_SUMMARY_REVIEW_REQUIRED", "Review and approve the pending Hindi AI summary before publishing this scheme.");
  }
  const { name, dept, short, benefit, eligibility, documents, steps, rules, districts, code, lastCheckedAt, myschemeSlug, level, myschemeUrl, ...rest } = input;
  const computedLastChecked = lastCheckedAt !== undefined
    ? (lastCheckedAt ? new Date(lastCheckedAt) : null)
    : (input.sourceUrl !== undefined ? (input.sourceUrl ? new Date() : null) : undefined);

  const row = await prisma.scheme.update({
    where: { id },
    data: {
      ...rest,
      ...(code !== undefined ? { code: code?.trim() || null } : {}),
      ...(computedLastChecked !== undefined ? { lastCheckedAt: computedLastChecked } : {}),
      ...(name ? { nameHi: name.hi, nameEn: name.en } : {}),
      ...(dept ? { deptHi: dept.hi, deptEn: dept.en } : {}),
      ...(short ? { shortHi: short.hi, shortEn: short.en } : {}),
      ...(benefit ? { benefitHi: benefit.hi, benefitEn: benefit.en } : {}),
      ...(eligibility ? { eligibility: eligibility as Prisma.InputJsonValue } : {}),
      ...(documents ? { documents: documents as Prisma.InputJsonValue } : {}),
      ...(steps ? { steps: steps as Prisma.InputJsonValue } : {}),
      ...(rules ? { rules: rules as Prisma.InputJsonValue } : {}),
      ...(districts ? { districts: districts as Prisma.InputJsonValue } : {}),
      ...(myschemeSlug !== undefined ? { myschemeSlug: myschemeSlug?.trim() || null } : {}),
      ...(level !== undefined ? { level: level?.trim() || null } : {}),
      ...(myschemeUrl !== undefined ? { myschemeUrl: myschemeUrl?.trim() || null } : {}),
      ...(((input.short !== undefined && (input.short.hi !== current.shortHi || input.short.en !== current.shortEn)) ||
        (input.officialNoticeText !== undefined && input.officialNoticeText !== current.officialNoticeText))
        ? { aiSummaryApproved: false }
        : {}),
    },
  });
  return presentScheme(row, true);
}

