import type { RequestHandler } from "express";
import { approveHindiSchemeSummary, askSchemeAssistant, dismissHindiSchemeSummary, draftHindiSchemeSummary } from "../services/ai.service.js";
import { createAuditLog } from "../utils/audit.js";

export const askAssistant: RequestHandler = async (req, res) => {
  const result = await askSchemeAssistant(req.body.message, req.body.language);
  res.json({ data: result });
};

export const draftSchemeSummary: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const result = await draftHindiSchemeSummary(req.params.id);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "AI_SUMMARY_DRAFTED",
      targetType: "SCHEME",
      targetId: req.params.id,
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};

export const approveSchemeSummary: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const result = await approveHindiSchemeSummary(req.params.id);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "AI_SUMMARY_APPROVED",
      targetType: "SCHEME",
      targetId: req.params.id,
      details: { nameHi: result.name.hi },
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};

export const dismissSchemeSummary: RequestHandler = async (req, res) => {
  const admin = res.locals.user as { id: string; email: string } | undefined;
  const result = await dismissHindiSchemeSummary(req.params.id);
  if (admin?.email) {
    createAuditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "AI_SUMMARY_DISMISSED",
      targetType: "SCHEME",
      targetId: req.params.id,
    }).catch((err) => console.error("Audit log error:", err));
  }
  res.json({ data: result });
};
