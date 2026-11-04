import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

export const AUTH_COOKIE = "sakhisetu_session";

type TokenPayload = { sub: string; role: UserRole; email: string };

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = req.cookies?.[AUTH_COOKIE] as string | undefined ?? bearer;
    if (!token) throw new AppError(401, "AUTH_REQUIRED", "Please sign in to continue.");

    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "sakhisetu-api", audience: "sakhisetu-web" }) as TokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true, role: true } });
    if (!user) throw new AppError(401, "SESSION_INVALID", "Your session is no longer valid. Please sign in again.");
    res.locals.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, "SESSION_INVALID", "Your session has expired. Please sign in again."));
      return;
    }
    next(error);
  }
};

export const optionalAuthenticate: RequestHandler = async (req, res, next) => {
  try {
    const bearer = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = req.cookies?.[AUTH_COOKIE] as string | undefined ?? bearer;
    if (!token) return next();
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "sakhisetu-api", audience: "sakhisetu-web" }) as TokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true, role: true } });
    if (user) res.locals.user = user;
    next();
  } catch (error) {
    // This middleware is deliberately optional: an expired or malformed cookie
    // must not block a public flow that has its own authorization (receipt token).
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      next();
      return;
    }
    next(error);
  }
};

export const requireRole = (...roles: UserRole[]): RequestHandler => (req, res, next) => {
  const user = res.locals.user;
  if (!user) return next(new AppError(401, "AUTH_REQUIRED", "Please sign in to continue."));
  if (!roles.includes(user.role)) return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
  next();
};
