import { Router } from "express";
import { UserRole } from "@prisma/client";
import { getAuditLog, getHomepageBanner, updateHomepageBanner } from "../controllers/settings.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { bannerSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const settingsRouter = Router();
export const adminSettingsRouter = Router();
settingsRouter.get("/homepage-banner", asyncHandler(getHomepageBanner));
adminSettingsRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminSettingsRouter.put("/homepage-banner", validateBody(bannerSchema), asyncHandler(updateHomepageBanner));
adminSettingsRouter.get("/audit-log", asyncHandler(getAuditLog));
