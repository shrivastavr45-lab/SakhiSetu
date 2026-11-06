// Verify public scheme counts and filters
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

const pub = await p.scheme.findMany({
  where: { published: true },
  select: { id: true, nameEn: true, need: true, level: true, lastCheckedAt: true, sourceUrl: true, districts: true }
});

console.log(`\n=== ${pub.length} PUBLISHED SCHEMES ===\n`);
for (const s of pub) {
  console.log(`[${s.need}][${s.level ?? 'no-level'}] ${s.nameEn}`);
  console.log(`  lastCheckedAt: ${s.lastCheckedAt?.toISOString() ?? 'null'} | districts: ${JSON.stringify(s.districts)}`);
}

// Need breakdown
const needCounts = {};
for (const s of pub) { needCounts[s.need] = (needCounts[s.need] ?? 0) + 1; }
console.log('\n=== BY NEED ===');
for (const [k, v] of Object.entries(needCounts)) console.log(`  ${k}: ${v}`);

// Level breakdown
const levelCounts = {};
for (const s of pub) { levelCounts[s.level ?? 'none'] = (levelCounts[s.level ?? 'none'] ?? 0) + 1; }
console.log('\n=== BY LEVEL ===');
for (const [k, v] of Object.entries(levelCounts)) console.log(`  ${k}: ${v}`);

// Districts
const districtRestricted = pub.filter(s => {
  try { const d = typeof s.districts === 'string' ? JSON.parse(s.districts) : s.districts; return d !== 'all' && Array.isArray(d); } catch { return false; }
});
console.log(`\nDistrict-restricted: ${districtRestricted.length}`);
const allDistricts = pub.filter(s => {
  try { const d = typeof s.districts === 'string' ? JSON.parse(s.districts) : s.districts; return d === 'all'; } catch { return false; }
});
console.log(`All-districts: ${allDistricts.length}`);

await p.$disconnect();
