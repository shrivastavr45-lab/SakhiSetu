import type { RequestHandler } from "express";

/** Adapts sync or async Express handlers to one centralized async error path. */
export const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  try {
    const result = handler(req, res, next);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void Promise.resolve(result).catch(next);
    }
  } catch (error) {
    next(error);
  }
};
