import type { RequestHandler } from "express";
import { approveHindiSchemeSummary, askSchemeAssistant, dismissHindiSchemeSummary, draftHindiSchemeSummary } from "../services/ai.service.js";

export const askAssistant: RequestHandler = async (req, res) => {
  const result = await askSchemeAssistant(req.body.message, req.body.language);
  res.json({ data: result });
};

export const draftSchemeSummary: RequestHandler = async (req, res) => {
  res.json({ data: await draftHindiSchemeSummary(req.params.id) });
};

export const approveSchemeSummary: RequestHandler = async (req, res) => {
  res.json({ data: await approveHindiSchemeSummary(req.params.id) });
};

export const dismissSchemeSummary: RequestHandler = async (req, res) => {
  res.json({ data: await dismissHindiSchemeSummary(req.params.id) });
};
