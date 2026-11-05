import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";

export type AuditLogInput = {
  adminId?: string | null;
  adminEmail: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
};

export type AuditLogRow = {
  id: string;
  adminId: string | null;
  adminEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  const id = randomUUID();
  const detailsJson = input.details ? JSON.stringify(input.details) : null;
  await prisma.$executeRaw`
    INSERT INTO "AuditLog" ("id", "adminId", "adminEmail", "action", "targetType", "targetId", "details", "createdAt")
    VALUES (${id}, ${input.adminId ?? null}, ${input.adminEmail}, ${input.action}, ${input.targetType ?? null}, ${input.targetId ?? null}, ${detailsJson}::jsonb, NOW())
  `;
}

export async function listAuditLogs(limit = 20): Promise<AuditLogRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    adminId: string | null;
    adminEmail: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: Record<string, unknown> | null;
    createdAt: Date;
  }>>`
    SELECT "id", "adminId", "adminEmail", "action", "targetType", "targetId", "details", "createdAt"
    FROM "AuditLog"
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

