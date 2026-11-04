import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { createScheme, findScheme, listSchemes, updateScheme } from "../services/scheme.service.js";
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
  res.status(201).json({ data: await createScheme(req.body) });
};

export const updateAdminScheme: RequestHandler = async (req, res) => {
  res.json({ data: await updateScheme(req.params.id, req.body) });
};

export const deleteAdminScheme: RequestHandler = async (req, res) => {
  const exists = await prisma.scheme.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!exists) throw new AppError(404, "SCHEME_NOT_FOUND", "Scheme not found.");
  await prisma.scheme.delete({ where: { id: req.params.id } });
  res.json({ data: { deleted: true } });
};
