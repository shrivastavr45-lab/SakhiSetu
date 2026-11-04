import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/errors.js";

export const validateBody = (schema: ZodType): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    next(new AppError(400, "VALIDATION_ERROR", result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")));
    return;
  }
  req.body = result.data;
  next();
};
