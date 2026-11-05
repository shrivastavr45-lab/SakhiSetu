import { Router } from "express";
import { UserRole } from "@prisma/client";
import { listAdminReceiptsHandler } from "../controllers/receipt.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminReceiptRouter = Router();
adminReceiptRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminReceiptRouter.get("/", asyncHandler(listAdminReceiptsHandler));
