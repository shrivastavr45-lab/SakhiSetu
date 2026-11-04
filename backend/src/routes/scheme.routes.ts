import { Router } from "express";
import { UserRole } from "@prisma/client";
import { createAdminScheme, deleteAdminScheme, getPublicScheme, listAdminSchemes, listPublicSchemes, updateAdminScheme } from "../controllers/scheme.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createSchemeSchema, updateSchemeSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const schemeRouter = Router();
export const adminSchemeRouter = Router();
schemeRouter.get("/", asyncHandler(listPublicSchemes));
schemeRouter.get("/:id", asyncHandler(getPublicScheme));
adminSchemeRouter.use(authenticate, requireRole(UserRole.ADMIN));
adminSchemeRouter.get("/", asyncHandler(listAdminSchemes));
adminSchemeRouter.post("/", validateBody(createSchemeSchema), asyncHandler(createAdminScheme));
adminSchemeRouter.patch("/:id", validateBody(updateSchemeSchema), asyncHandler(updateAdminScheme));
adminSchemeRouter.delete("/:id", asyncHandler(deleteAdminScheme));
