import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `No API route for ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong. Please try again.";

  if (error instanceof AppError) {
    status = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      status = 409;
      code = "DUPLICATE_RESOURCE";
      message = "This record already exists.";
    } else if (error.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "The requested record was not found.";
    } else if (error.code === "P2003") {
      status = 409;
      code = "RELATION_CONFLICT";
      message = "This record cannot be changed while related records exist.";
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    status = 400;
    code = "INVALID_JSON";
    message = "The request body must contain valid JSON.";
  } else if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    status = 413;
    code = "REQUEST_TOO_LARGE";
    message = "The request body is too large.";
  }

  if (status >= 500) console.error("API error:", error);
  res.status(status).json({
    error: {
      code,
      message,
      ...(env.NODE_ENV !== "production" && status >= 500
        ? { detail: error instanceof Error ? error.message : String(error) }
        : {}),
    },
  });
};
