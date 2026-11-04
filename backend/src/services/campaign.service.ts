import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

export async function listCampaigns(includeInactive = false) {
  const rows = await prisma.campaign.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { createdAt: "asc" } });
  // Test-mode contributions must never inflate amounts presented as real campaign fundraising.
  const totals = await prisma.donation.groupBy({
    by: ["campaignId"],
    where: { status: "SUCCEEDED", testMode: false },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totalById = new Map(totals.map((row) => [row.campaignId, row]));
  return rows.map((row) => {
    const total = totalById.get(row.id);
    return {
      id: row.id,
      title: { hi: row.titleHi, en: row.titleEn },
      story: { hi: row.storyHi, en: row.storyEn },
      district: row.district,
      goal: Number(row.goalAmount),
      raised: Number(row.raisedSeed) + Number(total?._sum.amount ?? 0),
      donors: row.donorSeed + (total?._count._all ?? 0),
      impact: { hi: row.impactHi, en: row.impactEn },
      emoji: row.emoji,
      active: row.active,
    };
  });
}

export async function updateCampaign(id: string, input: { goalAmount?: number; active?: boolean }) {
  const exists = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  const data: Prisma.CampaignUpdateInput = {
    ...(input.goalAmount !== undefined ? { goalAmount: new Prisma.Decimal(input.goalAmount) } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
  await prisma.campaign.update({ where: { id }, data });
  return (await listCampaigns(true)).find((campaign) => campaign.id === id)!;
}
