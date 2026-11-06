import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

const ids = ['import-5fc1a8c5','import-299a2b7e','import-dcf7a1df','import-b1416698','import-d08d5137'];
const rows = await p.scheme.findMany({
  where: { id: { in: ids } },
  select: { id: true, nameEn: true, need: true, level: true, shortEn: true, benefitEn: true, eligibility: true, sourceUrl: true }
});
for (const r of rows) {
  let e = []; try { e = Array.isArray(r.eligibility) ? r.eligibility : JSON.parse(r.eligibility ?? '[]'); } catch {}
  console.log(`\n--- ${r.id} | ${r.need} | ${r.level}`);
  console.log(`NAME: ${r.nameEn}`);
  console.log(`BENEFIT: ${r.benefitEn?.substring(0,250)}`);
  console.log(`ELIG: ${e.map(x => x?.en ?? x).join(' | ').substring(0,300)}`);
  console.log(`URL: ${r.sourceUrl}`);
}
await p.$disconnect();
