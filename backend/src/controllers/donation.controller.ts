import type { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { createTestDonation, listAllDonations, listMyDonations, receiptPdf } from "../services/donation.service.js";
import { AppError } from "../utils/errors.js";

function requireParam(value: string | string[] | undefined, name = "id"): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") throw new AppError(400, "MISSING_PARAM", `Route parameter '${name}' is required.`);
  return v;
}

export const createDonation: RequestHandler = async (req, res) => {
  const user = res.locals.user as { id: string; role: UserRole } | undefined;
  const result = await createTestDonation(
    req.body,
    req.header("Idempotency-Key"),
    user,
    process.env["NODE_ENV"] !== "production" && req.header("X-Test-Payment-Outcome") === "failed",
  );
  res.status(201).json({ data: result });
};

export const listDonorDonations: RequestHandler = async (_req, res) => {
  const user = res.locals.user as { id: string };
  res.json({ data: await listMyDonations(user.id) });
};

export const downloadReceipt: RequestHandler = async (req, res) => {
  const user = res.locals.user as { id: string; role: UserRole } | undefined;
  const result = await receiptPdf(requireParam(req.params["id"]), user, req.header("X-Receipt-Token"));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="SakhiSetu-${result.receiptNumber.replaceAll("/", "-")}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(result.buffer);
};

export const listAdminDonations: RequestHandler = async (_req, res) => {
  res.json({ data: await listAllDonations() });
};
