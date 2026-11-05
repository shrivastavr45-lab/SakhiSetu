import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { createScheme, findScheme, listSchemes, updateScheme } from "../services/scheme.service.js";
import { createAuditLog } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";

function queryString(value: unknown, maxLength = 100): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

export const listPublicSchemes: RequestHandler = async (req, res) => {
  const rows = await listSchemes({
    q: queryString(req.query.q),
    need: queryString(req.query.need, 30),
    district: queryString(req.query.district, 50),
  });
  res.json({ data: rows });
};

export const getPublicScheme: RequestHandler = async (req, res) => {
  res.json({ data: await findScheme(req.params.id) });
};

export const listAdminSchemes: RequestHandler = async (_req, res) => {
  res.json({ data: await listSchemes({ includeDrafts: true }) });
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
  const result = await updateScheme(req.params.id, req.body);
  if (admin?.email) {
    const action = req.body.published !== undefined
      ? (req.body.published ? "SCHEME_PUBLISHED" : "SCHEME_UNPUBLISHED")
      : "SCHEME_UPDATED";
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action,
      targetType: "SCHEME",
      targetId: result.id,
      details: { nameHi: result.name.hi, published: result.published },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};

export const deleteAdminScheme: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const exists = await prisma.scheme.findUnique({ where: { id: req.params.id }, select: { id: true, nameHi: true } });
  if (!exists) throw new AppError(404, "SCHEME_NOT_FOUND", "Scheme not found.");
  await prisma.scheme.delete({ where: { id: req.params.id } });
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "SCHEME_DELETED",
      targetType: "SCHEME",
      targetId: req.params.id,
      details: { nameHi: exists.nameHi },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: { deleted: true } });
};
