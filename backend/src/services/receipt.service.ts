import { DonationStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export type AdminReceiptRow = {
  id: string;
  receiptNumber: string;
  generatedAt: string;
  donationId: string;
  donorName: string;
  donorEmail: string;
  donorPanLast4: string | null;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  testMode: boolean;
  paidAt: string | null;
  campaign: { id: string; title: { hi: string; en: string } };
};

/**
 * Returns all receipts for succeeded donations, newest first.
 * Capped at 500 rows — sufficient for test / demo use.
 * Admin-only access is enforced at the route layer.
 */
export async function listAdminReceipts(): Promise<AdminReceiptRow[]> {
  const rows = await prisma.receipt.findMany({
    include: {
      donation: {
        include: { campaign: true },
      },
    },
    orderBy: { generatedAt: "desc" },
    take: 500,
  });

  // Only SUCCEEDED donations have receipts by design, but guard defensively.
  return rows
    .filter((r) => r.donation.status === DonationStatus.SUCCEEDED)
    .map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      generatedAt: r.generatedAt.toISOString(),
      donationId: r.donationId,
      donorName: r.donation.donorName,
      donorEmail: r.donation.donorEmail,
      donorPanLast4: r.donation.donorPanLast4 ?? null,
      amount: Number(r.donation.amount),
      frequency: r.donation.frequency,
      testMode: r.donation.testMode,
      paidAt: r.donation.paidAt?.toISOString() ?? null,
      campaign: {
        id: r.donation.campaign.id,
        title: { hi: r.donation.campaign.titleHi, en: r.donation.campaign.titleEn },
      },
    }));
}
