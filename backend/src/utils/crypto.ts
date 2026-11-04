import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

function encryptionKey(): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(env.PII_ENCRYPTION_KEY)) {
    return Buffer.from(env.PII_ENCRYPTION_KEY, "hex");
  }
  if (env.NODE_ENV !== "production") {
    return createHash("sha256").update("sakhisetu-local-demo-only-key").digest();
  }
  throw new AppError(500, "PII_KEY_MISSING", "Sensitive-data encryption is not configured.");
}

export function encryptPan(value: string | undefined): string | null {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(".");
}

export function decryptPan(value: string | null): string | null {
  if (!value) return null;
  const [ivHex, tagHex, cipherHex] = value.split(".");
  if (!ivHex || !tagHex || !cipherHex) throw new AppError(500, "PII_CIPHERTEXT_INVALID", "Stored donor PAN could not be read.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]).toString("utf8");
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export function deriveReceiptToken(donationId: string, idempotencyKey: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`sakhisetu-receipt:${donationId}:${idempotencyKey}`)
    .digest("base64url");
}

export function safeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
