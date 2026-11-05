import { prisma } from "../config/prisma.js";

export type AdminOverviewData = {
  stats: {
    totalSuccessfulAmount: number;
    successfulDonationsCount: number;
    uniqueDonorsCount: number;
    activeCampaignsCount: number;
    totalCampaignsCount: number;
    publishedSchemesCount: number;
    totalSchemesCount: number;
    pendingDonationsCount: number;
    failedDonationsCount: number;
  };
  recentDonations: Array<{
    id: string;
    donorName: string;
    donorEmail: string;
    amount: number;
    frequency: "ONE_TIME" | "MONTHLY";
    status: "SUCCEEDED" | "PENDING" | "FAILED";
    campaignId: string;
    campaignTitle: { hi: string; en: string };
    receiptNumber: string | null;
    createdAt: string;
  }>;
  campaignCollections: Array<{
    id: string;
    title: { hi: string; en: string };
    district: string;
    emoji: string;
    active: boolean;
    goalAmount: number;
    collectedAmount: number;
    donationCount: number;
    remainingAmount: number;
    progressPercent: number;
  }>;
  monthlyTrends: Array<{
    monthKey: string;
    monthLabel: string;
    amount: number;
    count: number;
  }>;
};

export async function getAdminOverview(): Promise<AdminOverviewData> {
  const [
    successfulAgg,
    uniqueDonorsResult,
    activeCampaignsCount,
    totalCampaignsCount,
    publishedSchemesCount,
    totalSchemesCount,
    pendingDonationsCount,
    failedDonationsCount,
    recentDonationsRows,
    campaignRows,
    campaignSums,
    monthlyRows,
  ] = await Promise.all([
    prisma.donation.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT LOWER("donorEmail"))::int AS count 
      FROM "Donation" 
      WHERE "status" = 'SUCCEEDED'
    `,
    prisma.campaign.count({ where: { active: true } }),
    prisma.campaign.count(),
    prisma.scheme.count({ where: { published: true } }),
    prisma.scheme.count(),
    prisma.donation.count({ where: { status: "PENDING" } }),
    prisma.donation.count({ where: { status: "FAILED" } }),
    prisma.donation.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { campaign: true, receipt: true },
    }),
    prisma.campaign.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.donation.groupBy({
      by: ["campaignId"],
      where: { status: "SUCCEEDED" },
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
      WHERE "status" = 'SUCCEEDED' AND "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `,
  ]);

  const uniqueDonorsCount = Number(uniqueDonorsResult[0]?.count ?? 0);
  const campaignSumMap = new Map(campaignSums.map((row) => [row.campaignId, row]));

  const campaignCollections = campaignRows.map((c) => {
    const sum = campaignSumMap.get(c.id);
    const collected = Number(sum?._sum.amount ?? 0);
    const goal = Number(c.goalAmount);
    return {
      id: c.id,
      title: { hi: c.titleHi, en: c.titleEn },
      district: c.district,
      emoji: c.emoji,
      active: c.active,
      goalAmount: goal,
      collectedAmount: collected,
      donationCount: sum?._count._all ?? 0,
      remainingAmount: Math.max(0, goal - collected),
      progressPercent: goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0,
    };
  });

  const recentDonations = recentDonationsRows.map((d) => ({
    id: d.id,
    donorName: d.donorName,
    donorEmail: d.donorEmail,
    amount: Number(d.amount),
    frequency: d.frequency,
    status: d.status,
    campaignId: d.campaignId,
    campaignTitle: { hi: d.campaign.titleHi, en: d.campaign.titleEn },
    receiptNumber: d.receipt?.receiptNumber ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  // Build a continuous 6-month array so the monthly trends are never empty
  const monthlyMap = new Map(monthlyRows.map((r) => [r.month_key, r]));
  const now = new Date();
  const monthlyTrends = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const existing = monthlyMap.get(key);
    monthlyTrends.push({
      monthKey: key,
      monthLabel: label,
      amount: existing ? Number(existing.total_amount) : 0,
      count: existing ? Number(existing.count) : 0,
    });
  }

  return {
    stats: {
      totalSuccessfulAmount: Number(successfulAgg._sum.amount ?? 0),
      successfulDonationsCount: successfulAgg._count._all,
      uniqueDonorsCount,
      activeCampaignsCount,
      totalCampaignsCount,
      publishedSchemesCount,
      totalSchemesCount,
      pendingDonationsCount,
      failedDonationsCount,
    },
    recentDonations,
    campaignCollections,
    monthlyTrends,
  };
}

