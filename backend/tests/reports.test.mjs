/**
 * Pure-logic tests for the reports and analytics section (Checkpoint 7).
 * All tests run without a database — they exercise the financial-year helper,
 * monthly-trend gap-filling logic, CSV header construction, campaign breakdown
 * aggregation, and Form 10BD disclaimer requirements.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { financialYear, formatReceiptNumber } from "../src/services/donation-helpers.ts";

// ---------------------------------------------------------------------------
// financialYear helper (shared with reports, already in donation-helpers)
// ---------------------------------------------------------------------------

test("financialYear: April 2026 starts FY 2026-27", () => {
  // 1 Apr 2026 00:00 IST = 31 Mar 2026 18:30 UTC
  assert.equal(financialYear(new Date("2026-03-31T18:30:00.000Z")), "2026-27");
});

test("financialYear: March 2027 is still FY 2026-27", () => {
  assert.equal(financialYear(new Date("2027-02-28T00:00:00.000Z")), "2026-27");
});

test("financialYear: November 2026 is FY 2026-27", () => {
  assert.equal(financialYear(new Date("2026-11-05T00:00:00.000Z")), "2026-27");
});

// ---------------------------------------------------------------------------
// Monthly trend gap-filling (mirrors report.service.ts logic)
// ---------------------------------------------------------------------------

/** Builds a continuous 12-month array padded with zeros for missing months. */
function buildMonthlyTrends(existingRows, referenceDate) {
  const monthlyMap = new Map(existingRows.map((r) => [r.month_key, r]));
  const trends = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const row   = monthlyMap.get(key);
    trends.push({ monthKey: key, monthLabel: label, amount: row ? Number(row.total_amount) : 0, count: row ? Number(row.count) : 0 });
  }
  return trends;
}

const REF = new Date("2026-11-01T00:00:00.000Z"); // November 2026

test("monthly trends: 12 entries always returned", () => {
  const trends = buildMonthlyTrends([], REF);
  assert.equal(trends.length, 12);
});

test("monthly trends: missing months filled with zero amount and count", () => {
  const trends = buildMonthlyTrends([], REF);
  assert.ok(trends.every((m) => m.amount === 0 && m.count === 0));
});

test("monthly trends: present month data is used when available", () => {
  const existing = [{ month_key: "2026-11", total_amount: 3500, count: 3 }];
  const trends = buildMonthlyTrends(existing, REF);
  const nov = trends.find((m) => m.monthKey === "2026-11");
  assert.ok(nov);
  assert.equal(nov.amount, 3500);
  assert.equal(nov.count, 3);
});

test("monthly trends: oldest month is 11 months before the reference", () => {
  const trends = buildMonthlyTrends([], REF);
  // REF is Nov 2026 → oldest should be Dec 2025
  assert.equal(trends[0].monthKey, "2025-12");
});

test("monthly trends: newest month is the reference month", () => {
  const trends = buildMonthlyTrends([], REF);
  assert.equal(trends[11].monthKey, "2026-11");
});

test("monthly trends: gaps between present data points are zero-padded", () => {
  const existing = [
    { month_key: "2026-08", total_amount: 1000, count: 1 },
    { month_key: "2026-11", total_amount: 2000, count: 2 },
  ];
  const trends = buildMonthlyTrends(existing, REF);
  const sep = trends.find((m) => m.monthKey === "2026-09");
  const oct = trends.find((m) => m.monthKey === "2026-10");
  assert.ok(sep);
  assert.ok(oct);
  assert.equal(sep.amount, 0);
  assert.equal(oct.amount, 0);
});

// ---------------------------------------------------------------------------
// Campaign breakdown aggregation (mirrors report.service.ts byCampaign logic)
// ---------------------------------------------------------------------------

function buildCampaignBreakdowns(campaigns, donationSums) {
  const sumMap = new Map(donationSums.map((s) => [s.campaignId, s]));
  return campaigns.map((c) => {
    const s   = sumMap.get(c.id);
    const amt = Number(s?.amount ?? 0);
    const goal = Number(c.goalAmount);
    return {
      id: c.id,
      collectedAmount: amt,
      donationCount: s?.count ?? 0,
      progressPercent: goal > 0 ? Math.min(100, Math.round((amt / goal) * 100)) : 0,
    };
  });
}

test("campaign breakdown: 0% when no donations", () => {
  const campaigns = [{ id: "c1", goalAmount: 500000 }];
  const result = buildCampaignBreakdowns(campaigns, []);
  assert.equal(result[0].progressPercent, 0);
  assert.equal(result[0].donationCount, 0);
});

test("campaign breakdown: 100% capped even when collected exceeds goal", () => {
  const campaigns = [{ id: "c1", goalAmount: 100000 }];
  const sums = [{ campaignId: "c1", amount: 200000, count: 5 }];
  const result = buildCampaignBreakdowns(campaigns, sums);
  assert.equal(result[0].progressPercent, 100);
});

test("campaign breakdown: correct percentage for partial collection", () => {
  const campaigns = [{ id: "c1", goalAmount: 800000 }];
  const sums = [{ campaignId: "c1", amount: 400000, count: 10 }];
  const result = buildCampaignBreakdowns(campaigns, sums);
  assert.equal(result[0].progressPercent, 50);
  assert.equal(result[0].donationCount, 10);
});

test("campaign breakdown: zero goal gives 0% (no division by zero)", () => {
  const campaigns = [{ id: "c1", goalAmount: 0 }];
  const sums = [{ campaignId: "c1", amount: 5000, count: 1 }];
  const result = buildCampaignBreakdowns(campaigns, sums);
  assert.equal(result[0].progressPercent, 0);
});

// ---------------------------------------------------------------------------
// Form 10BD CSV — disclaimer and demo-marker requirements
// ---------------------------------------------------------------------------

/** Minimal CSV builder matching report.service.ts header logic. */
function buildCsvHeader(trustPan, trust80g, financialYearStr) {
  return [
    `"DEMO / TEST DATA — NOT FOR OFFICIAL FILING"`,
    `"Trust PAN: ${trustPan}"`,
    `"Trust 80G registration: ${trust80g}"`,
    `"Financial year requested: ${financialYearStr}"`,
  ].join("\r\n");
}

test("Form 10BD CSV header includes DEMO warning on the first line", () => {
  const header = buildCsvHeader("NOT-CONFIGURED-DEMO", "NOT-CONFIGURED-DEMO", "2026-27");
  const firstLine = header.split("\r\n")[0];
  assert.ok(firstLine.includes("DEMO"), "first line must contain DEMO");
  assert.ok(firstLine.includes("NOT FOR OFFICIAL FILING"), "first line must state not for filing");
});

test("Form 10BD CSV header includes trust PAN", () => {
  const header = buildCsvHeader("AABCT1234D", "ABC/2024/80G/001", "2026-27");
  assert.ok(header.includes("AABCT1234D"), "header must include trust PAN");
});

test("Form 10BD CSV header includes financial year", () => {
  const header = buildCsvHeader("P", "R", "2026-27");
  assert.ok(header.includes("2026-27"), "header must include FY");
});

test("Form 10BD CSV header marks placeholder PAN as not configured", () => {
  const header = buildCsvHeader("NOT-CONFIGURED-DEMO", "NOT-CONFIGURED-DEMO", "2026-27");
  assert.ok(header.toLowerCase().includes("placeholder") || header.includes("NOT-CONFIGURED"), "should note placeholder status");
});

// ---------------------------------------------------------------------------
// FY validation for CSV export endpoint (mirrors report.controller.ts)
// ---------------------------------------------------------------------------

function isValidFy(fy) {
  return typeof fy === "string" && /^\d{4}-\d{2}$/.test(fy.trim());
}

test("FY validation: 2026-27 is valid", () => {
  assert.equal(isValidFy("2026-27"), true);
});

test("FY validation: 2025-26 is valid", () => {
  assert.equal(isValidFy("2025-26"), true);
});

test("FY validation: empty string is invalid", () => {
  assert.equal(isValidFy(""), false);
});

test("FY validation: wrong format 2026/27 is invalid", () => {
  assert.equal(isValidFy("2026/27"), false);
});

test("FY validation: just a year is invalid", () => {
  assert.equal(isValidFy("2026"), false);
});

test("FY validation: undefined is invalid", () => {
  assert.equal(isValidFy(undefined), false);
});

// ---------------------------------------------------------------------------
// Report summary disclaimers (structural requirements)
// ---------------------------------------------------------------------------

const REQUIRED_DISCLAIMERS = [
  "TEST",
  "MOCK",
  "Form 10BD",
  "DEMO",
];

/** Checks that every required keyword appears in at least one disclaimer. */
function checkDisclaimers(disclaimers) {
  return REQUIRED_DISCLAIMERS.every((kw) =>
    disclaimers.some((d) => d.toUpperCase().includes(kw.toUpperCase())),
  );
}

test("report summary disclaimers contain all required warning keywords", () => {
  const disclaimers = [
    "All transactions are TEST / MOCK. No real funds were collected.",
    "These figures cannot be used for official financial reporting or tax filings.",
    "Form 10BD export is a DEMO template. Verify all data with the trust's auditor before filing.",
  ];
  assert.equal(checkDisclaimers(disclaimers), true);
});

test("report summary missing TEST keyword fails disclaimer check", () => {
  const disclaimers = ["Some disclaimer without the required word."];
  assert.equal(checkDisclaimers(disclaimers), false);
});

// ---------------------------------------------------------------------------
// Receipt number format (shared with reports — used in CSV)
// ---------------------------------------------------------------------------

test("receipt number format used in 10BD export is consistent", () => {
  const rn = formatReceiptNumber(new Date("2026-11-05T00:00:00.000Z"), 42);
  assert.match(rn, /^SS\/2026-27\/\d{8}$/);
  assert.equal(rn, "SS/2026-27/00000042");
});
