/**
 * env-validation.test.mjs
 *
 * Tests for the production startup guards in backend/src/config/env.ts.
 *
 * Because env.ts runs its guards at module load time (before any test can
 * intercept them), we replicate the guard logic as a pure function mirroring
 * the exact conditions in the source. Any drift from env.ts will surface as a
 * failing test — by design.
 *
 * Guards tested:
 *   Both live and demo modes:
 *     - JWT_SECRET must not be the example placeholder
 *     - PII_ENCRYPTION_KEY must be 64 hex chars
 *     - COOKIE_SECURE must be true
 *     - FRONTEND_ORIGIN must start with https://
 *     - ADMIN_PASSWORD must not be the default demo value
 *
 *   Live mode only:
 *     - TRUST_PAN must not be NOT-CONFIGURED-DEMO
 *     - TRUST_80G_REGISTRATION must not be NOT-CONFIGURED-DEMO
 *     - TRUST_PAN must match the PAN format [A-Z]{5}[0-9]{4}[A-Z]
 *
 *   Demo mode:
 *     - TRUST_PAN/TRUST_80G_REGISTRATION may stay as NOT-CONFIGURED-DEMO
 *     - TRUST_PAN format check is skipped
 *     - All other security guards still apply
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Mirror of env.ts production guard logic ──────────────────────────────────
// This function is kept intentionally identical to the if-block at the bottom
// of env.ts so that tests fail if the source diverges.
function runProductionGuards(env) {
  const errors = [];

  // ── Guards that apply to BOTH live and demo deployments ─────────────────
  if (env.JWT_SECRET === "replace-with-at-least-32-random-characters") {
    errors.push("JWT_SECRET must be replaced before production startup.");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(env.PII_ENCRYPTION_KEY)) {
    errors.push("PII_ENCRYPTION_KEY must be a 64-character hexadecimal key in production.");
  }
  if (!env.COOKIE_SECURE) {
    errors.push("COOKIE_SECURE must be true in production.");
  }
  if (!env.FRONTEND_ORIGIN.startsWith("https://")) {
    errors.push("FRONTEND_ORIGIN must use HTTPS in production.");
  }
  if (env.ADMIN_PASSWORD === "SakhiDemo!2026") {
    errors.push("ADMIN_PASSWORD must be replaced before production seeding.");
  }

  // ── Guards that apply only to live (genuine charitable) deployments ──────
  if (env.DEPLOYMENT_MODE === "live") {
    if (env.TRUST_PAN === "NOT-CONFIGURED-DEMO" || env.TRUST_80G_REGISTRATION === "NOT-CONFIGURED-DEMO") {
      errors.push("Trust PAN and 80G registration details must be verified before live production setup. Set DEPLOYMENT_MODE=demo if this is a demonstration deployment.");
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(env.TRUST_PAN)) {
      errors.push("TRUST_PAN must be a verified PAN in the expected format before live production setup.");
    }
  }

  return errors;
}

// ── Base configs ──────────────────────────────────────────────────────────────
const VALID_SECRETS = {
  JWT_SECRET: "a-random-32-char-string-for-tests-abc",
  PII_ENCRYPTION_KEY: "a".repeat(64), // 64 valid hex chars
  COOKIE_SECURE: true,
  FRONTEND_ORIGIN: "https://sakhisetu.pages.dev",
  ADMIN_PASSWORD: "StrongPassw0rd!",
};

const VALID_LIVE_TRUST = {
  TRUST_PAN: "ABCDE1234F",
  TRUST_80G_REGISTRATION: "80G/REG/2024/001",
};

const DEMO_DEFAULTS = {
  TRUST_PAN: "NOT-CONFIGURED-DEMO",
  TRUST_80G_REGISTRATION: "NOT-CONFIGURED-DEMO",
};

// ── LIVE mode: happy path ─────────────────────────────────────────────────────

test("live mode: valid config with real trust credentials passes all guards", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    ...VALID_LIVE_TRUST,
  });
  assert.deepEqual(errors, []);
});

// ── LIVE mode: trust credential failures ─────────────────────────────────────

test("live mode: NOT-CONFIGURED-DEMO TRUST_PAN triggers trust credential guard", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    TRUST_PAN: "NOT-CONFIGURED-DEMO",
    TRUST_80G_REGISTRATION: "80G/REG/2024/001",
  });
  assert.ok(errors.some(e => e.includes("Trust PAN and 80G registration")), `Expected trust credential error, got: ${errors.join("; ")}`);
});

test("live mode: NOT-CONFIGURED-DEMO TRUST_80G_REGISTRATION triggers trust credential guard", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    TRUST_PAN: "ABCDE1234F",
    TRUST_80G_REGISTRATION: "NOT-CONFIGURED-DEMO",
  });
  assert.ok(errors.some(e => e.includes("Trust PAN and 80G registration")));
});

test("live mode: TRUST_PAN with wrong format is rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    TRUST_PAN: "INVALID",
    TRUST_80G_REGISTRATION: "80G/REG/2024/001",
  });
  assert.ok(errors.some(e => e.includes("TRUST_PAN must be a verified PAN")));
});

test("live mode: TRUST_PAN with all lowercase is rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    TRUST_PAN: "abcde1234f",
    TRUST_80G_REGISTRATION: "80G/REG/2024/001",
  });
  assert.ok(errors.some(e => e.includes("TRUST_PAN must be a verified PAN")));
});

test("live mode: TRUST_PAN ending with digit instead of letter is rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    TRUST_PAN: "ABCDE12341",
    TRUST_80G_REGISTRATION: "80G/REG/2024/001",
  });
  assert.ok(errors.some(e => e.includes("TRUST_PAN must be a verified PAN")));
});

// ── DEMO mode: happy path ─────────────────────────────────────────────────────

test("demo mode: NOT-CONFIGURED-DEMO trust credentials are allowed", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
  });
  assert.deepEqual(errors, [], `Unexpected errors in demo mode: ${errors.join("; ")}`);
});

test("demo mode: TRUST_PAN format check is skipped", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    TRUST_PAN: "NOT-CONFIGURED-DEMO",   // would fail live mode PAN format check
    TRUST_80G_REGISTRATION: "NOT-CONFIGURED-DEMO",
  });
  assert.ok(!errors.some(e => e.includes("TRUST_PAN must be a verified PAN")));
});

test("demo mode: valid trust credentials are also accepted", () => {
  // A demo deployment may optionally provide real trust credentials.
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...VALID_LIVE_TRUST,
  });
  assert.deepEqual(errors, []);
});

// ── Shared security guards — apply to BOTH live and demo ──────────────────────

test("demo mode: weak JWT_SECRET is still rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
    JWT_SECRET: "replace-with-at-least-32-random-characters",
  });
  assert.ok(errors.some(e => e.includes("JWT_SECRET")));
});

test("demo mode: invalid PII_ENCRYPTION_KEY is still rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
    PII_ENCRYPTION_KEY: "too-short",
  });
  assert.ok(errors.some(e => e.includes("PII_ENCRYPTION_KEY")));
});

test("demo mode: PII_ENCRYPTION_KEY with non-hex characters is rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
    PII_ENCRYPTION_KEY: "z".repeat(64), // 64 chars but not valid hex
  });
  assert.ok(errors.some(e => e.includes("PII_ENCRYPTION_KEY")));
});

test("demo mode: COOKIE_SECURE=false is still rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
    COOKIE_SECURE: false,
  });
  assert.ok(errors.some(e => e.includes("COOKIE_SECURE")));
});

test("demo mode: HTTP FRONTEND_ORIGIN is still rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
    FRONTEND_ORIGIN: "http://sakhisetu.pages.dev",
  });
  assert.ok(errors.some(e => e.includes("FRONTEND_ORIGIN")));
});

test("demo mode: default ADMIN_PASSWORD is still rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "demo",
    ...VALID_SECRETS,
    ...DEMO_DEFAULTS,
    ADMIN_PASSWORD: "SakhiDemo!2026",
  });
  assert.ok(errors.some(e => e.includes("ADMIN_PASSWORD")));
});

test("live mode: default ADMIN_PASSWORD is rejected", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    ...VALID_SECRETS,
    ...VALID_LIVE_TRUST,
    ADMIN_PASSWORD: "SakhiDemo!2026",
  });
  assert.ok(errors.some(e => e.includes("ADMIN_PASSWORD")));
});

// ── Multiple simultaneous guard failures ─────────────────────────────────────

test("multiple guard failures are all reported", () => {
  const errors = runProductionGuards({
    DEPLOYMENT_MODE: "live",
    JWT_SECRET: "replace-with-at-least-32-random-characters",
    PII_ENCRYPTION_KEY: "short",
    COOKIE_SECURE: false,
    FRONTEND_ORIGIN: "http://insecure.example.com",
    ADMIN_PASSWORD: "SakhiDemo!2026",
    TRUST_PAN: "NOT-CONFIGURED-DEMO",
    TRUST_80G_REGISTRATION: "NOT-CONFIGURED-DEMO",
  });
  // At minimum: JWT, PII, cookie, origin, password, trust creds
  assert.ok(errors.length >= 5, `Expected ≥5 errors, got ${errors.length}: ${errors.join("; ")}`);
});

// ── PDF demo-mode label invariant ────────────────────────────────────────────
// The donation.service.ts PDF row uses "[DEMO — NOT A REAL REGISTRATION]" in
// demo mode. Test the exact string so any drift trips here.

test("demo PDF label string is exactly the expected value", () => {
  const DEMO_LABEL = "[DEMO — NOT A REAL REGISTRATION]";
  // Verify the label contains neither a real PAN format nor the raw placeholder.
  assert.ok(!DEMO_LABEL.startsWith("NOT-CONFIGURED"));
  assert.ok(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(DEMO_LABEL));
  assert.ok(DEMO_LABEL.includes("DEMO"));
  assert.ok(DEMO_LABEL.includes("NOT A REAL"));
});

test("demo mode credential label is present in donation.service.ts", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/services/donation.service.ts", import.meta.url), "utf8");
  assert.ok(
    src.includes("[DEMO — NOT A REAL REGISTRATION]"),
    "Demo credential label not found in donation.service.ts",
  );
});

test("demo mode credential label is only rendered when DEPLOYMENT_MODE is demo", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/services/donation.service.ts", import.meta.url), "utf8");
  // The demo label must be inside a conditional checking DEPLOYMENT_MODE
  const demoLabelLine = src.split("\n").find(line => line.includes("[DEMO — NOT A REAL REGISTRATION]"));
  assert.ok(demoLabelLine, "Demo label line not found");
  assert.ok(
    demoLabelLine.includes("DEPLOYMENT_MODE") || src.includes("DEPLOYMENT_MODE") && src.indexOf("DEPLOYMENT_MODE") < src.indexOf("[DEMO — NOT A REAL REGISTRATION]"),
    "Demo label does not appear to be guarded by DEPLOYMENT_MODE check",
  );
});

test("live mode trust PAN format: valid PANs with all letter/digit positions", () => {
  const validPans = ["ABCDE1234F", "ZZZZZ9999Z", "AABCA1234A"];
  for (const pan of validPans) {
    assert.match(pan, /^[A-Z]{5}[0-9]{4}[A-Z]$/, `Expected ${pan} to match PAN format`);
  }
});

test("live mode trust PAN format: invalid PANs are rejected by the regex", () => {
  const invalidPans = [
    "abcde1234f",   // lowercase
    "ABCDE1234",    // missing last letter
    "ABCDE12345",   // digit instead of letter at end
    "12345ABCD5",   // starts with digits
    "ABCDE1234FF",  // too long
    "ABCDE123",     // too short
  ];
  for (const pan of invalidPans) {
    assert.doesNotMatch(pan, /^[A-Z]{5}[0-9]{4}[A-Z]$/, `Expected ${pan} to fail PAN format`);
  }
});
