import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Support both the monorepo command (cwd = project root) and the standalone
// backend command (cwd = backend). Environment values always remain server-side.
const rootEnvPath = resolve(process.cwd(), "backend/.env");
const backendEnvPath = resolve(process.cwd(), ".env");
dotenv.config({ path: process.env.ENV_FILE ?? (existsSync(rootEnvPath) ? rootEnvPath : backendEnvPath) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgresql:" || protocol === "postgres:";
  }, "DATABASE_URL must use the PostgreSQL protocol."),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.enum(["15m", "30m", "1h", "2h", "4h", "1d"]).default("2h"),
  COOKIE_SECURE: z.string().default("false").transform((value) => value === "true"),
  PAYMENT_MODE: z.enum(["mock"]).default("mock"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  PDF_FONT_PATH: z.string().default(""),
  PII_ENCRYPTION_KEY: z.string().default(""),
  TRUST_NAME: z.string().default("SakhiSetu Demo Trust"),
  TRUST_ADDRESS: z.string().default("Bhopal, Madhya Pradesh"),
  TRUST_PAN: z.string().default("NOT-CONFIGURED-DEMO"),
  TRUST_80G_REGISTRATION: z.string().default("NOT-CONFIGURED-DEMO"),
  ADMIN_EMAIL: z.string().email().default("admin@sakhisetu.test"),
  ADMIN_PASSWORD: z.string().min(12).default("SakhiDemo!2026"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid backend environment configuration: ${details}`);
}

export const env = parsed.data;

if (env.NODE_ENV === "production") {
  if (env.JWT_SECRET === "replace-with-at-least-32-random-characters") {
    throw new Error("JWT_SECRET must be replaced before production startup.");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(env.PII_ENCRYPTION_KEY)) {
    throw new Error("PII_ENCRYPTION_KEY must be a 64-character hexadecimal key in production.");
  }
  if (!env.COOKIE_SECURE) throw new Error("COOKIE_SECURE must be true in production.");
  if (!env.FRONTEND_ORIGIN.startsWith("https://")) throw new Error("FRONTEND_ORIGIN must use HTTPS in production.");
  if (env.ADMIN_PASSWORD === "SakhiDemo!2026") throw new Error("ADMIN_PASSWORD must be replaced before production seeding.");
  if (env.TRUST_PAN === "NOT-CONFIGURED-DEMO" || env.TRUST_80G_REGISTRATION === "NOT-CONFIGURED-DEMO") {
    throw new Error("Trust PAN and 80G registration details must be verified before production setup.");
  }
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(env.TRUST_PAN)) {
    throw new Error("TRUST_PAN must be a verified PAN in the expected format before production setup.");
  }
}
