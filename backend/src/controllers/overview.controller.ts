import type { RequestHandler } from "express";
import { getAdminOverview } from "../services/overview.service.js";

export const getOverview: RequestHandler = async (_req, res) => {
  const data = await getAdminOverview();
  res.json({ data });
};

