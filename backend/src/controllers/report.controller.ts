import type { RequestHandler } from "express";
import { buildForm10BdCsv, getAdminReportSummary } from "../services/report.service.js";
import { AppError } from "../utils/errors.js";

export const getReportSummary: RequestHandler = async (_req, res) => {
  res.json({ data: await getAdminReportSummary() });
};

export const downloadForm10BdCsv: RequestHandler = async (req, res) => {
  const fy = typeof req.query["fy"] === "string" ? req.query["fy"].trim() : "";
  if (!fy || !/^\d{4}-\d{2}$/.test(fy)) {
    throw new AppError(400, "INVALID_FY", "Provide fy as YYYY-YY, e.g. 2026-27.");
  }
  const csv = await buildForm10BdCsv(fy);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="SakhiSetu-Form10BD-DEMO-${fy}.csv"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(csv);
};
