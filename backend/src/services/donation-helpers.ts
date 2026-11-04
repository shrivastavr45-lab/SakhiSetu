import { createHmac } from "node:crypto";

export type DonationFingerprintInput = {
  campaignId: string;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  donorName: string;
  donorEmail: string;
  pan: string;
};

/** Stable request fingerprint for the database idempotency-key constraint. */
export function requestFingerprint(input: DonationFingerprintInput, secret: string): string {
  const canonicalPayload = JSON.stringify({
    campaignId: input.campaignId,
    amount: input.amount,
    frequency: input.frequency,
    donorName: input.donorName,
    donorEmail: input.donorEmail,
    pan: input.pan,
  });
  // HMAC keeps low-entropy personal fields (notably PAN) from being exposed to
  // offline dictionary checks if the donations table is leaked.
  return createHmac("sha256", secret).update(canonicalPayload).digest("hex");
}

/** Returns the Indian financial year (April–March) for a given instant. */
export function financialYear(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Could not determine the receipt financial year.");
  }
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** Formats a sequence-backed receipt number. Sequence values must be positive safe integers. */
export function formatReceiptNumber(date: Date, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError("Receipt sequence must be a positive safe integer.");
  }
  return `SS/${financialYear(date)}/${String(sequence).padStart(8, "0")}`;
}
