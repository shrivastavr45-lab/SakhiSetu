import type { RequestHandler } from "express";
import { approveHindiSchemeSummary, askSchemeAssistant, dismissHindiSchemeSummary, draftHindiSchemeSummary } from "../services/ai.service.js";
import { createAuditLog } from "../utils/audit.js";
import { AppError } from "../utils/errors.js";

function requireParam(value: string | string[] | undefined, name = "id"): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") throw new AppError(400, "MISSING_PARAM", `Route parameter '${name}' is required.`);
  return v;
}

export const askAssistant: RequestHandler = async (req, res) => {
  const result = await askSchemeAssistant(req.body.message, req.body.language);
  res.json({ data: result });
};

export const draftSchemeSummary: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const id = requireParam(req.params["id"]);
  const result = await draftHindiSchemeSummary(id);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "AI_SUMMARY_DRAFTED",
      targetType: "SCHEME",
      targetId: id,
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};

export const approveSchemeSummary: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const id = requireParam(req.params["id"]);
  const result = await approveHindiSchemeSummary(id);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "AI_SUMMARY_APPROVED",
      targetType: "SCHEME",
      targetId: id,
      details: { nameHi: result.name.hi },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};

export const dismissSchemeSummary: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const id = requireParam(req.params["id"]);
  const result = await dismissHindiSchemeSummary(id);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "AI_SUMMARY_DISMISSED",
      targetType: "SCHEME",
      targetId: id,
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};
