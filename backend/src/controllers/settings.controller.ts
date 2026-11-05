import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { listAuditLogs } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";

export const getHomepageBanner: RequestHandler = async (_req, res) => {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "homepage-banner" } });
  res.json({ data: { text: setting?.value ?? null } });
};

export const updateHomepageBanner: RequestHandler = async (req, res) => {
  const setting = await prisma.siteSetting.upsert({
    where: { key: "homepage-banner" },
    create: { key: "homepage-banner", value: req.body.text },
    update: { value: req.body.text },
  });
  res.json({ data: { text: setting.value } });
};

export const getAuditLog: RequestHandler = async (req, res) => {
  const limitRaw = typeof req.query["limit"] === "string" ? parseInt(req.query["limit"], 10) : 50;
  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 200) {
    throw new AppError(400, "INVALID_LIMIT", "limit must be an integer between 1 and 200.");
  }
  const rows = await listAuditLogs(limitRaw);
  res.json({ data: rows });
};
