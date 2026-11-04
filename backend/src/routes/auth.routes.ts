import { Router } from "express";
import { login, logout, me, register } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";

export const authRouter = Router();
authRouter.post("/register", validateBody(registerSchema), asyncHandler(register));
authRouter.post("/login", validateBody(loginSchema), asyncHandler(login));
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, me);
