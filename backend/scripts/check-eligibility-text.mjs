// Fetch eligibility text for schemes where we might encode rules
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

const ids = [
  'import-04859e8a',  // PMMVY
  'import-6d6a7761',  // JSSK
  'import-2a275e27',  // SUMAN
  'import-5283b3d9',  // PM Ujjwala
  'import-6c4e345f',  // CM Ladli Behna
  'import-299a2b7e',  // Samagra Vridhavastha Pension (60+)
  'import-5fc1a8c5',  // Samagra Parityakta (abandoned 18-59)
  'import-c16b0a8c',  // Udita Yojana
  'import-b019ab1d',  // Scheme for Adolescent Girls
  'import-8ae77fa9',  // Working Women Hostel
];

const rows = await p.scheme.findMany({
  where: { id: { in: ids } },
  select: { id: true, nameEn: true, eligibility: true, benefitEn: true }
});

for (const r of rows) {
  let elig = [];
  try { elig = Array.isArray(r.eligibility) ? r.eligibility : JSON.parse(r.eligibility ?? '[]'); } catch {}
  console.log(`\n=== ${r.nameEn} (${r.id}) ===`);
  elig.forEach((e, i) => console.log(`  [${i}] ${(e?.en ?? e ?? '').substring(0, 250)}`));
}

await p.$disconnect();
