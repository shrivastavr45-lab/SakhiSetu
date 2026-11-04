import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const rootEnvPath = resolve(process.cwd(), "backend/.env");
const backendEnvPath = resolve(process.cwd(), ".env");
dotenv.config({ path: process.env.ENV_FILE ?? (existsSync(rootEnvPath) ? rootEnvPath : backendEnvPath) });
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { CAMPAIGNS, DISTRICTS } from "../../src/lib/data.ts";

const prisma = new PrismaClient();
const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@sakhisetu.test").toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? "SakhiDemo!2026";


const briefSchemes = [
  {
    id: "SCH-014", code: "SCH-014", need: "money",
    nameHi: "राज्य विधवा पेंशन", nameEn: "State widow pension",
    deptHi: "मध्य प्रदेश शासन (नमूना विवरण)", deptEn: "Government of Madhya Pradesh (sample description)",
    shortHi: "पात्र विधवा महिलाओं को हर महीने पेंशन सहायता।", shortEn: "Monthly pension support for eligible widowed women.",
    benefitHi: "₹600 प्रति माह", benefitEn: "₹600 per month",
    eligibility: [{ hi: "विधवा महिला, उम्र 18 से 79 वर्ष", en: "Widowed woman aged 18–79" }, { hi: "बीपीएल कार्ड होना चाहिए", en: "Must hold a BPL card" }],
    documents: [],
    steps: [],
    rules: { minAge: 18, maxAge: 79, bpl: true, widowed: true }, districts: "all",
    lastCheckedAt: new Date("2026-09-12T00:00:00.000Z"), published: true,
  },
  {
    id: "SCH-022", code: "SCH-022", need: "work",
    nameHi: "स्व-सहायता समूह ऋण सहायता", nameEn: "Self-help group loan support",
    deptHi: "नमूना विवरण", deptEn: "Sample description",
    shortHi: "पंजीकृत स्व-सहायता समूह की सदस्य महिलाओं के लिए कम ब्याज पर ऋण सहायता।", shortEn: "Lower-interest loan support for members of registered self-help groups.",
    benefitHi: "₹3 लाख तक कम ब्याज पर ऋण", benefitEn: "Loan up to ₹3 lakh at lower interest",
    eligibility: [{ hi: "पंजीकृत स्व-सहायता समूह की सदस्य", en: "Member of a registered SHG" }],
    documents: [],
    steps: [],
    rules: { shgMember: true }, districts: "all",
    lastCheckedAt: new Date("2026-08-30T00:00:00.000Z"), published: true,
  },
  {
    id: "SCH-031", code: "SCH-031", need: "health",
    nameHi: "मातृत्व नकद लाभ", nameEn: "Maternity cash benefit",
    deptHi: "नमूना विवरण", deptEn: "Sample description",
    shortHi: "पहली संतान के लिए गर्भवती महिला को किस्तों में आर्थिक सहायता।", shortEn: "Instalment-based financial support for a pregnant woman expecting her first child.",
    benefitHi: "₹5,000 किस्तों में", benefitEn: "₹5,000 in instalments",
    eligibility: [{ hi: "गर्भवती महिला", en: "Pregnant woman" }, { hi: "पहली संतान होनी चाहिए", en: "Must be expecting the first child" }],
    documents: [],
    steps: [],
    rules: { pregnant: true, firstChild: true }, districts: "all",
    lastCheckedAt: new Date("2026-10-05T00:00:00.000Z"), published: true,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { name: "SakhiSetu Demo Administrator", email: adminEmail, passwordHash, role: "ADMIN" },
    update: {},
  });

  for (const district of DISTRICTS) {
    await prisma.siteSetting.upsert({
      where: { key: `district:${district.id}` },
      create: { key: `district:${district.id}`, value: district.name },
      update: { value: district.name },
    });
  }

  for (const scheme of briefSchemes) {
    const { code, lastCheckedAt, ...data } = scheme;
    await prisma.scheme.upsert({
      where: { id: scheme.id },
      create: { ...data, code, lastCheckedAt },
      update: {},
    });
  }

  for (const campaign of CAMPAIGNS) {
    await prisma.campaign.upsert({
      where: { id: campaign.id },
      create: {
        id: campaign.id,
        titleHi: campaign.title.hi,
        titleEn: campaign.title.en,
        storyHi: campaign.story.hi,
        storyEn: campaign.story.en,
        district: campaign.district,
        goalAmount: campaign.goal,
        raisedSeed: campaign.raised,
        donorSeed: campaign.donors,
        impactHi: campaign.impact.hi,
        impactEn: campaign.impact.en,
        emoji: campaign.emoji,
        active: campaign.active,
      },
      update: {},
    });
  }

  await prisma.siteSetting.upsert({
    where: { key: "homepage-banner" },
    create: { key: "homepage-banner", value: "उपलब्ध योजनाओं और सहायता की जानकारी यहाँ देखें।" },
    update: {},
  });

  console.info(`Seeded ${briefSchemes.length} brief schemes, ${CAMPAIGNS.length} illustrative campaigns and admin ${adminEmail}.`);
  console.info("The three schemes reproduce the assignment sample data. Their documents, application steps and official sources were not supplied and are intentionally left blank. Campaign figures are illustrative demo data, not verified donor records.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
