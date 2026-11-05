import { DonationStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export type DonorSummary = {
  userId: string;
  name: string;
  email: string;
  /** PAN last-4 digits from the most-recent donation that has one; null for guest / missing */
  panLast4: string | null;
  totalAmount: number;
  succeededCount: number;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
  latestDonationAt: string | null;
  campaignIds: string[];
};

export type DonorDonation = {
  id: string;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  testMode: boolean;
  paidAt: string | null;
  paymentReference: string;
  createdAt: string;
  campaign: { id: string; title: { hi: string; en: string } };
  receipt: { id: string; receiptNumber: string } | null;
};

/**
 * Returns one summary row per registered DONOR user.
 * Guest donations (userId = null) are excluded — they have no User record.
 * The admin user is excluded via role filter.
 * At most 200 rows (sufficient for test/demo use).
 */
export async function listDonors(): Promise<DonorSummary[]> {
  // Fetch all registered donors (role = DONOR only; no admin)
  const users = await prisma.user.findMany({
    where: { role: UserRole.DONOR },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true },
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  // Fetch all donations for these users in one query
  const donations = await prisma.donation.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      amount: true,
      status: true,
      donorPanLast4: true,
      campaignId: true,
      createdAt: true,
    },
  });

  // Group by userId
  const byUser = new Map<string, typeof donations>();
  for (const d of donations) {
    if (!d.userId) continue;
    const bucket = byUser.get(d.userId) ?? [];
    bucket.push(d);
    byUser.set(d.userId, bucket);
  }

  return users.map((user) => {
    const rows = byUser.get(user.id) ?? [];
    const succeeded = rows.filter((r) => r.status === DonationStatus.SUCCEEDED);
    const pending   = rows.filter((r) => r.status === DonationStatus.PENDING);
    const failed    = rows.filter((r) => r.status === DonationStatus.FAILED);

    const totalAmount = succeeded.reduce((sum, r) => sum + Number(r.amount), 0);
    const latestRow = rows[0]; // already ordered desc
    const panLast4 = rows.find((r) => r.donorPanLast4)?.donorPanLast4 ?? null;
    const campaignIds = [...new Set(rows.map((r) => r.campaignId))];

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      panLast4,
      totalAmount,
      succeededCount: succeeded.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalCount: rows.length,
      latestDonationAt: latestRow ? latestRow.createdAt.toISOString() : null,
      campaignIds,
    };
  });
}

/**
 * Returns all donations for a single registered donor.
 * Only accessible to admins (enforced at the route layer).
 */
export async function listDonorDonationsForAdmin(userId: string): Promise<DonorDonation[]> {
  const donations = await prisma.donation.findMany({
    where: { userId },
    include: { campaign: true, receipt: true },
    orderBy: { createdAt: "desc" },
  });

  return donations.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    frequency: row.frequency,
    status: row.status,
    testMode: row.testMode,
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentReference: row.paymentReference,
    createdAt: row.createdAt.toISOString(),
    campaign: { id: row.campaign.id, title: { hi: row.campaign.titleHi, en: row.campaign.titleEn } },
    receipt: row.receipt ? { id: row.receipt.id, receiptNumber: row.receipt.receiptNumber } : null,
  }));
}
