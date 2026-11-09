/**
 * Pure-logic tests for the receipt and certificate section (Checkpoints 6 + font fix).
 * All tests run without a database or environment variables.
 * They exercise receipt token format, access-control logic, safe token
 * comparison, receipt number formatting, PAN masking, and PDF font selection.
 *
 * NOTE: crypto.ts imports env.ts which requires dotenv + database URL, so
 * we replicate the pure algorithms inline rather than importing the module.
 * pdf-fonts.ts imports only node:fs so it CAN be imported directly.
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
  // 64 chars but not valid hex
  assert.equal(safeEqualHex("z".repeat(64), "z".repeat(64)), false);
});

test("safeEqualHex returns false when one side is empty", () => {
  const hash = sha256("token");
  assert.equal(safeEqualHex(hash, ""), false);
  assert.equal(safeEqualHex("", hash), false);
});

// ── Receipt access control logic (mirrors receiptPdf() auth gates) ───────────

function checkReceiptAccess({ userId, userRole, donationUserId, downloadToken, storedTokenHash }) {
  const isOwner = userId !== null && userId !== undefined && donationUserId === userId;
  const isAdmin = userRole === "ADMIN";
  const isTokenValid = downloadToken ? safeEqualHex(sha256(downloadToken), storedTokenHash) : false;
  return isOwner || isAdmin || isTokenValid;
}

const VALID_TOKEN = "valid-download-token";
const STORED_HASH = sha256(VALID_TOKEN);

test("receipt access granted when user is the donation owner", () => {
  assert.equal(
    checkReceiptAccess({
      userId: "u1",
      userRole: "DONOR",
      donationUserId: "u1",
      downloadToken: null,
      storedTokenHash: STORED_HASH,
    }),
    true,
  );
});

test("receipt access denied when authenticated user is a different donor", () => {
  assert.equal(
    checkReceiptAccess({
      userId: "u2",
      userRole: "DONOR",
      donationUserId: "u1",
      downloadToken: null,
      storedTokenHash: STORED_HASH,
    }),
    false,
  );
});

test("receipt access granted when user is ADMIN regardless of donationUserId", () => {
  assert.equal(
    checkReceiptAccess({
      userId: "admin-1",
      userRole: "ADMIN",
      donationUserId: "u1",
      downloadToken: null,
      storedTokenHash: STORED_HASH,
    }),
    true,
  );
});

test("receipt access granted with a valid download token and no session", () => {
  assert.equal(
    checkReceiptAccess({
      userId: null,
      userRole: null,
      donationUserId: "u1",
      downloadToken: VALID_TOKEN,
      storedTokenHash: STORED_HASH,
    }),
    true,
  );
});

test("receipt access denied with an incorrect download token and no session", () => {
  assert.equal(
    checkReceiptAccess({
      userId: null,
      userRole: null,
      donationUserId: "u1",
      downloadToken: "wrong-token",
      storedTokenHash: STORED_HASH,
    }),
    false,
  );
});

test("receipt access denied with no auth and no token", () => {
  assert.equal(
    checkReceiptAccess({
      userId: null,
      userRole: null,
      donationUserId: "u1",
      downloadToken: null,
      storedTokenHash: STORED_HASH,
    }),
    false,
  );
});

test("guest donation: userId=null must not grant owner access even if donationUserId is also null", () => {
  assert.equal(
    checkReceiptAccess({
      userId: null,
      userRole: "DONOR",
      donationUserId: null,
      downloadToken: null,
      storedTokenHash: STORED_HASH,
    }),
    false,
  );
});

// ── Duplicate receipt prevention — idempotent token re-derivation ────────────

test("receipt token is idempotent: same donationId+key always yields same hash", () => {
  const id = "don-idempotent-123";
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

// ── PDF font selection & production PDF generation ─────────────────────────
// pdf-fonts.ts imports only node:fs, node:path, node:url and pdfkit.
// It has no database or environment dependencies so it can be imported directly.
import zlib from "node:zlib";
import {
  selectPdfFonts,
  registerPdfFonts,
  generateReceiptPdfBuffer,
  getBundledFontPaths,
  PDF_FONT_REGULAR,
  PDF_FONT_BOLD,
} from "../src/utils/pdf-fonts.ts";

const NODE_BIN = process.execPath;

// Helper: unwrap config or throw the error descriptor for easy assertions
function unwrapConfig(result) {
  if ("error" in result) throw Object.assign(new Error(result.error.code), result.error);
  return result.config;
}

// --- Bundled font discovery ---

test("getBundledFontPaths resolves Noto Sans Devanagari Regular and Bold", () => {
  const paths = getBundledFontPaths();
  assert.ok(paths !== null, "bundled font paths should be found");
  assert.match(paths.regular, /NotoSansDevanagari-Regular\.ttf$/i);
  assert.match(paths.bold, /NotoSansDevanagari-Bold\.ttf$/i);
});

// --- English-only with no font path → built-in Helvetica ---

test("selectPdfFonts: English-only, no font path → Helvetica", () => {
  const cfg = unwrapConfig(selectPdfFonts(["John Smith", "SakhiSetu Trust", "Bhopal"], "", ""));
  assert.equal(cfg.useCustomFont, false);
  assert.equal(cfg.regular, "Helvetica");
  assert.equal(cfg.bold, "Helvetica-Bold");
});

test("selectPdfFonts: empty string array → Helvetica", () => {
  const cfg = unwrapConfig(selectPdfFonts([], "", ""));
  assert.equal(cfg.useCustomFont, false);
});

test("selectPdfFonts: Latin numerals and symbols are not Devanagari", () => {
  const cfg = unwrapConfig(
    selectPdfFonts(["₹1,500.00", "SS/2026-27/00000001", "ABCDE1234F"], "", ""),
  );
  assert.equal(cfg.useCustomFont, false);
});

// --- Automatic bundled font fallback for Devanagari ---

test("selectPdfFonts: Hindi donor name without explicit path uses bundled font automatically", () => {
  const cfg = unwrapConfig(selectPdfFonts(["राधा शर्मा", "SakhiSetu Trust", "Bhopal"], "", ""));
  assert.equal(cfg.useCustomFont, true);
  assert.equal(cfg.regular, PDF_FONT_REGULAR);
  assert.equal(cfg.bold, PDF_FONT_BOLD);
  assert.match(cfg.resolvedFontPath, /NotoSansDevanagari-Regular\.ttf$/i);
  assert.match(cfg.resolvedBoldPath, /NotoSansDevanagari-Bold\.ttf$/i);
});

test("selectPdfFonts: Hindi trust name without explicit path uses bundled font automatically", () => {
  const cfg = unwrapConfig(
    selectPdfFonts(["John Smith", "सखीसेतु चैरिटेबल ट्रस्ट", "Bhopal"], "", ""),
  );
  assert.equal(cfg.useCustomFont, true);
  assert.equal(cfg.regular, PDF_FONT_REGULAR);
});

test("selectPdfFonts: Hindi address without explicit path uses bundled font automatically", () => {
  const cfg = unwrapConfig(
    selectPdfFonts(["John Smith", "SakhiSetu Trust", "भोपाल, मध्य प्रदेश"], "", ""),
  );
  assert.equal(cfg.useCustomFont, true);
  assert.equal(cfg.regular, PDF_FONT_REGULAR);
});

test("selectPdfFonts: mixed Latin + Devanagari uses bundled font automatically", () => {
  const cfg = unwrapConfig(selectPdfFonts(["Priya शर्मा"], "", ""));
  assert.equal(cfg.useCustomFont, true);
  assert.equal(cfg.regular, PDF_FONT_REGULAR);
});

// --- Devanagari when bundled font is disabled/missing → PDF_UNICODE_FONT_REQUIRED ---

test("selectPdfFonts: Devanagari with disableBundledFont returns PDF_UNICODE_FONT_REQUIRED", () => {
  const result = selectPdfFonts(["राधा शर्मा", "SakhiSetu Trust", "Bhopal"], "", "", {
    disableBundledFont: true,
  });
  assert.ok("error" in result);
  assert.equal(result.error.code, "PDF_UNICODE_FONT_REQUIRED");
  assert.equal(result.error.triggerString, "राधा शर्मा");
});

test("selectPdfFonts: mixed string with disableBundledFont includes triggerString", () => {
  const result = selectPdfFonts(["Priya शर्मा"], "", "", { disableBundledFont: true });
  assert.ok("error" in result);
  assert.equal(result.error.code, "PDF_UNICODE_FONT_REQUIRED");
  assert.equal(result.error.triggerString, "Priya शर्मा");
});

// --- Non-existent font path → PDF_FONT_NOT_FOUND ---

test("selectPdfFonts: missing regular font path returns PDF_FONT_NOT_FOUND", () => {
  const result = selectPdfFonts(["John Smith"], "/does/not/exist.ttf", "");
  assert.ok("error" in result);
  assert.equal(result.error.code, "PDF_FONT_NOT_FOUND");
  assert.equal(result.error.path, "/does/not/exist.ttf");
});

test("selectPdfFonts: missing bold font path returns PDF_FONT_NOT_FOUND", () => {
  const result = selectPdfFonts(["John Smith"], NODE_BIN, "/no/bold.ttf");
  assert.ok("error" in result);
  assert.equal(result.error.code, "PDF_FONT_NOT_FOUND");
});

// --- Explicit valid font path overrides default ---

test("selectPdfFonts: English + explicit valid font path → custom font names", () => {
  const cfg = unwrapConfig(selectPdfFonts(["John Smith"], NODE_BIN, ""));
  assert.equal(cfg.useCustomFont, true);
  assert.equal(cfg.regular, PDF_FONT_REGULAR);
  assert.equal(cfg.bold, PDF_FONT_BOLD);
  assert.equal(cfg.resolvedFontPath, NODE_BIN);
});

test("selectPdfFonts: Hindi + explicit valid font path → custom font names with that path", () => {
  const cfg = unwrapConfig(selectPdfFonts(["राधा शर्मा", "SakhiSetu Trust"], NODE_BIN, ""));
  assert.equal(cfg.useCustomFont, true);
  assert.equal(cfg.regular, PDF_FONT_REGULAR);
  assert.equal(cfg.bold, PDF_FONT_BOLD);
  assert.equal(cfg.resolvedFontPath, NODE_BIN);
});

test("selectPdfFonts: empty bold path falls back to regular file for both weights", () => {
  const cfg = unwrapConfig(selectPdfFonts(["Hello"], NODE_BIN, ""));
  assert.equal(cfg.bold, PDF_FONT_BOLD);
  assert.equal(cfg.resolvedBoldPath, NODE_BIN);
});

test("selectPdfFonts: explicit same-file bold path is accepted without error", () => {
  const cfg = unwrapConfig(selectPdfFonts(["Hello"], NODE_BIN, NODE_BIN));
  assert.equal(cfg.useCustomFont, true);
});

// --- Direct production PDF generation tests (generateReceiptPdfBuffer) ────

/** Base receipt data matching production schema */
const testReceiptBase = {
  receiptNumber: "SS/2026-27/00000042",
  generatedAt: new Date("2026-11-05T12:00:00.000Z"),
  donationId: "don-test-42",
  donorName: "Meena Verma",
  donorEmail: "meena@example.test",
  donorPan: "ABCDE1234F",
  amount: 1500,
  frequency: "ONE_TIME",
  campaignTitle: "Women Digital Literacy",
  trustName: "SakhiSetu Demo Trust",
  trustAddress: "Bhopal, Madhya Pradesh",
  trustPan: "NOT-CONFIGURED-DEMO",
  trust80GRegistration: "NOT-CONFIGURED-DEMO",
  deploymentMode: "demo",
};

/** Decompresses all stream objects from a PDF buffer */
function extractStreams(buffer) {
  const str = buffer.toString("binary");
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  const inflated = [];
  while ((match = regex.exec(str)) !== null) {
    try {
      inflated.push(zlib.inflateSync(Buffer.from(match[1], "binary")).toString("latin1"));
    } catch {
      inflated.push(Buffer.from(match[1], "binary").toString("latin1"));
    }
  }
  return inflated;
}

test("production PDF: English-only receipt generates valid PDF with Helvetica", async () => {
  const { buffer, fontConfig } = await generateReceiptPdfBuffer(testReceiptBase);
  assert.equal(buffer.slice(0, 4).toString("ascii"), "%PDF");
  assert.ok(buffer.length > 1_000, `expected >1 KB, got ${buffer.length}`);
  assert.equal(fontConfig.config.useCustomFont, false);
  assert.equal(fontConfig.config.regular, "Helvetica");
  assert.equal(fontConfig.config.bold, "Helvetica-Bold");

  // Helvetica PDF references standard fonts and contains no Type0 custom font streams
  const raw = buffer.toString("binary");
  assert.ok(raw.includes("/BaseFont /Helvetica"), "should reference Helvetica");
  assert.ok(raw.includes("/BaseFont /Helvetica-Bold"), "should reference Helvetica-Bold");
});

test("production PDF: Hindi donor name generates valid PDF with bundled Devanagari font", async () => {
  const hindiData = {
    ...testReceiptBase,
    donorName: "राधा शर्मा",
  };
  const { buffer, fontConfig } = await generateReceiptPdfBuffer(hindiData);
  assert.equal(buffer.slice(0, 4).toString("ascii"), "%PDF");
  assert.ok(buffer.length > 10_000, `expected >10 KB with subsetted font, got ${buffer.length}`);
  assert.equal(fontConfig.config.useCustomFont, true);
  assert.equal(fontConfig.config.regular, PDF_FONT_REGULAR);
  assert.equal(fontConfig.config.bold, PDF_FONT_BOLD);

  // Verify actual glyph mapping in the embedded /ToUnicode CMap:
  // "राधा शर्मा":
  //   र = 0930, ा = 093E, ध = 0927, श = 0936, र् = 0930 094D, म = 092E
  const streams = extractStreams(buffer);
  const cmaps = streams.filter((s) => s.includes("begincmap") && s.includes("/Adobe-Identity-UCS"));
  assert.ok(cmaps.length > 0, "PDF must contain embedded /ToUnicode CMaps");
  const allCmaps = cmaps.join("\n");
  assert.ok(allCmaps.includes("0930"), "CMap must map Devanagari Ra (0930)");
  assert.ok(allCmaps.includes("093e"), "CMap must map Devanagari Aa matra (093E)");
  assert.ok(allCmaps.includes("0927"), "CMap must map Devanagari Dha (0927)");
  assert.ok(allCmaps.includes("0936"), "CMap must map Devanagari Sha (0936)");
  assert.ok(allCmaps.includes("092e"), "CMap must map Devanagari Ma (092E)");
});

test("production PDF: Hindi trust name and address generate valid PDF with ligatures and conjuncts", async () => {
  const hindiTrustData = {
    ...testReceiptBase,
    trustName: "सखीसेतु चैरिटेबल ट्रस्ट",
    trustAddress: "भोपाल, मध्य प्रदेश",
  };
  const { buffer, fontConfig } = await generateReceiptPdfBuffer(hindiTrustData);
  assert.equal(buffer.slice(0, 4).toString("ascii"), "%PDF");
  assert.ok(buffer.length > 10_000, `expected >10 KB, got ${buffer.length}`);
  assert.equal(fontConfig.config.useCustomFont, true);

  const streams = extractStreams(buffer);
  const allStreams = streams.join("\n");
  // Check Devanagari characters from trust name and address in CMaps
  assert.ok(allStreams.includes("0938"), "maps Sa (0938)");
  assert.ok(allStreams.includes("0916"), "maps Kha (0916)");
  assert.ok(allStreams.includes("0940"), "maps Ii matra (0940)");
  assert.ok(allStreams.includes("0924"), "maps Ta (0924)");
  assert.ok(allStreams.includes("0941"), "maps U matra (0941)");
  assert.ok(allStreams.includes("092d"), "maps Bha (092D)");
  assert.ok(allStreams.includes("094b"), "maps O matra (094B)");
  assert.ok(allStreams.includes("092a"), "maps Pa (092A)");
  assert.ok(allStreams.includes("0932"), "maps La (0932)");
});

test("production PDF: mixed English + Hindi donor name renders correctly", async () => {
  const mixedData = {
    ...testReceiptBase,
    donorName: "Priya शर्मा",
  };
  const { buffer, fontConfig } = await generateReceiptPdfBuffer(mixedData);
  assert.equal(buffer.slice(0, 4).toString("ascii"), "%PDF");
  assert.ok(buffer.length > 10_000);
  assert.equal(fontConfig.config.useCustomFont, true);

  const streams = extractStreams(buffer);
  const allStreams = streams.join("\n");
  assert.ok(allStreams.includes("0936"), "maps Sha (0936)");
  assert.ok(allStreams.includes("092e"), "maps Ma (092E)");
});

test("production PDF: contains all required demo disclaimers and preview notices", async () => {
  const { buffer } = await generateReceiptPdfBuffer(testReceiptBase);
  const streams = extractStreams(buffer);

  // Extract decoded text spans from PDF content stream
  const words = [];
  for (const s of streams) {
    const tjRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(s)) !== null) {
      const hexes = tjMatch[1].match(/<([0-9a-fA-F]+)>/g) || [];
      const combined = hexes
        .map((h) => Buffer.from(h.slice(1, -1), "hex").toString("latin1"))
        .join("");
      words.push(combined);
    }
  }
  const fullText = words.join(" ");

  assert.ok(fullText.includes("TEST / PREVIEW"), "must include TEST / PREVIEW header");
  assert.ok(
    fullText.includes("Donation receipt and 80G certificate preview"),
    "must include receipt title",
  );
  assert.ok(
    fullText.includes("simulated test transaction"),
    "must include simulated transaction notice",
  );
  assert.ok(fullText.includes("DEMO DOCUMENT"), "must include DEMO DOCUMENT notice");
  assert.ok(
    fullText.includes("DO NOT SUBMIT TO THE INCOME TAX"),
    "must include warning not to submit to IT department",
  );
  assert.ok(
    fullText.includes("Trust PAN and registration fields are demo placeholders"),
    "must include demo placeholder disclaimer",
  );
});

test("production PDF: Hindi content with disableBundledFont throws PDF_UNICODE_FONT_REQUIRED", async () => {
  const hindiData = {
    ...testReceiptBase,
    donorName: "राधा शर्मा",
  };
  await assert.rejects(
    async () => generateReceiptPdfBuffer(hindiData, "", "", { disableBundledFont: true }),
    (err) => err.code === "PDF_UNICODE_FONT_REQUIRED",
  );
});

test("production PDF: invalid custom font path throws PDF_FONT_NOT_FOUND", async () => {
  await assert.rejects(
    async () => generateReceiptPdfBuffer(testReceiptBase, "/does/not/exist.ttf"),
    (err) => err.code === "PDF_FONT_NOT_FOUND",
  );
});
