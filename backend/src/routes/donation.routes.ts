import { Router } from "express";
import { UserRole } from "@prisma/client";
import { createDonation, downloadReceipt, listAdminDonations, listDonorDonations } from "../controllers/donation.controller.js";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { donationSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const donationRouter = Router();
export const receiptRouter = Router();
export const adminDonationRouter = Router();
donationRouter.post("/", optionalAuthenticate, validateBody(donationSchema), asyncHandler(createDonation));
donationRouter.get("/mine", authenticate, asyncHandler(listDonorDonations));
receiptRouter.get("/:id.pdf", optionalAuthenticate, asyncHandler(downloadReceipt));
adminDonationRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminDonationRouter.get("/", asyncHandler(listAdminDonations));
