import type { RequestHandler } from "express";
import { clearSessionCookie, registerDonor, setSessionCookie, verifyLogin } from "../services/auth.service.js";

export const register: RequestHandler = async (req, res) => {
  const user = await registerDonor(req.body as { name: string; email: string; password: string });
  setSessionCookie(res, user);
  res.status(201).json({ data: { user } });
};

export const login: RequestHandler = async (req, res) => {
  const user = await verifyLogin(req.body as { email: string; password: string });
  setSessionCookie(res, user);
  res.json({ data: { user } });
};

export const logout: RequestHandler = (_req, res) => {
  clearSessionCookie(res);
  res.json({ data: { loggedOut: true } });
};

export const me: RequestHandler = (_req, res) => {
  res.json({ data: { user: res.locals.user } });
};
