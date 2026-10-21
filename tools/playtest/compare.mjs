// Production (baseline/) next to the branch (after/), run by run: node compare.mjs [before] [after]
import { summarize } from './summarize.mjs';
const [a, b] = [process.argv[2] || 'baseline', process.argv[3] || 'after'];
const before = Object.fromEntries(summarize(a).map((r) => [r.name, r])), after = summarize(b);
const rep = (h) => (new Set(h).size < h.length ? '*' : '');
const cell = (r) => (r ? [`"${r.wrongFirst}"`, `${r.hesitation.length}${rep(r.hesitation)}`, r.singleChoice, r.hops.hops ? `${r.hops.back + r.hops.sideways}/${r.hops.hops}` : '-', r.minutes, r.questions, r.errors].join(' | ') : '(not run)');
console.log(`| run | ${a}: wrong tap starts with · lines in 20 s wait (* repeats) · one-option · river off-course hops · min · questions · errors | ${b}: same |`);
console.log('|---|---|---|');
for (const r of after) console.log(`| ${r.name} | ${cell(before[r.name])} | ${cell(r)} |`);
