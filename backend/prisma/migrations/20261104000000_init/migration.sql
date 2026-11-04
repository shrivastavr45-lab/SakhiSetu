CREATE TYPE "UserRole" AS ENUM ('DONOR', 'ADMIN');
CREATE TYPE "DonationFrequency" AS ENUM ('ONE_TIME', 'MONTHLY');
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "PaymentProvider" AS ENUM ('MOCK');

CREATE SEQUENCE receipt_number_seq START 1 INCREMENT 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'DONOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

CREATE TABLE "Scheme" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "need" TEXT NOT NULL,
  "nameHi" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "deptHi" TEXT NOT NULL,
  "deptEn" TEXT NOT NULL,
  "shortHi" TEXT NOT NULL,
  "shortEn" TEXT NOT NULL,
  "benefitHi" TEXT NOT NULL,
  "benefitEn" TEXT NOT NULL,
  "eligibility" JSONB NOT NULL,
  "documents" JSONB NOT NULL,
  "steps" JSONB NOT NULL,
  "rules" JSONB NOT NULL,
  "districts" JSONB NOT NULL,
  "sourceUrl" TEXT,
  "officialNoticeText" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "published" BOOLEAN NOT NULL DEFAULT false,
  "aiSummaryDraftHi" TEXT,
  "aiSummaryApproved" BOOLEAN NOT NULL DEFAULT false,
  "aiSummaryUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");
CREATE INDEX "Scheme_published_need_idx" ON "Scheme"("published", "need");
CREATE INDEX "Scheme_lastCheckedAt_idx" ON "Scheme"("lastCheckedAt");

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "titleHi" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "storyHi" TEXT NOT NULL,
  "storyEn" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "goalAmount" DECIMAL(14,2) NOT NULL,
  "raisedSeed" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "donorSeed" INTEGER NOT NULL DEFAULT 0,
  "impactHi" TEXT NOT NULL,
  "impactEn" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_active_district_idx" ON "Campaign"("active", "district");

CREATE TABLE "Donation" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "campaignId" TEXT NOT NULL,
  "donorName" TEXT NOT NULL,
  "donorEmail" TEXT NOT NULL,
  "donorPanCipher" TEXT,
  "donorPanLast4" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "frequency" "DonationFrequency" NOT NULL,
  "status" "DonationStatus" NOT NULL,
  "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'MOCK',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "paymentReference" TEXT NOT NULL,
  "testMode" BOOLEAN NOT NULL DEFAULT true,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Donation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Donation_idempotencyKey_key" ON "Donation"("idempotencyKey");
CREATE UNIQUE INDEX "Donation_paymentReference_key" ON "Donation"("paymentReference");
CREATE INDEX "Donation_userId_createdAt_idx" ON "Donation"("userId", "createdAt" DESC);
CREATE INDEX "Donation_campaignId_status_paidAt_idx" ON "Donation"("campaignId", "status", "paidAt");
CREATE INDEX "Donation_status_createdAt_idx" ON "Donation"("status", "createdAt");

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "donationId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MOCK',
  "providerRef" TEXT NOT NULL,
  "status" "DonationStatus" NOT NULL,
  "testMode" BOOLEAN NOT NULL DEFAULT true,
  "detail" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentTransaction_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentTransaction_donationId_key" ON "PaymentTransaction"("donationId");
CREATE UNIQUE INDEX "PaymentTransaction_providerRef_key" ON "PaymentTransaction"("providerRef");

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "donationId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Receipt_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Receipt_donationId_key" ON "Receipt"("donationId");
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
CREATE INDEX "Receipt_generatedAt_idx" ON "Receipt"("generatedAt");

CREATE TABLE "SiteSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);
