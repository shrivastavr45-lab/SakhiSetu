// Fetch full details for top candidates — run from backend/
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

// IDs from analysis: top women-relevant schemes by score
const TARGET_IDS = [
  'import-819f2e96',  // Ladli Laxmi Yojana [34]
  'import-04859e8a',  // PM Matru Vandana Yojana [32]
  'import-6d6a7761',  // Janani Shishu Suraksha [28]
  'import-2a275e27',  // Surakshit Matritva Aashwasan [28]
  'import-6c4e345f',  // CM Ladli Behna Yojana [28]
  'import-837cf97b',  // Samagra Samajik Suraksha Pension [24]
  'import-c16b0a8c',  // Udita Yojana [24]
  'import-b019ab1d',  // Scheme For Adolescent Girls [24]
  'import-500f3b52',  // Beti Bachao Beti Padhao [24]
  'import-8ae77fa9',  // Scheme For Working Women Hostel [22]
  'import-b1416698',  // Mukhyamantri Covid-19 Bal Seva Yojana [22]
  'import-5283b3d9',  // PM Ujjwala Yojana [20]
  'import-0415a27e',  // Pregnant Cow/BPL — likely not women [20]
  'import-d120823e',  // One Stop Centre [20]
  'import-b542d0e9',  // PG Indira Gandhi Scholarship Single Girl [20]
  'import-ee86faf3',  // Pragati Scholarship Girl Technical [20]
  'import-cc5cfa06',  // BioCARe Women Scientists [20]
  'import-99e4d71b',  // score 20
  'import-078b47b4',  // score 20
  'import-8b95dc1f',  // Disabled Persons Aids [20]
  'import-624d1703',  // State [18]
  'import-417e0787',  // State [18]
  'import-0128b21d',  // State [18]
  'import-b44f45d6',  // State education [18]
  'import-d08d5137',  // State education [18]
  'import-26c72967',  // State education [18]
  'import-5fc1a8c5',  // Samagra Parityakta Pension [12]
  'import-299a2b7e',  // Samagra Vridhavastha Pension [12]
  'import-dcf7a1df',  // Vridh Ashram Pension [12]
  'import-14d14f12',  // Overseas Scholarship ST/MP [12]
];

const schemes = await p.scheme.findMany({
  where: { id: { in: TARGET_IDS } },
  select: {
    id: true, code: true, nameEn: true, nameHi: true,
    need: true, level: true, shortEn: true, shortHi: true,
    benefitEn: true, benefitHi: true, eligibility: true,
    documents: true, steps: true, districts: true, rules: true,
    sourceUrl: true, myschemeUrl: true, myschemeSlug: true,
    officialNoticeText: true, published: true
  }
});

for (const s of schemes) {
  console.log('\n' + '='.repeat(80));
  console.log(`ID: ${s.id}`);
  console.log(`NAME: ${s.nameEn}`);
  console.log(`NEED: ${s.need} | LEVEL: ${s.level}`);
  console.log(`SHORT: ${s.shortEn?.substring(0, 200)}`);
  console.log(`BENEFIT: ${s.benefitEn?.substring(0, 300)}`);
  console.log(`SOURCE: ${s.sourceUrl}`);
  console.log(`MYSCHEME: ${s.myschemeUrl}`);
  let elig = []; try { elig = Array.isArray(s.eligibility) ? s.eligibility : JSON.parse(s.eligibility ?? '[]'); } catch {}
  let docs = []; try { docs = Array.isArray(s.documents) ? s.documents : JSON.parse(s.documents ?? '[]'); } catch {}
  let steps = []; try { steps = Array.isArray(s.steps) ? s.steps : JSON.parse(s.steps ?? '[]'); } catch {}
  console.log(`ELIGIBILITY (${elig.length}): ${JSON.stringify(elig).substring(0, 400)}`);
  console.log(`DOCUMENTS (${docs.length}): ${JSON.stringify(docs).substring(0, 300)}`);
  console.log(`STEPS (${steps.length}): ${JSON.stringify(steps).substring(0, 300)}`);
  console.log(`DISTRICTS: ${JSON.stringify(s.districts)}`);
  console.log(`RULES: ${JSON.stringify(s.rules)}`);
  console.log(`OFFICIAL NOTICE: ${s.officialNoticeText?.substring(0, 200) ?? 'none'}`);
  console.log(`PUBLISHED: ${s.published}`);
}

await p.$disconnect();
