import type { RequestHandler } from "express";
import { listCampaigns, updateCampaign } from "../services/campaign.service.js";
import { AppError } from "../utils/errors.js";

function requireParam(value: string | string[] | undefined, name = "id"): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") throw new AppError(400, "MISSING_PARAM", `Route parameter '${name}' is required.`);
  return v;
}

export const listPublicCampaigns: RequestHandler = async (_req, res) => {
  res.json({ data: await listCampaigns() });
};

export const listAdminCampaigns: RequestHandler = async (_req, res) => {
  res.json({ data: await listCampaigns(true) });
};

export const updateAdminCampaign: RequestHandler = async (req, res) => {
  res.json({ data: await updateCampaign(requireParam(req.params["id"]), req.body) });
};
