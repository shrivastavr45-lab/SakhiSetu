import type { RequestHandler } from "express";
import { clearSessionCookie, registerDonor, setSessionCookie, verifyLogin } from "../services/auth.service.js";
import { createAuditLog } from "../utils/audit.js";

export const register: RequestHandler = async (req, res) => {
  const user = await registerDonor(req.body as { name: string; email: string; password: string });
  setSessionCookie(res, user);
  res.status(201).json({ data: { user } });
};

export const login: RequestHandler = async (req, res) => {
  const user = await verifyLogin(req.body as { email: string; password: string });
  setSessionCookie(res, user);
  if (user.role === "ADMIN") {
    createAuditLog({
      adminId: user.id,
      adminEmail: user.email,
      action: "ADMIN_LOGIN",
      targetType: "AUTH",
      targetId: user.id,
      details: { ip: req.ip, userAgent: req.header("user-agent") },
    }).catch((err) => console.error("Audit log failed on login:", err));
  }
  res.json({ data: { user } });
};

export const logout: RequestHandler = (_req, res) => {
  clearSessionCookie(res);
  res.json({ data: { loggedOut: true } });
};

export const me: RequestHandler = (_req, res) => {
  res.json({ data: { user: res.locals.user } });
};
