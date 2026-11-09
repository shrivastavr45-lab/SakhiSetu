import { randomUUID } from "node:crypto";
import { DonationFrequency, DonationStatus, Prisma, UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import {
  decryptPan,
  deriveReceiptToken,
  encryptPan,
  safeEqualHex,
  sha256,
} from "../utils/crypto.js";
import { generateReceiptPdfBuffer } from "../utils/pdf-fonts.js";
import { formatReceiptNumber, requestFingerprint } from "./donation-helpers.js";
import { AppError } from "../utils/errors.js";

type DonationInput = {
  campaignId: string;
  amount: number;
  frequency: "ONE_TIME" | "MONTHLY";
  donorName: string;
  donorEmail: string;
  pan: string;
};

type SessionUser = { id: string; role: UserRole } | undefined;

async function createOrReadDonation(
  input: DonationInput,
  idempotencyKey: string,
  user: SessionUser,
  simulateFailure: boolean,
) {
  if (env.PAYMENT_MODE !== "mock")
    throw new AppError(
      503,
      "PAYMENT_MODE_UNAVAILABLE",
      "Only test-mode payments are enabled in this build.",
    );
  const fingerprint = requestFingerprint(input, env.JWT_SECRET);

  const existing = await prisma.donation.findUnique({
    where: { idempotencyKey },
    include: { receipt: true, campaign: true },
  });
  if (existing) {
    if (existing.requestHash !== fingerprint || existing.userId !== (user?.id ?? null)) {
      throw new AppError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "This idempotency key was already used for a different request.",
      );
    }
    const accessToken = existing.receipt ? deriveReceiptToken(existing.id, idempotencyKey) : null;
    return { donation: existing, accessToken };
  }

  const donationId = randomUUID();
  const paymentReference = `TEST-${randomUUID()}`;
  const accessToken = simulateFailure ? null : deriveReceiptToken(donationId, idempotencyKey);
  const status = simulateFailure ? DonationStatus.FAILED : DonationStatus.SUCCEEDED;
  const paidAt = simulateFailure ? null : new Date();

  const donation = await prisma.$transaction(
    async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true, active: true },
      });
      if (!campaign || !campaign.active)
        throw new AppError(
          404,
          "CAMPAIGN_UNAVAILABLE",
          "This campaign is not accepting donations.",
        );

      const created = await tx.donation.create({
        data: {
          id: donationId,
          userId: user?.id ?? null,
          campaignId: input.campaignId,
          donorName: input.donorName,
          donorEmail: input.donorEmail,
          donorPanCipher: encryptPan(input.pan),
          donorPanLast4: input.pan.slice(-4),
          amount: new Prisma.Decimal(input.amount),
          frequency:
            input.frequency === "MONTHLY" ? DonationFrequency.MONTHLY : DonationFrequency.ONE_TIME,
          status,
          paymentProvider: "MOCK",
          idempotencyKey,
          requestHash: fingerprint,
          paymentReference,
          testMode: true,
          paidAt,
        },
      });

      await tx.paymentTransaction.create({
        data: {
          donationId: created.id,
          provider: "MOCK",
          providerRef: paymentReference,
          status,
          testMode: true,
          detail: {
            mode: "TEST",
            outcome: simulateFailure ? "FAILED" : "SUCCEEDED",
            noMoneyMoved: true,
          },
        },
      });

      if (status === DonationStatus.SUCCEEDED && accessToken) {
        const sequenceRows = await tx.$queryRaw<Array<{ value: bigint }>>(
          Prisma.sql`SELECT nextval('receipt_number_seq') AS value`,
        );
        const sequence = Number(sequenceRows[0]?.value ?? 0);
        if (!Number.isSafeInteger(sequence) || sequence < 1)
          throw new AppError(500, "RECEIPT_SEQUENCE_ERROR", "Could not allocate a receipt number.");
        const now = new Date();
        await tx.receipt.create({
          data: {
            donationId: created.id,
            receiptNumber: formatReceiptNumber(now, sequence),
            accessTokenHash: sha256(accessToken),
          },
        });
      }

      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
  );

  return { donation, accessToken };
}

export async function createTestDonation(
  input: DonationInput,
  idempotencyKey: string | undefined,
  user: SessionUser,
  simulateFailure = false,
) {
  if (!idempotencyKey || !/^[a-zA-Z0-9._:-]{16,120}$/.test(idempotencyKey)) {
    throw new AppError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid Idempotency-Key header is required.",
    );
  }

  let result: Awaited<ReturnType<typeof createOrReadDonation>>;
  try {
    result = await createOrReadDonation(input, idempotencyKey, user, simulateFailure);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      const existing = await prisma.donation.findUnique({
        where: { idempotencyKey },
        include: { receipt: true, campaign: true },
      });
      if (
        existing &&
        existing.requestHash === requestFingerprint(input, env.JWT_SECRET) &&
        existing.userId === (user?.id ?? null)
      ) {
        const accessToken = existing.receipt
          ? deriveReceiptToken(existing.id, idempotencyKey)
          : null;
        result = { donation: existing, accessToken };
      } else if (existing) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used for a different request.",
        );
      } else {
        throw new AppError(
          409,
          "DONATION_RETRY_REQUIRED",
          "The donation request collided with another request. Retry with the same idempotency key.",
        );
      }
    } else {
      throw error;
    }
  }

  const row = await prisma.donation.findUnique({
    where: { id: result.donation.id },
    include: { receipt: true, campaign: true },
  });
  if (!row)
    throw new AppError(500, "DONATION_NOT_FOUND", "The saved donation could not be retrieved.");

  return {
    status: row.status,
    mode: "TEST" as const,
    donation: {
      id: row.id,
      donorName: row.donorName,
      amount: Number(row.amount),
      frequency: row.frequency,
      campaignId: row.campaignId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      paymentReference: row.paymentReference,
    },
    receipt: row.receipt
      ? {
          id: row.receipt.id,
          receiptNumber: row.receipt.receiptNumber,
          downloadToken: result.accessToken,
          downloadUrl: `/api/receipts/${row.receipt.id}.pdf`,
          previewOnly: true,
        }
      : null,
  };
}

export async function listMyDonations(userId: string) {
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
    createdAt: row.createdAt.toISOString(),
    campaign: {
      id: row.campaign.id,
      title: { hi: row.campaign.titleHi, en: row.campaign.titleEn },
    },
    receipt: row.receipt ? { id: row.receipt.id, receiptNumber: row.receipt.receiptNumber } : null,
  }));
}

export async function listAllDonations() {
  const donations = await prisma.donation.findMany({
    include: { campaign: true, receipt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return donations.map((row) => ({
    id: row.id,
    donorName: row.donorName,
    donorEmail: row.donorEmail,
    amount: Number(row.amount),
    frequency: row.frequency,
    status: row.status,
    testMode: row.testMode,
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentReference: row.paymentReference,
    donorPanLast4: row.donorPanLast4 ?? null,
    createdAt: row.createdAt.toISOString(),
    campaign: {
      id: row.campaign.id,
      title: { hi: row.campaign.titleHi, en: row.campaign.titleEn },
    },
    receipt: row.receipt ? { id: row.receipt.id, receiptNumber: row.receipt.receiptNumber } : null,
  }));
}

export async function receiptPdf(
  receiptId: string,
  user: SessionUser,
  downloadToken: string | undefined,
) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { donation: { include: { campaign: true } } },
  });
  if (!receipt) throw new AppError(404, "RECEIPT_NOT_FOUND", "Receipt not found.");
  const isOwner = user?.id && receipt.donation.userId === user.id;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isTokenValid = downloadToken
    ? safeEqualHex(sha256(downloadToken), receipt.accessTokenHash)
    : false;
  if (!isOwner && !isAdmin && !isTokenValid)
    throw new AppError(
      403,
      "RECEIPT_ACCESS_DENIED",
      "You do not have permission to download this receipt.",
    );
  if (receipt.donation.status !== DonationStatus.SUCCEEDED)
    throw new AppError(
      409,
      "DONATION_NOT_PAID",
      "A receipt is available only for a successful test payment.",
    );

  const donation = receipt.donation;
  const pan = decryptPan(donation.donorPanCipher);

  const trustPan =
    env.DEPLOYMENT_MODE === "demo" ? "[DEMO — NOT A REAL REGISTRATION]" : env.TRUST_PAN;
  const trust80GRegistration =
    env.DEPLOYMENT_MODE === "demo"
      ? "[DEMO — NOT A REAL REGISTRATION]"
      : env.TRUST_80G_REGISTRATION;

  // Receipts enforce required preview disclaimers:
  // "TEST / PREVIEW — NOT VALID FOR TAX CLAIMS"
  // "DEMO DOCUMENT — DO NOT SUBMIT TO THE INCOME TAX DEPARTMENT"
  // "Trust PAN and registration fields are demo placeholders"

  try {
    const { buffer } = await generateReceiptPdfBuffer(
      {
        receiptNumber: receipt.receiptNumber,
        generatedAt: receipt.generatedAt,
        donationId: donation.id,
        donorName: donation.donorName,
        donorEmail: donation.donorEmail,
        donorPan: pan,
        amount: donation.amount,
        frequency: donation.frequency,
        campaignTitle: donation.campaign.titleEn,
        trustName: env.TRUST_NAME,
        trustAddress: env.TRUST_ADDRESS,
        trustPan,
        trust80GRegistration,
        deploymentMode: env.DEPLOYMENT_MODE,
      },
      env.PDF_FONT_PATH,
      env.PDF_FONT_BOLD_PATH,
    );
    return { buffer, receiptNumber: receipt.receiptNumber };
  } catch (error: unknown) {
    const err = error as { code?: string; details?: { path?: string; triggerString?: string } };
    if (err.code === "PDF_FONT_NOT_FOUND") {
      throw new AppError(
        503,
        "PDF_FONT_NOT_FOUND",
        `The PDF font file configured in PDF_FONT_PATH does not exist: ${err.details?.path ?? ""}`,
      );
    }
    if (err.code === "PDF_UNICODE_FONT_REQUIRED") {
      const preview = (err.details?.triggerString ?? "").slice(0, 40);
      throw new AppError(
        503,
        "PDF_UNICODE_FONT_REQUIRED",
        `The receipt contains Devanagari text ("${preview}") that cannot be rendered with the built-in PDF fonts. ` +
          `Set PDF_FONT_PATH to the absolute path of a Noto Sans Devanagari TTF font file on this server. ` +
          `Download: https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari`,
      );
    }
    throw error;
  }
}
