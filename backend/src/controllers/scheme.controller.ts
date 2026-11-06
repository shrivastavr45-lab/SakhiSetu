import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { createScheme, findScheme, listSchemes, updateScheme } from "../services/scheme.service.js";
import { createAuditLog } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";

function queryString(value: unknown, maxLength = 100): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

function queryInt(value: unknown, defaultValue: number, min: number, max: number): number {
  if (typeof value !== "string") return defaultValue;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
}

function requireParam(value: string | string[] | undefined, name = "id"): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") throw new AppError(400, "MISSING_PARAM", `Route parameter '${name}' is required.`);
  return v;
}

export const listPublicSchemes: RequestHandler = async (req, res) => {
  const q        = queryString(req.query["q"]);
  const need     = queryString(req.query["need"], 30);
  const district = queryString(req.query["district"], 50);
  const level    = queryString(req.query["level"], 30);
  const limit    = queryInt(req.query["limit"], 100, 1, 500);
  const offset   = queryInt(req.query["offset"], 0, 0, 100_000);
  const result = await listSchemes({
    ...(q        !== undefined ? { q }        : {}),
    ...(need     !== undefined ? { need }     : {}),
    ...(district !== undefined ? { district } : {}),
    ...(level    !== undefined ? { level }    : {}),
    limit,
    offset,
  });
  res.json({ data: result });
};

export const getPublicScheme: RequestHandler = async (req, res) => {
  res.json({ data: await findScheme(requireParam(req.params["id"])) });
};

export const listAdminSchemes: RequestHandler = async (req, res) => {
  // Forward search/filter params so the admin UI can use server-side filtering at scale
  const q        = queryString(req.query["q"]);
  const need     = queryString(req.query["need"], 30);
  const district = queryString(req.query["district"], 50);
  const level    = queryString(req.query["level"], 30);
  const limit    = queryInt(req.query["limit"], 500, 1, 1000); // higher default for admin
  const offset   = queryInt(req.query["offset"], 0, 0, 100_000);
  const result = await listSchemes({
    includeDrafts: true,
    ...(q        !== undefined ? { q }        : {}),
    ...(need     !== undefined ? { need }     : {}),
    ...(district !== undefined ? { district } : {}),
    ...(level    !== undefined ? { level }    : {}),
    limit,
    offset,
  });
  res.json({ data: result });
};

export const createAdminScheme: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const result = await createScheme(req.body);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "SCHEME_CREATED",
      targetType: "SCHEME",
      targetId: result.id,
      details: { nameHi: result.name.hi, published: result.published },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.status(201).json({ data: result });
};

export const updateAdminScheme: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const id = requireParam(req.params["id"]);
  const result = await updateScheme(id, req.body);
  if (admin?.email) {
    const action = req.body.published !== undefined
      ? (req.body.published ? "SCHEME_PUBLISHED" : "SCHEME_UNPUBLISHED")
      : "SCHEME_UPDATED";
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action,
      targetType: "SCHEME",
      targetId: id,
      details: { nameHi: result.name.hi, published: result.published },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};

export const deleteAdminScheme: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const id = requireParam(req.params["id"]);
  const exists = await prisma.scheme.findUnique({ where: { id }, select: { id: true, nameHi: true } });
  if (!exists) throw new AppError(404, "SCHEME_NOT_FOUND", "Scheme not found.");
  await prisma.scheme.delete({ where: { id } });
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "SCHEME_DELETED",
      targetType: "SCHEME",
      targetId: id,
      details: { nameHi: exists.nameHi },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: { deleted: true } });
};
