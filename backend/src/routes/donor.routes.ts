import { Router } from "express";
import { UserRole } from "@prisma/client";
import { listAdminDonorDonations, listAdminDonors } from "../controllers/donor.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminDonorRouter = Router();
adminDonorRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminDonorRouter.get("/", asyncHandler(listAdminDonors));
adminDonorRouter.get("/:userId/donations", asyncHandler(listAdminDonorDonations));
