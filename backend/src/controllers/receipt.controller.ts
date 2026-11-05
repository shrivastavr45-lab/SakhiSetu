import type { RequestHandler } from "express";
import { listAdminReceipts } from "../services/receipt.service.js";

export const listAdminReceiptsHandler: RequestHandler = async (_req, res) => {
  res.json({ data: await listAdminReceipts() });
};
