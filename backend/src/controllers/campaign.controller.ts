import type { RequestHandler } from "express";
import { listCampaigns, updateCampaign } from "../services/campaign.service.js";

export const listPublicCampaigns: RequestHandler = async (_req, res) => {
  res.json({ data: await listCampaigns() });
};

export const listAdminCampaigns: RequestHandler = async (_req, res) => {
  res.json({ data: await listCampaigns(true) });
};

export const updateAdminCampaign: RequestHandler = async (req, res) => {
  res.json({ data: await updateCampaign(req.params.id, req.body) });
};
