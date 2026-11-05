import { Router } from "express";
import { UserRole } from "@prisma/client";
import { getOverview } from "../controllers/overview.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminOverviewRouter = Router();

adminOverviewRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminOverviewRouter.get("/", asyncHandler(getOverview));

