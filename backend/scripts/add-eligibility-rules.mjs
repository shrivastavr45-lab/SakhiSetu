/**
 * add-eligibility-rules.mjs
 *
 * Encodes structured eligibility rules for published schemes where the
 * stored eligibility text unambiguously supports a machine-readable rule.
 *
 * RULES FOR ENCODING:
 *   - Only encode what is explicitly stated in the scheme's own eligibility
 *     text already stored in the database (imported from myScheme.gov.in).
 *   - Do not infer from scheme names, benefit descriptions, or external sources.
 *   - When eligibility text is ambiguous, leave rules: {} and rely on the
 *     hasStructuredRules=false UI warning.
 *   - Only updates the `rules` field; does not touch any other field.
 *   - Does not change publication status.
 *
 * Run: node scripts/add-eligibility-rules.mjs   (from backend/)
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

const RULE_UPDATES = [
  {
    id: 'import-04859e8a',
    name: 'Pradhan Mantri Matru Vandana Yojana',
    // Stored eligibility: "The applicant should be of at least 19 years old
    //   and a pregnant women. The scheme is applicable only for the first live birth."
    rules: { pregnant: true, firstChild: true, minAge: 19 },
  },
  {
    id: 'import-6d6a7761',
    name: 'Janani Shishu Suraksha Karyakram',
    // Stored eligibility: "The applicant must be a pregnant woman."
    rules: { pregnant: true },
  },
  {
    id: 'import-2a275e27',
    name: 'Surakshit Matritva Aashwasan Yojana (SUMAN)',
    // Stored eligibility: "All pregnant women and newborns are eligible...
    //   Pregnant women from all categories, including APL and BPL, are eligible."
    rules: { pregnant: true },
  },
  {
    id: 'import-299a2b7e',
    name: 'Samagra Samajik Suraksha Vridhavastha Pension Yojana',
    // Stored eligibility: "The applicant age should be more than 60 years."
    // "more than 60" = age > 60 = minAge: 61
    rules: { minAge: 61 },
  },
  {
    id: 'import-5fc1a8c5',
    name: 'Samagra Samajik Suraksha Parityakta Pension Yojana',
    // Stored eligibility: "The Abandoned women aged between 18 to 59 years.
    //   The applicant should be living below the poverty line."
    rules: { minAge: 18, maxAge: 59, bpl: true },
  },
  {
    id: 'import-5283b3d9',
    name: 'Pradhan Mantri Ujjwala Yojana',
    // Stored eligibility: "An adult woman belonging to a poor household..."
    // BPL is the closest verifiable proxy for "poor household".
    rules: { bpl: true },
  },
  {
    id: 'import-b019ab1d',
    name: 'Scheme For Adolescent Girls',
    // Stored eligibility: "The age of the applicant must be between 11 and 14 years."
    rules: { minAge: 11, maxAge: 14 },
  },
  {
    id: 'import-6c4e345f',
    name: 'Chief Minister Ladli Behna Yojana',
    // Stored eligibility: "If a woman is below the age of 60 years..."
    // Official sources confirm 21–60. Stored text only clearly states "below 60".
    // We encode maxAge: 59 (below 60). minAge not stated in stored text — omit.
    rules: { maxAge: 59 },
  },
  // NOT encoded (reason):
  //   import-c16b0a8c  Udita Yojana — "adolescent girls AND women aged 18 to 49" is
  //                    ambiguous about lower bound; skip.
  //   import-819f2e96  Ladli Laxmi Yojana — beneficiary is a girl child, not the
  //                    applicant woman; no age/boolean rule maps cleanly.
  //   import-8ae77fa9  Working Women Hostel — working woman; no boolean we capture.
  //   import-d120823e  One Stop Centre — all women; no restricting rule.
  //   import-99e4d71b  SWADHAR Greh — all women in difficulty; no restricting rule.
  //   import-500f3b52  Beti Bachao Beti Padhao — family/awareness scheme; no rule.
  //   import-cc5cfa06  BioCARe — requires PhD/postdoc qualification; we can't encode.
  //   import-0128b21d  Kanya Vivaah/Nikaah — bride; different life stage, skip.
  //   import-624d1703  Kanya Abhibhawak Pension — for parents; skip.
  //   import-837cf97b  Samagra Samajik Suraksha (general) — broad eligibility; skip.
  //   import-b542d0e9  PG Indira Gandhi Scholarship — single girl child; hasDaughter
  //                    proxy doesn't map accurately.
  //   import-ee86faf3  Pragati Scholarship — technical diploma; skip.
  //   import-26c72967  Gaon Ki Beti — Class 12 first division; no rule to encode.
  //   import-b44f45d6  Aaws Bhatta — SC/ST/OBC student; skip.
];

console.log(`\nAdding structured rules to ${RULE_UPDATES.length} schemes...\n`);
let updated = 0;
for (const entry of RULE_UPDATES) {
  const existing = await p.scheme.findUnique({
    where: { id: entry.id },
    select: { id: true, nameEn: true, rules: true, published: true }
  });
  if (!existing) { console.warn(`  SKIP (not found): ${entry.id}`); continue; }
  const currentRules = typeof existing.rules === 'string'
    ? JSON.parse(existing.rules) : (existing.rules ?? {});
  const keys = Object.keys(currentRules);
  if (keys.length > 0) {
    console.log(`  SKIP (already has rules): ${existing.nameEn} → ${JSON.stringify(currentRules)}`);
    continue;
  }
  await p.scheme.update({ where: { id: entry.id }, data: { rules: entry.rules } });
  console.log(`  ✓ UPDATED: ${existing.nameEn}`);
  console.log(`    rules: ${JSON.stringify(entry.rules)}`);
  updated++;
}

console.log(`\n=== RESULT ===`);
console.log(`Rules added to: ${updated} schemes`);

// Final audit
const all = await p.scheme.findMany({
  where: { published: true },
  select: { id: true, nameEn: true, rules: true }
});
const boolFields = ['married','pregnant','hasDaughter','bpl','rural','widowed','shgMember','firstChild'];
const structured = all.filter(r => {
  const rules = typeof r.rules === 'string' ? JSON.parse(r.rules) : (r.rules ?? {});
  return rules.minAge !== undefined || rules.maxAge !== undefined ||
    boolFields.some(f => typeof rules[f] === 'boolean');
});
const empty = all.length - structured.length;
console.log(`\nFinal state: ${structured.length} structured, ${empty} empty-rules`);

await p.$disconnect();
