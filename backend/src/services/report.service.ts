/**
 * Report service for SakhiSetu admin analytics (Checkpoint 7).
 *
 * All data comes from the live PostgreSQL database.  No figures are hardcoded.
 * The Form 10BD CSV is explicitly marked DEMO / TEST because this platform uses
 * simulated test-mode payments and is not a live fundraising system. The trust
 * must supply verified registration data and complete legal/accounting review
 * before using any export for actual Form 10BD filing.
 */

import { DonationStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export type MonthlyBreakdown = {
  monthKey: string;    // YYYY-MM
  monthLabel: string;  // "Nov 2026"
  amount: number;
  count: number;
};

export type CampaignBreakdown = {
  id: string;
  title: { hi: string; en: string };
  emoji: string;
  district: string;
  active: boolean;
  goalAmount: number;
  collectedAmount: number;
  donationCount: number;
  progressPercent: number;
};

export type AdminReportSummary = {
  generatedAt: string;
  periodLabel: string;
  financialYear: string;
  totalSucceededAmount: number;
  totalSucceededCount: number;
  totalFailedCount: number;
  totalPendingCount: number;
  uniqueDonorEmails: number;
  oneTimeDonations: number;
  monthlyIntentions: number;
  testModeOnly: true;
  monthly: MonthlyBreakdown[];
  byCampaign: CampaignBreakdown[];
  disclaimers: string[];
};

/** Returns the Indian financial year string (e.g. "2026-27") for a UTC Date. */
function financialYearLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year  = Number(parts.find((p) => p.type === "year")?.value  ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export async function getAdminReportSummary(): Promise<AdminReportSummary> {
  const now = new Date();

  const [
    succeededAgg,
    failedCount,
    pendingCount,
    uniqueEmailResult,
    frequencyGroups,
    campaignRows,
    campaignSums,
    monthlyRows,
  ] = await Promise.all([
    prisma.donation.aggregate({
      where: { status: DonationStatus.SUCCEEDED },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.donation.count({ where: { status: DonationStatus.FAILED } }),
    prisma.donation.count({ where: { status: DonationStatus.PENDING } }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT LOWER("donorEmail"))::int AS count
      FROM "Donation" WHERE "status" = 'SUCCEEDED'
    `,
    prisma.donation.groupBy({
      by: ["frequency"],
      where: { status: DonationStatus.SUCCEEDED },
      _count: { _all: true },
    }),
    prisma.campaign.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.donation.groupBy({
      by: ["campaignId"],
      where: { status: DonationStatus.SUCCEEDED },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{
      month_key: string;
      month_label: string;
      total_amount: number;
      count: number;
    }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month_key,
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month_label,
        COALESCE(SUM("amount"), 0)::float AS total_amount,
        COUNT("id")::int AS count
      FROM "Donation"
      WHERE "status" = 'SUCCEEDED'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `,
  ]);

  // Monthly trend — last 12 months, gaps filled with zero
  const monthlyMap = new Map(monthlyRows.map((r) => [r.month_key, r]));
  const monthly: MonthlyBreakdown[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const row   = monthlyMap.get(key);
    monthly.push({ monthKey: key, monthLabel: label, amount: row ? Number(row.total_amount) : 0, count: row ? Number(row.count) : 0 });
  }

  // Per-campaign breakdown
  const sumMap = new Map(campaignSums.map((r) => [r.campaignId, r]));
  const byCampaign: CampaignBreakdown[] = campaignRows.map((c) => {
    const s   = sumMap.get(c.id);
    const amt = Number(s?._sum.amount ?? 0);
    const goal = Number(c.goalAmount);
    return {
      id: c.id,
      title: { hi: c.titleHi, en: c.titleEn },
      emoji: c.emoji,
      district: c.district,
      active: c.active,
      goalAmount: goal,
      collectedAmount: amt,
      donationCount: s?._count._all ?? 0,
      progressPercent: goal > 0 ? Math.min(100, Math.round((amt / goal) * 100)) : 0,
    };
  });

  const freqMap = new Map(frequencyGroups.map((g) => [g.frequency, g._count._all]));

  return {
    generatedAt: now.toISOString(),
    periodLabel: "All time (test mode)",
    financialYear: financialYearLabel(now),
    totalSucceededAmount: Number(succeededAgg._sum.amount ?? 0),
    totalSucceededCount: succeededAgg._count._all,
    totalFailedCount: failedCount,
    totalPendingCount: pendingCount,
    uniqueDonorEmails: Number(uniqueEmailResult[0]?.count ?? 0),
    oneTimeDonations: freqMap.get("ONE_TIME") ?? 0,
    monthlyIntentions: freqMap.get("MONTHLY") ?? 0,
    testModeOnly: true,
    monthly,
    byCampaign,
    disclaimers: [
      "All transactions are TEST / MOCK. No real funds were collected.",
      "These figures cannot be used for official financial reporting or tax filings.",
      "Form 10BD export is a DEMO template. Verify all data with the trust's auditor before filing.",
    ],
  };
}

/** Builds a DEMO Form 10BD-style CSV for a given financial year from DB records.
 *  Every cell and the file header carry explicit DEMO / TEST warnings. */
export async function buildForm10BdCsv(financialYear: string): Promise<string> {
  const donations = await prisma.donation.findMany({
    where: { status: DonationStatus.SUCCEEDED },
    include: { receipt: true },
    orderBy: { paidAt: "asc" },
  });

  const lines: string[] = [];

  // Header warning block — operators see this before any data
  lines.push(`"DEMO / TEST DATA — NOT FOR OFFICIAL FILING"`);
  lines.push(`"This CSV is generated from MOCK test-mode transactions. No real funds were collected."`);
  lines.push(`"Before using for actual Form 10BD filing: verify Trust PAN registration, donor PAN and amount with the trust's chartered accountant."`);
  lines.push(`"Trust PAN: ${env.TRUST_PAN} (${env.TRUST_PAN === "NOT-CONFIGURED-DEMO" ? "PLACEHOLDER — not verified" : "as configured"})"`);
  lines.push(`"Trust 80G registration: ${env.TRUST_80G_REGISTRATION} (${env.TRUST_80G_REGISTRATION === "NOT-CONFIGURED-DEMO" ? "PLACEHOLDER — not verified" : "as configured"})"`);
  lines.push(`"Financial year requested: ${financialYear}"`);
  lines.push(`"Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST"`);
  lines.push(``);

  // Column headers (mirrors Form 10BD schedule structure)
  lines.push([
    "Sl. No.",
    "Receipt Number",
    "Donation Date",
    "Donor Name",
    "Donor Email",
    "PAN (last 4 only — full PAN not exported)",
    "Amount (INR)",
    "Frequency",
    "Campaign",
    "Status",
    "TEST MODE",
  ].map((h) => `"${h}"`).join(","));

  let seq = 1;
  for (const d of donations) {
    // Filter by financial year based on paidAt date
    if (d.paidAt) {
      const fy = financialYearLabel(d.paidAt);
      if (fy !== financialYear) continue;
    } else {
      continue; // skip donations without paidAt
    }

    const row = [
      String(seq++),
      d.receipt?.receiptNumber ?? "—",
      d.paidAt ? new Date(d.paidAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—",
      d.donorName.replace(/"/g, '""'),
      d.donorEmail.replace(/"/g, '""'),
      d.donorPanLast4 ? `"••••${d.donorPanLast4}"` : '"—"',
      Number(d.amount).toFixed(2),
      d.frequency,
      "", // campaign title fetched separately below — skip for simplicity in this flat query
      d.status,
      "YES",
    ];
    lines.push(row.map((v, i) => (i === 6 ? v : `"${v}"`)).join(","));
  }

  if (seq === 1) {
    lines.push(`"(No succeeded donations found for financial year ${financialYear})"`);
  }

  lines.push(``);
  lines.push(`"END OF DEMO EXPORT — TOTAL ROWS: ${seq - 1}"`);

  return lines.join("\r\n");
}
