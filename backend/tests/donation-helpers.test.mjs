import test from "node:test";
import assert from "node:assert/strict";
import { financialYear, formatReceiptNumber, requestFingerprint } from "../src/services/donation-helpers.ts";

const input = {
  campaignId: "silai-kendra",
  amount: 1500,
  frequency: "ONE_TIME",
  donorName: "Sample Donor",
  donorEmail: "donor@example.test",
  pan: "ABCDE1234F",
};

test("donation request fingerprint is deterministic for the same canonical input", () => {
  assert.equal(requestFingerprint(input, "test-secret"), requestFingerprint({ ...input }, "test-secret"));
});

test("donation request fingerprint changes when any payment-relevant field changes", () => {
  assert.notEqual(requestFingerprint(input, "test-secret"), requestFingerprint({ ...input, amount: 1501 }, "test-secret"));
  assert.notEqual(requestFingerprint(input, "test-secret"), requestFingerprint({ ...input, pan: "ABCDE1234G" }, "test-secret"));
  assert.notEqual(requestFingerprint(input, "test-secret"), requestFingerprint({ ...input, campaignId: "maa-poshan" }, "test-secret"));
  assert.notEqual(requestFingerprint(input, "test-secret"), requestFingerprint(input, "different-secret"));
});

test("financial year uses the Indian April-to-March boundary", () => {
  assert.equal(financialYear(new Date("2026-03-31T18:29:59.000Z")), "2025-26");
  assert.equal(financialYear(new Date("2026-03-31T18:30:00.000Z")), "2026-27");
  assert.equal(financialYear(new Date("2026-04-01T00:00:00.000Z")), "2026-27");
});

test("receipt numbers are padded and include the financial year", () => {
  assert.equal(formatReceiptNumber(new Date("2026-04-01T00:00:00.000Z"), 1), "SS/2026-27/00000001");
  assert.equal(formatReceiptNumber(new Date("2026-03-31T18:29:59.000Z"), 12345678), "SS/2025-26/12345678");
});

test("receipt number formatter rejects invalid sequence values", () => {
  assert.throws(() => formatReceiptNumber(new Date(), 0), RangeError);
  assert.throws(() => formatReceiptNumber(new Date(), Number.MAX_SAFE_INTEGER + 1), RangeError);
});
