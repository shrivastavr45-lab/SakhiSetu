/**
 * Audit the eligibility rules stored for every published scheme.
 * Run: node scripts/audit-rules.mjs   (from backend/)
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

const rows = await p.scheme.findMany({
  where: { published: true },
  orderBy: [{ need: 'asc' }, { nameEn: 'asc' }],
  select: { id: true, nameEn: true, need: true, level: true, rules: true, districts: true }
});

let structured = 0, empty = 0;
const structuredList = [], emptyList = [];

for (const r of rows) {
  const rules = typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules ?? {};
  const boolFields = ['married','pregnant','hasDaughter','bpl','rural','widowed','shgMember','firstChild'];
  const hasAge = rules.minAge !== undefined || rules.maxAge !== undefined;
  const hasBool = boolFields.some(f => typeof rules[f] === 'boolean');
  const hasDistrict = (() => {
    const d = typeof r.districts === 'string' ? (r.districts === '"all"' ? 'all' : r.districts) : r.districts;
    return d !== 'all' && d !== '"all"' && Array.isArray(d);
  })();
  const isStructured = hasAge || hasBool || hasDistrict;

  if (isStructured) {
    structured++;
    const ruleKeys = [];
    if (rules.minAge !== undefined) ruleKeys.push(`minAge:${rules.minAge}`);
    if (rules.maxAge !== undefined) ruleKeys.push(`maxAge:${rules.maxAge}`);
    boolFields.forEach(f => { if (typeof rules[f] === 'boolean') ruleKeys.push(`${f}:${rules[f]}`); });
    if (hasDistrict) ruleKeys.push(`districts:${JSON.stringify(r.districts)}`);
    structuredList.push({ id: r.id, name: r.nameEn, need: r.need, level: r.level, rules: ruleKeys.join(', ') });
  } else {
    empty++;
    emptyList.push({ id: r.id, name: r.nameEn, need: r.need, level: r.level });
  }
}

console.log(`\n=== STRUCTURED RULES (${structured}) ===`);
for (const s of structuredList) {
  console.log(`  [${s.need}][${s.level ?? 'no-level'}] ${s.name}`);
  console.log(`    rules: ${s.rules}`);
}

console.log(`\n=== EMPTY RULES — no structured check possible (${empty}) ===`);
for (const s of emptyList) {
  console.log(`  [${s.need}][${s.level ?? 'no-level'}] ${s.name}`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`  Total published: ${rows.length}`);
console.log(`  Structured rules: ${structured}`);
console.log(`  Empty rules (rules:{}): ${empty}`);

await p.$disconnect();
