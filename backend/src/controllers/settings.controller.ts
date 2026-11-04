import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";

export const getHomepageBanner: RequestHandler = async (_req, res) => {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "homepage-banner" } });
  res.json({ data: { text: setting?.value ?? null } });
};

export const updateHomepageBanner: RequestHandler = async (req, res) => {
  const setting = await prisma.siteSetting.upsert({
    where: { key: "homepage-banner" },
    create: { key: "homepage-banner", value: req.body.text },
    update: { value: req.body.text },
  });
  res.json({ data: { text: setting.value } });
};
