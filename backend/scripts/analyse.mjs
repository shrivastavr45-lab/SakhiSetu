// Analysis script — run from backend/ directory: node scripts/analyse.mjs
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const { PrismaClient } = await import('@prisma/client');
const p = new PrismaClient();

// ── 1. Overview counts ────────────────────────────────────────────────────────
const total    = await p.scheme.count();
const pub      = await p.scheme.count({ where: { published: true } });
const drafts   = await p.scheme.count({ where: { published: false } });
const cen      = await p.scheme.count({ where: { level: 'Central Government' } });
const sta      = await p.scheme.count({ where: { level: 'State Government' } });
const noLevel  = await p.scheme.count({ where: { level: null } });
const withSrc  = await p.scheme.count({ where: { published: false, sourceUrl: { not: null } } });
const noSrc    = await p.scheme.count({ where: { published: false, sourceUrl: null } });

console.log('\n=== OVERVIEW ===');
console.log(JSON.stringify({ total, pub, drafts, cen, sta, noLevel, withSrc, noSrc }, null, 2));

// ── 2. Need breakdown ─────────────────────────────────────────────────────────
const needs = await p.scheme.groupBy({
  by: ['need'],
  _count: { id: true },
  orderBy: { _count: { id: 'desc' } }
});
console.log('\n=== BY NEED ===');
needs.forEach(n => console.log(`  ${n.need}: ${n._count.id}`));

// ── 3. Pull all drafts for scoring ────────────────────────────────────────────
const allDrafts = await p.scheme.findMany({
  where: { published: false },
  select: {
    id: true, code: true, nameEn: true, nameHi: true,
    need: true, level: true, sourceUrl: true, myschemeUrl: true, myschemeSlug: true,
    eligibility: true, documents: true, steps: true, benefitEn: true,
    shortEn: true, shortHi: true
  }
});

const womenKeywords = [
  'women','woman','mahila','female','girl','widow','maternity','pregnant','mother',
  'nari','stri','balika','kishori','vidhwa','mata','beti','ladki','daughter',
  'pension','anganwadi','poshan','nutrition','shg','self help','self-help','svayam',
  'ladli','lakhpati','sakhi','swasthya','suraksha','bima','mudra','ujjwala',
  'pradhan mantri','pmay','jan dhan','pm kisan','ration','garib ','bpl',
  'minority women','tribal women','divyang','disability','old age','scholarship',
  'educational','education','housing','awas','financial assistance','matru',
  'janani','sishu','infant','child','birth','delivery','health','medical',
  'cancer','disease','treatment','senior citizen','elderly','widow','widowed'
];
const mpKeywords = [
  'madhya pradesh','mp ','(mp)','madhyapradesh','bhopal',
  'all states','all india','pan india','across india','nationwide','national'
];

const scored = allDrafts.map(s => {
  const nameStr    = (s.nameEn ?? '').toLowerCase() + ' ' + (s.nameHi ?? '').toLowerCase();
  const benefitStr = (s.benefitEn ?? '').toLowerCase();
  const shortStr   = (s.shortEn ?? '').toLowerCase() + ' ' + (s.shortHi ?? '').toLowerCase();

  let eligArr = [];
  try { eligArr = Array.isArray(s.eligibility) ? s.eligibility : JSON.parse(s.eligibility ?? '[]'); } catch {}
  const eligStr = eligArr.map(e => typeof e === 'string' ? e : ((e?.en ?? '') + ' ' + (e?.hi ?? ''))).join(' ').toLowerCase();

  const combined = nameStr + ' ' + benefitStr + ' ' + shortStr + ' ' + eligStr;

  let score = 0;
  const womenHits = [];
  for (const kw of womenKeywords) {
    if (combined.includes(kw)) { score += 2; womenHits.push(kw); }
  }
  let mpRelevant = false;
  for (const kw of mpKeywords) {
    if (combined.includes(kw) || s.level === 'Central Government') { mpRelevant = true; break; }
  }
  if (mpRelevant) score += 1;

  const hasSource = !!(s.sourceUrl ?? s.myschemeUrl);
  let docsArr = []; try { docsArr = Array.isArray(s.documents) ? s.documents : JSON.parse(s.documents ?? '[]'); } catch {}
  let stepsArr = []; try { stepsArr = Array.isArray(s.steps) ? s.steps : JSON.parse(s.steps ?? '[]'); } catch {}

  const hasEligibility = eligArr.length > 0;
  const hasDocuments   = docsArr.length > 0;
  const hasSteps       = stepsArr.length > 0;

  if (hasSource)      score += 2;
  if (hasEligibility) score += 1;
  if (hasDocuments)   score += 1;
  if (hasSteps)       score += 1;

  return {
    id: s.id, code: s.code, name: s.nameEn, need: s.need, level: s.level,
    score, womenHits: [...new Set(womenHits)], mpRelevant,
    hasSource, hasEligibility, hasDocuments, hasSteps,
    sourceUrl: s.sourceUrl, myschemeUrl: s.myschemeUrl, slug: s.myschemeSlug
  };
});

scored.sort((a, b) => b.score - a.score);

console.log('\n=== TOP 80 CANDIDATES (score >= 5) ===');
const top = scored.filter(s => s.score >= 5).slice(0, 80);
top.forEach(s => {
  console.log(`[${s.score}] ${s.code ?? s.id} | ${s.need} | ${s.level ?? 'no-level'} | ${(s.name ?? '').substring(0,80)}`);
  if (s.sourceUrl) console.log(`       url: ${s.sourceUrl}`);
  if (s.womenHits.length) console.log(`       kw: ${s.womenHits.slice(0,5).join(', ')}`);
});

// ── 4. By category ────────────────────────────────────────────────────────────
const categories = { health: [], money: [], education: [], work: [], housing: [] };
for (const s of scored.filter(s => s.score >= 4)) {
  if (categories[s.need]) categories[s.need].push(s);
}
console.log('\n=== WOMEN-RELEVANT BY NEED (score>=4) ===');
for (const [need, items] of Object.entries(categories)) {
  console.log(`\n  ${need.toUpperCase()} (${items.length}):`);
  items.slice(0, 20).forEach(s =>
    console.log(`    [${s.score}] ${s.code ?? s.id} ${(s.name ?? '').substring(0,70)}`)
  );
}

// ── 5. Complete records (all 4 data fields present + source) ─────────────────
const complete = scored.filter(s => s.hasSource && s.hasEligibility && s.hasDocuments && s.hasSteps);
console.log(`\n=== FULLY COMPLETE RECORDS (src+elig+docs+steps): ${complete.length} ===`);
console.log('Top 50 by score:');
complete.slice(0, 50).forEach(s =>
  console.log(`  [${s.score}] ${s.code ?? s.id} | ${s.level ?? '?'} | ${(s.name ?? '').substring(0,70)}`)
);

// ── 6. MP State-level schemes ─────────────────────────────────────────────────
const mpState = scored.filter(s => s.level === 'State Government');
console.log(`\n=== STATE GOVERNMENT SCHEMES (${mpState.length} total) ===`);
mpState.slice(0, 40).forEach(s =>
  console.log(`  [${s.score}] ${s.code ?? s.id} | ${(s.name ?? '').substring(0,70)}`)
);

await p.$disconnect();
