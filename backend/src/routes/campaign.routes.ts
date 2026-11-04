import { Router } from "express";
import { UserRole } from "@prisma/client";
import { listAdminCampaigns, listPublicCampaigns, updateAdminCampaign } from "../controllers/campaign.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { updateCampaignSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const campaignRouter = Router();
export const adminCampaignRouter = Router();
campaignRouter.get("/", asyncHandler(listPublicCampaigns));
adminCampaignRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminCampaignRouter.get("/", asyncHandler(listAdminCampaigns));
adminCampaignRouter.patch("/:id", validateBody(updateCampaignSchema), asyncHandler(updateAdminCampaign));
