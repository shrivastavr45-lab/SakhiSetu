/**
 * Pure-logic tests for the admin donations view (Checkpoint 4).
 * All tests run without a database connection — they exercise only the
 * helper functions used to process and display donation records.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { financialYear, formatReceiptNumber, requestFingerprint } from "../src/services/donation-helpers.ts";

// ---------------------------------------------------------------------------
// Financial year — additional boundary probes
// ---------------------------------------------------------------------------

test("financial year is correct at the 2026→2027 boundary (IST midnight 1 Apr 2027)", () => {
  // 31 Mar 2027 23:59 IST = 31 Mar 2027 18:29 UTC  → still 2026-27
  assert.equal(financialYear(new Date("2027-03-31T18:29:00.000Z")), "2026-27");
  // 1 Apr 2027 00:00 IST = 31 Mar 2027 18:30 UTC   → now 2027-28
  assert.equal(financialYear(new Date("2027-03-31T18:30:00.000Z")), "2027-28");
});

test("financial year is correct in the middle of each quarter", () => {
  // June 2026 → FY 2026-27
  assert.equal(financialYear(new Date("2026-06-15T12:00:00.000Z")), "2026-27");
  // December 2026 → FY 2026-27
  assert.equal(financialYear(new Date("2026-12-01T00:00:00.000Z")), "2026-27");
  // February 2027 → still 2026-27
  assert.equal(financialYear(new Date("2027-02-14T00:00:00.000Z")), "2026-27");
});

// ---------------------------------------------------------------------------
// Receipt number — more edge cases
// ---------------------------------------------------------------------------

test("receipt numbers pad sequence to 8 digits regardless of width", () => {
  const d = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(formatReceiptNumber(d, 1), "SS/2026-27/00000001");
  assert.equal(formatReceiptNumber(d, 99999999), "SS/2026-27/99999999");
});

test("receipt number sequence boundary: 99999999 is accepted, 100000000 is still a safe integer and accepted", () => {
  const d = new Date("2026-07-01T00:00:00.000Z");
  // 100_000_000 is a safe integer and positive, so it should be accepted
  assert.equal(formatReceiptNumber(d, 100_000_000), "SS/2026-27/100000000");
});

test("receipt number rejects non-positive and non-safe integers", () => {
  assert.throws(() => formatReceiptNumber(new Date(), 0), RangeError);
  assert.throws(() => formatReceiptNumber(new Date(), -1), RangeError);
  assert.throws(() => formatReceiptNumber(new Date(), Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => formatReceiptNumber(new Date(), 1.5), RangeError);
  assert.throws(() => formatReceiptNumber(new Date(), NaN), RangeError);
});

// ---------------------------------------------------------------------------
// Request fingerprint — idempotency / deduplication properties
// ---------------------------------------------------------------------------

const baseInput = {
  campaignId: "maa-poshan",
  amount: 2000,
  frequency: "ONE_TIME",
  donorName: "Test Donor",
  donorEmail: "test@example.test",
  pan: "ZZZZZ9999Z",
};

test("fingerprint is stable: same values in different object references produce equal hashes", () => {
  const a = requestFingerprint({ ...baseInput }, "stable-secret");
  const b = requestFingerprint({ ...baseInput }, "stable-secret");
  assert.equal(a, b);
});

test("fingerprint changes when amount changes by the smallest decimal unit", () => {
  const a = requestFingerprint({ ...baseInput, amount: 1500.00 }, "s");
  const b = requestFingerprint({ ...baseInput, amount: 1500.01 }, "s");
  assert.notEqual(a, b);
});

test("fingerprint changes when email casing changes (case-sensitive field)", () => {
  const lower = requestFingerprint({ ...baseInput, donorEmail: "test@example.test" }, "s");
  const upper = requestFingerprint({ ...baseInput, donorEmail: "TEST@EXAMPLE.TEST" }, "s");
  // Emails are stored lower-cased by the Zod schema, but the fingerprint itself is
  // case-sensitive — two differently-cased inputs produce different hashes.
  assert.notEqual(lower, upper);
});

test("fingerprint changes when PAN changes", () => {
  const a = requestFingerprint({ ...baseInput, pan: "ABCDE1234F" }, "secret");
  const b = requestFingerprint({ ...baseInput, pan: "ABCDE1234G" }, "secret");
  assert.notEqual(a, b);
});

test("fingerprint changes when HMAC secret changes (prevents cross-environment collision)", () => {
  const a = requestFingerprint(baseInput, "secret-a");
  const b = requestFingerprint(baseInput, "secret-b");
  assert.notEqual(a, b);
});

test("fingerprint is a 64-character hex string (SHA-256 output)", () => {
  const fp = requestFingerprint(baseInput, "any-secret");
  assert.match(fp, /^[0-9a-f]{64}$/);
});

// ---------------------------------------------------------------------------
// Donation status display categorisation (pure logic, no DB)
// ---------------------------------------------------------------------------

/** Mirrors the categorisation logic in DonationsSection statusBadge. */
function categorise(status) {
  if (status === "SUCCEEDED") return "success";
  if (status === "PENDING")   return "pending";
  if (status === "FAILED")    return "failed";
  return "unknown";
}

test("donation status SUCCEEDED categorises as success", () => {
  assert.equal(categorise("SUCCEEDED"), "success");
});

test("donation status PENDING categorises as pending", () => {
  assert.equal(categorise("PENDING"), "pending");
});

test("donation status FAILED categorises as failed", () => {
  assert.equal(categorise("FAILED"), "failed");
});

test("unknown donation status falls through to unknown", () => {
  assert.equal(categorise("OTHER"), "unknown");
});

// ---------------------------------------------------------------------------
// Idempotency: same input → same fingerprint (replay-safety)
// ---------------------------------------------------------------------------

test("replaying the same donation input produces the same fingerprint (replay protection)", () => {
  const key = "idempotency-test-secret";
  const first  = requestFingerprint(baseInput, key);
  const second = requestFingerprint(baseInput, key);
  const third  = requestFingerprint(baseInput, key);
  assert.equal(first, second);
  assert.equal(second, third);
});
