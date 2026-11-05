import { z } from "zod";


const schemeRulesSchema = z.object({
  minAge: z.number().int().min(0).max(120).optional(),
  maxAge: z.number().int().min(0).max(120).optional(),
  married: z.boolean().optional(),
  pregnant: z.boolean().optional(),
  hasDaughter: z.boolean().optional(),
  bpl: z.boolean().optional(),
  rural: z.boolean().optional(),
  widowed: z.boolean().optional(),
  shgMember: z.boolean().optional(),
  firstChild: z.boolean().optional(),
}).strict().refine((value) => value.minAge === undefined || value.maxAge === undefined || value.minAge <= value.maxAge, {
  message: "minAge must be less than or equal to maxAge.",
});

const panSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid 10-character PAN.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 UTF-8 bytes for bcrypt."),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128).refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 UTF-8 bytes for bcrypt."),
});

export const profileSchema = z.object({
  age: z.number().int().min(0).max(120).optional(),
  ageMin: z.number().int().min(0).max(120).optional(),
  ageMax: z.number().int().min(0).max(120).optional(),
  married: z.boolean().optional(),
  pregnant: z.boolean().optional(),
  hasDaughter: z.boolean().optional(),
  bpl: z.boolean().optional(),
  rural: z.boolean().optional(),
  widowed: z.boolean().optional(),
  shgMember: z.boolean().optional(),
  firstChild: z.boolean().optional(),
  need: z.enum(["money", "health", "work", "education", "housing"]).optional(),
  district: z.enum(["bhopal", "sehore", "raisen", "vidisha", "rajgarh", "dewas", "shajapur", "narmadapuram", "betul"]).optional(),
}).strict().refine((profile) => {
  const hasMin = profile.ageMin !== undefined;
  const hasMax = profile.ageMax !== undefined;
  if (profile.age !== undefined && (hasMin || hasMax)) return false;
  if (hasMin !== hasMax) return false;
  return !hasMin || profile.ageMin! <= profile.ageMax!;
}, { message: "Provide either one exact age or a complete age range with minimum not greater than maximum." });

export const donationSchema = z.object({
  campaignId: z.string().trim().min(1).max(80),
  amount: z.number().finite().multipleOf(0.01).min(100).max(10_000_000),
  frequency: z.enum(["ONE_TIME", "MONTHLY"]),
  donorName: z.string().trim().min(2).max(120),
  donorEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  pan: panSchema,
}).strict();

export const createSchemeSchema = z.object({
  id: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9-]+$/).optional(),
  code: z.string().trim().max(40).optional().nullable(),
  need: z.enum(["money", "health", "work", "education", "housing"]),
  name: z.object({ hi: z.string().trim().min(2).max(180), en: z.string().trim().min(2).max(180) }),
  dept: z.object({ hi: z.string().max(180), en: z.string().max(180) }).optional(),
  short: z.object({ hi: z.string().max(1000), en: z.string().max(1000) }).optional(),
  benefit: z.object({ hi: z.string().max(1000), en: z.string().max(1000) }).optional(),
  eligibility: z.array(z.object({ hi: z.string().max(500), en: z.string().max(500) })).max(30).optional(),
  documents: z.array(z.object({ hi: z.string().max(200), en: z.string().max(200) })).max(30).optional(),
  steps: z.array(z.object({ hi: z.string().max(500), en: z.string().max(500) })).max(30).optional(),
  rules: schemeRulesSchema.optional(),
  districts: z.union([z.literal("all"), z.array(z.enum(["bhopal", "sehore", "raisen", "vidisha", "rajgarh", "dewas", "shajapur", "narmadapuram", "betul"])).max(9)]).optional(),
  sourceUrl: z.string().url().max(2048).refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  }, "Source URL must use HTTP or HTTPS.").optional().nullable(),
  officialNoticeText: z.string().max(30000).optional().nullable(),
  lastCheckedAt: z.string().datetime().optional().nullable(),
  published: z.boolean().optional(),
  // Import-source metadata (populated by the CSV import pipeline; null for manually-created schemes)
  myschemeSlug: z.string().trim().min(1).max(200).optional().nullable(),
  level: z.enum(["Central Government", "State Government"]).optional().nullable(),
  myschemeUrl: z.string().url().max(2048).optional().nullable(),
}).strict();

export const updateSchemeSchema = createSchemeSchema.omit({ id: true }).partial().extend({
  published: z.boolean().optional(),
}).strict();

export const updateCampaignSchema = z.object({
  goalAmount: z.number().finite().min(1000).max(100_000_000).optional(),
  active: z.boolean().optional(),
}).strict();

export const assistantSchema = z.object({
  message: z.string().trim().min(3).max(2000),
  language: z.enum(["hi", "en"]).default("hi"),
}).strict();

export const bannerSchema = z.object({
  text: z.string().trim().max(1000),
}).strict();
