import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { aiRouter, adminAiRouter } from "./routes/ai.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { campaignRouter, adminCampaignRouter } from "./routes/campaign.routes.js";
import { donationRouter, receiptRouter, adminDonationRouter } from "./routes/donation.routes.js";
import { adminDonorRouter } from "./routes/donor.routes.js";
import { eligibilityRouter } from "./routes/eligibility.routes.js";
import { schemeRouter, adminSchemeRouter } from "./routes/scheme.routes.js";
import { settingsRouter, adminSettingsRouter } from "./routes/settings.routes.js";
import { adminReceiptRouter } from "./routes/receipt.routes.js";
import { adminReportRouter } from "./routes/report.routes.js";
import { adminOverviewRouter } from "./routes/overview.routes.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({
  origin: env.FRONTEND_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Idempotency-Key",
    "X-Receipt-Token",
    "Authorization",
    "X-Test-Payment-Outcome",
  ],
}));
app.use(express.json({ limit: "50kb", strict: true }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many sign-in attempts. Please try again later." } },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Please wait before asking another question." } },
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ data: { status: "ok", database: "connected", paymentMode: "TEST" } });
  } catch {
    res.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message: "The database is not reachable." } });
  }
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/schemes", schemeRouter);
app.use("/api/eligibility", eligibilityRouter);
app.use("/api/campaigns", campaignRouter);
app.use("/api/donations", donationRouter);
app.use("/api/receipts", receiptRouter);
app.use("/api/assistant", aiLimiter, aiRouter);
app.use("/api/settings", settingsRouter);

app.use("/api/admin/schemes", adminSchemeRouter);
app.use("/api/admin/campaigns", adminCampaignRouter);
app.use("/api/admin/donations", adminDonationRouter);
app.use("/api/admin/donors", adminDonorRouter);
app.use("/api/admin/receipts", adminReceiptRouter);
app.use("/api/admin/reports", adminReportRouter);
app.use("/api/admin/ai", adminAiRouter);
app.use("/api/admin/overview", adminOverviewRouter);
app.use("/api/admin/settings", adminSettingsRouter);

app.use("/api", notFound);
app.use(errorHandler);
