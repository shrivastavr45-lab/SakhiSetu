import { Router } from "express";
import { UserRole } from "@prisma/client";
import { approveSchemeSummary, askAssistant, dismissSchemeSummary, draftSchemeSummary } from "../controllers/ai.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { assistantSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const aiRouter = Router();
export const adminAiRouter = Router();
aiRouter.post("/", validateBody(assistantSchema), asyncHandler(askAssistant));
adminAiRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminAiRouter.post("/schemes/:id/summary-draft", asyncHandler(draftSchemeSummary));
adminAiRouter.post("/schemes/:id/summary-approve", asyncHandler(approveSchemeSummary));
adminAiRouter.post("/schemes/:id/summary-dismiss", asyncHandler(dismissSchemeSummary));
