import type { RequestHandler } from "express";
import { listDonorDonationsForAdmin, listDonors } from "../services/donor.service.js";
import { AppError } from "../utils/errors.js";

function requireParam(value: string | string[] | undefined, name = "id"): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") throw new AppError(400, "MISSING_PARAM", `Route parameter '${name}' is required.`);
  return v;
}

export const listAdminDonors: RequestHandler = async (_req, res) => {
  res.json({ data: await listDonors() });
};

export const listAdminDonorDonations: RequestHandler = async (req, res) => {
  res.json({ data: await listDonorDonationsForAdmin(requireParam(req.params["userId"], "userId")) });
};
