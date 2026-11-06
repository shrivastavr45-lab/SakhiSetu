/**
 * Bulk scheme import service.
 * DB-touching code lives here; pure helpers live in import-helpers.ts.
 *
 * Design guarantees:
 * - Every imported scheme is created as an unpublished draft (published = false).
 * - rules JSON is always {} — eligibility rules are never inferred from text.
 * - Hindi fields are always blank — admin fills or uses the AI draft workflow.
 * - districts default to "all" — per-district availability is not in the dataset.
 * - Duplicate detection: skip rows that match by myschemeSlug, myschemeUrl, or
 *   normalised nameEn (case-insensitive). Never overwrites existing records.
 * - File size limit: 5 MB. Row limit: 3,000 rows per import.
 */

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";

export {
  parseCsv,
  inferNeed,
  mapCsvRow,
  validateRow,
  normaliseName,
  sanitiseUrl,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  type ImportSummary,
  type CsvRow,
  type MappedRow,
  type RowValidationResult,
  type Need,
} from "./import-helpers.js";

import {
  parseCsv,
  validateRow,
  normaliseName,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  type ImportSummary,
  type CsvRow,
  type MappedRow,
} from "./import-helpers.js";

// ---------------------------------------------------------------------------
// Duplicate detection (DB queries)
// ---------------------------------------------------------------------------

export type DuplicateCheckInput = {
  myschemeSlug: string | null;
  myschemeUrl:  string | null;
  nameEn:       string;
};

/**
 * Returns the ID of the first matching existing scheme, or null if none.
 * Priority: myschemeSlug → myschemeUrl → normalised nameEn.
 */
export async function findDuplicate(input: DuplicateCheckInput): Promise<string | null> {
  if (input.myschemeSlug) {
    const row = await prisma.scheme.findUnique({
      where: { myschemeSlug: input.myschemeSlug },
      select: { id: true },
    });
    if (row) return row.id;
  }

  if (input.myschemeUrl) {
    const row = await prisma.scheme.findFirst({
      where: { myschemeUrl: input.myschemeUrl },
      select: { id: true },
    });
    if (row) return row.id;
  }

  const row = await prisma.scheme.findFirst({
    where: { nameEn: { equals: normaliseName(input.nameEn), mode: "insensitive" } },
    select: { id: true },
  });
  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Insert one mapped row as an unpublished draft
// ---------------------------------------------------------------------------

async function insertDraft(m: MappedRow): Promise<void> {
  await prisma.scheme.create({
    data: {
      id:          `import-${randomUUID().slice(0, 8)}`,
      need:        m.need,
      nameHi:      m.nameHi,
      nameEn:      m.nameEn,
      deptHi:      m.deptHi,
      deptEn:      m.deptEn,
      shortHi:     m.shortHi,
      shortEn:     m.shortEn,
      benefitHi:   m.benefitHi,
      benefitEn:   m.benefitEn,
      eligibility: m.eligibility as Prisma.InputJsonValue,
      documents:   m.documents   as Prisma.InputJsonValue,
      steps:       m.steps       as Prisma.InputJsonValue,
      rules:       {}             as Prisma.InputJsonValue, // never inferred from text
      districts:   "all"         as Prisma.InputJsonValue,
      sourceUrl:   m.sourceUrl,
      myschemeSlug:  m.myschemeSlug,
      myschemeUrl:   m.myschemeUrl,
      level:         m.level,
      officialNoticeText: m.officialNoticeText,
      lastCheckedAt: new Date(),
      published:     false, // always draft — admin must publish explicitly
    },
  });
}

// ---------------------------------------------------------------------------
// Batch import orchestrator
// ---------------------------------------------------------------------------

/**
 * Imports validated rows into the database row by row.
 * Invalid rows are skipped and reported.
 * Duplicates are detected per-row and skipped without overwriting.
 */
export async function importSchemesFromRows(rows: CsvRow[]): Promise<ImportSummary> {
  const summary: ImportSummary = {
    totalRows:        rows.length,
    imported:         0,
    skippedDuplicates: 0,
    skippedInvalid:   0,
    errors:           [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-indexed, +1 for header row
    const row = rows[i];
    if (!row) continue;

    const validation = validateRow(row, rowNum);
    if (!validation.ok) {
      summary.skippedInvalid++;
      summary.errors.push({ row: rowNum, reason: validation.reason });
      continue;
    }

    const m = validation.mapped;

    const dupId = await findDuplicate({
      myschemeSlug: m.myschemeSlug,
      myschemeUrl:  m.myschemeUrl,
      nameEn:       m.nameEn,
    });
    if (dupId !== null) {
      summary.skippedDuplicates++;
      continue;
    }

    try {
      await insertDraft(m);
      summary.imported++;
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        // Unique constraint race — treat as late-detected duplicate
        summary.skippedDuplicates++;
      } else {
        summary.skippedInvalid++;
        summary.errors.push({
          row: rowNum,
          reason: err instanceof Error ? err.message : "Database insert failed.",
        });
      }
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Entry point: import from raw CSV text
// ---------------------------------------------------------------------------

export async function importSchemesFromCsvText(csvText: string): Promise<ImportSummary> {
  const { rows } = parseCsv(csvText);

  if (rows.length === 0) {
    return {
      totalRows: 0,
      imported: 0,
      skippedDuplicates: 0,
      skippedInvalid: 0,
      errors: [{ row: 1, reason: "CSV file is empty or contains only a header row." }],
    };
  }

  if (rows.length > IMPORT_MAX_ROWS) {
    return {
      totalRows:        rows.length,
      imported:         0,
      skippedDuplicates: 0,
      skippedInvalid:   rows.length,
      errors: [{ row: 1, reason: `Import exceeds the ${IMPORT_MAX_ROWS}-row limit. Split the file and re-import.` }],
    };
  }

  return importSchemesFromRows(rows);
}
