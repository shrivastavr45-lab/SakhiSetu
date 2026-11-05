import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AUTH_COOKIE } from "../middleware/auth.js";
import { AppError } from "../utils/errors.js";

const TOKEN_TTL_MS: Record<typeof env.JWT_EXPIRES_IN, number> = {
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  path: "/api",
  maxAge: TOKEN_TTL_MS[env.JWT_EXPIRES_IN],
};

export function setSessionCookie(response: Response, user: { id: string; email: string; role: UserRole }) {
  const signOptions: jwt.SignOptions = {
    subject: user.id,
    issuer: "sakhisetu-api",
    audience: "sakhisetu-web",
  };
  // expiresIn is guaranteed to be defined (the env schema requires it), so the
  // cast to the non-undefined subset is safe.
  signOptions.expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] & (string | number);
  const token = jwt.sign({ role: user.role, email: user.email }, env.JWT_SECRET, signOptions);
  response.cookie(AUTH_COOKIE, token, COOKIE_OPTIONS);
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/api" });
}

export async function registerDonor(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    return await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: UserRole.DONOR },
      select: { id: true, name: true, email: true, role: true },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
    }
    throw error;
  }
}

export async function verifyLogin(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
