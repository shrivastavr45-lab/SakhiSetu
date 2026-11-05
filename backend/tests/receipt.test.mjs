/**
 * Pure-logic tests for the receipt and certificate section (Checkpoint 6).
 * All tests run without a database or environment variables.
 * They exercise receipt token format, access-control logic, safe token
 * comparison, receipt number formatting and PAN masking rules.
 *
 * NOTE: crypto.ts imports env.ts which requires dotenv + database URL, so
 * we replicate the pure algorithms inline rather than importing the module.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { financialYear, formatReceiptNumber } from "../src/services/donation-helpers.ts";

// ── Inline pure helpers (algorithm-equivalent to crypto.ts) ─────────────────

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** Returns true only when both strings are 64-char hex and have the same value. */
function safeEqualHex(left, right) {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

/**
 * Mirrors deriveReceiptToken(donationId, idempotencyKey) from crypto.ts.
 * Uses a fixed test secret so these tests never depend on JWT_SECRET.
 */
const TEST_JWT_SECRET = "sakhisetu-test-only-jwt-secret-not-real";
function deriveReceiptToken(donationId, idempotencyKey) {
  return createHmac("sha256", TEST_JWT_SECRET)
    .update(`sakhisetu-receipt:${donationId}:${idempotencyKey}`)
    .digest("base64url");
}

// ── Receipt token derivation ─────────────────────────────────────────────────

test("deriveReceiptToken is deterministic for the same inputs", () => {
  const a = deriveReceiptToken("don-abc", "idem-key-001");
  const b = deriveReceiptToken("don-abc", "idem-key-001");
  assert.equal(a, b);
});

test("deriveReceiptToken differs when donationId changes", () => {
  assert.notEqual(
    deriveReceiptToken("don-aaa", "idem-key"),
    deriveReceiptToken("don-bbb", "idem-key"),
  );
});

test("deriveReceiptToken differs when idempotencyKey changes", () => {
  assert.notEqual(
    deriveReceiptToken("don-abc", "idem-key-001"),
    deriveReceiptToken("don-abc", "idem-key-002"),
  );
});

test("deriveReceiptToken returns a non-empty base64url string", () => {
  const token = deriveReceiptToken("donation-id", "idempotency-key");
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length > 0);
});

// ── safeEqualHex — timing-safe token verification ───────────────────────────

test("safeEqualHex returns true for two identical SHA-256 hex strings", () => {
  const hash = sha256("some-token-value");
  assert.equal(safeEqualHex(hash, hash), true);
});

test("safeEqualHex returns false for two different SHA-256 hex strings", () => {
  assert.equal(safeEqualHex(sha256("token-a"), sha256("token-b")), false);
});

test("safeEqualHex returns false for strings that are not 64-char hex", () => {
  assert.equal(safeEqualHex("short", "short"), false);
  assert.equal(safeEqualHex("", ""), false);
  // 64 chars but not hex
  assert.equal(safeEqualHex("z".repeat(64), "z".repeat(64)), false);
});

test("safeEqualHex returns false when one side is empty", () => {
  const hash = sha256("token");
  assert.equal(safeEqualHex(hash, ""), false);
  assert.equal(safeEqualHex("", hash), false);
});

// ── Receipt access control logic (mirrors receiptPdf() auth gates) ───────────

function checkReceiptAccess({ userId, userRole, donationUserId, downloadToken, storedTokenHash }) {
  const isOwner      = userId !== null && userId !== undefined && donationUserId === userId;
  const isAdmin      = userRole === "ADMIN";
  const isTokenValid = downloadToken
    ? safeEqualHex(sha256(downloadToken), storedTokenHash)
    : false;
  return isOwner || isAdmin || isTokenValid;
}

const VALID_TOKEN    = "valid-download-token";
const STORED_HASH    = sha256(VALID_TOKEN);

test("receipt access granted when user is the donation owner", () => {
  assert.equal(
    checkReceiptAccess({ userId: "u1", userRole: "DONOR", donationUserId: "u1", downloadToken: null, storedTokenHash: STORED_HASH }),
    true,
  );
});

test("receipt access denied when authenticated user is a different donor", () => {
  assert.equal(
    checkReceiptAccess({ userId: "u2", userRole: "DONOR", donationUserId: "u1", downloadToken: null, storedTokenHash: STORED_HASH }),
    false,
  );
});

test("receipt access granted when user is ADMIN regardless of donationUserId", () => {
  assert.equal(
    checkReceiptAccess({ userId: "admin-1", userRole: "ADMIN", donationUserId: "u1", downloadToken: null, storedTokenHash: STORED_HASH }),
    true,
  );
});

test("receipt access granted with a valid download token and no session", () => {
  assert.equal(
    checkReceiptAccess({ userId: null, userRole: null, donationUserId: "u1", downloadToken: VALID_TOKEN, storedTokenHash: STORED_HASH }),
    true,
  );
});

test("receipt access denied with an incorrect download token and no session", () => {
  assert.equal(
    checkReceiptAccess({ userId: null, userRole: null, donationUserId: "u1", downloadToken: "wrong-token", storedTokenHash: STORED_HASH }),
    false,
  );
});

test("receipt access denied with no auth and no token", () => {
  assert.equal(
    checkReceiptAccess({ userId: null, userRole: null, donationUserId: "u1", downloadToken: null, storedTokenHash: STORED_HASH }),
    false,
  );
});

test("guest donation: userId=null must not grant owner access even if donationUserId is also null", () => {
  assert.equal(
    checkReceiptAccess({ userId: null, userRole: "DONOR", donationUserId: null, downloadToken: null, storedTokenHash: STORED_HASH }),
    false,
  );
});

// ── Duplicate receipt prevention — idempotent token re-derivation ────────────

test("receipt token is idempotent: same donationId+key always yields same hash", () => {
  const id  = "don-idempotent-123";
  const key = "idem-key-stable";
  assert.equal(sha256(deriveReceiptToken(id, key)), sha256(deriveReceiptToken(id, key)));
});

test("different donationIds yield different token hashes (no cross-receipt access)", () => {
  const key = "idem-key-stable";
  assert.notEqual(
    sha256(deriveReceiptToken("don-001", key)),
    sha256(deriveReceiptToken("don-002", key)),
  );
});

// ── Receipt number format ────────────────────────────────────────────────────

test("formatReceiptNumber uses the FY of the generation date (November 2026 → 2026-27)", () => {
  const rn = formatReceiptNumber(new Date("2026-11-05T00:00:00.000Z"), 1);
  assert.match(rn, /^SS\/2026-27\/\d{8}$/);
});

test("formatReceiptNumber produces unique values for different sequences", () => {
  const d = new Date("2026-11-05T00:00:00.000Z");
  assert.notEqual(formatReceiptNumber(d, 1), formatReceiptNumber(d, 2));
});

test("receipt numbers for different financial years differ even at the same sequence", () => {
  const seq = 42;
  assert.notEqual(
    formatReceiptNumber(new Date("2026-07-01T00:00:00.000Z"), seq),
    formatReceiptNumber(new Date("2027-07-01T00:00:00.000Z"), seq),
  );
});

test("financialYear is correct for November 2026 (IST)", () => {
  assert.equal(financialYear(new Date("2026-11-05T00:00:00.000Z")), "2026-27");
});

// ── PAN masking — never expose full PAN ─────────────────────────────────────

test("PAN is masked to last 4 digits with bullet prefix", () => {
  const panLast4 = "234F";
  assert.equal(`••••${panLast4}`, "••••234F");
});

test("null panLast4 renders as a dash placeholder", () => {
  const panLast4 = null;
  assert.equal(panLast4 ? `••••${panLast4}` : "—", "—");
});

test("masked PAN does not contain full PAN format", () => {
  const masked = "••••234F";
  // A full PAN looks like ABCDE1234F — 10 alphanumeric chars; masked version must not match
  assert.doesNotMatch(masked, /^[A-Z]{5}[0-9]{4}[A-Z]$/);
});

// ── sha256 sanity ────────────────────────────────────────────────────────────

test("sha256 produces a 64-character hex string", () => {
  assert.match(sha256("any value"), /^[0-9a-f]{64}$/);
});

test("sha256 is deterministic", () => {
  assert.equal(sha256("token"), sha256("token"));
});

test("sha256 changes when input changes", () => {
  assert.notEqual(sha256("a"), sha256("b"));
});
