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

export async function listSchemes(filters: {
  q?: string;
  need?: string;
  district?: string;
  level?: string;
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(filters.limit ?? 100, 500); // cap at 500 per page
  const offset = filters.offset ?? 0;

  // Build DB-level WHERE — use indexed columns to avoid full-table scans
  const where: {
    published?: boolean;
    need?: string;
    level?: string;
    OR?: Array<Record<string, unknown>>;
  } = filters.includeDrafts ? {} : { published: true };

  if (filters.need) where.need = filters.need;           // uses @@index([published, need])
  if (filters.level) where.level = filters.level;        // uses @@index([level])

  // Text search: DB ILIKE is more efficient than loading all rows for substring match
  // We push to an OR clause so it is composable with other filters.
  if (filters.q) {
    const q = `%${filters.q.trim().toLowerCase()}%`;
    // Prisma doesn't support ILIKE directly in mode:"insensitive" for combined OR easily,
    // so we use raw approach via contains with insensitive mode on each field.
    const qTrimmed = filters.q.trim();
    where.OR = [
      { nameHi:   { contains: qTrimmed, mode: "insensitive" } },
      { nameEn:   { contains: qTrimmed, mode: "insensitive" } },
      { shortHi:  { contains: qTrimmed, mode: "insensitive" } },
      { shortEn:  { contains: qTrimmed, mode: "insensitive" } },
      { benefitHi:{ contains: qTrimmed, mode: "insensitive" } },
      { benefitEn:{ contains: qTrimmed, mode: "insensitive" } },
    ];
    void q; // suppress unused warning
  }

  const [rows, totalCount] = await Promise.all([
    prisma.scheme.findMany({
      where,
      orderBy: [{ published: "desc" }, { nameHi: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.scheme.count({ where }),
  ]);

  // District filter: still applied in memory because the JSON districts column
  // cannot be filtered efficiently with Prisma's typed queries. In practice,
  // all imported schemes have districts="all", so this filter only removes
  // a small fraction of rows.
  const filtered = filters.district
    ? rows.filter((row) =>
        row.districts === "all" ||
        (Array.isArray(row.districts) && (row.districts as string[]).includes(filters.district!))
      )
    : rows;

  return {
    schemes: filtered.map((row) => presentScheme(row, filters.includeDrafts === true)),
    total: filters.district ? filtered.length : totalCount, // exact when no district filter
    limit,
    offset,
  };
}

/**
 * Backward-compatible wrapper — returns a flat array (used by eligibility service,
 * AI assistant context builder, and tests that expect an array).
 */
export async function listSchemesAll(filters: {
  q?: string;
  need?: string;
  district?: string;
  level?: string;
  includeDrafts?: boolean;
}) {
  const result = await listSchemes({ ...filters, limit: 500, offset: 0 });
  return result.schemes;
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

