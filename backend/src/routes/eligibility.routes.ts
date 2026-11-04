import { Router } from "express";
import { checkEligibility } from "../controllers/eligibility.controller.js";
import { validateBody } from "../middleware/validate.js";
import { profileSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const eligibilityRouter = Router();
eligibilityRouter.post("/", validateBody(profileSchema), asyncHandler(checkEligibility));
