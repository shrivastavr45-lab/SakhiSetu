import { Router } from "express";
import { UserRole } from "@prisma/client";
import { downloadForm10BdCsv, getReportSummary } from "../controllers/report.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminReportRouter = Router();
adminReportRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminReportRouter.get("/summary", asyncHandler(getReportSummary));
adminReportRouter.get("/form-10bd.csv", asyncHandler(downloadForm10BdCsv));
