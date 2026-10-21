// One comparable row per mission run from out/*/timeline.json.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { hopCensus } from './river-census.mjs';
import { START, LAND } from '../../src/levels/river.js';
const dir = new URL(`./${process.argv[2] || 'out'}/`, import.meta.url).pathname;
const rows = [];
for (const name of readdirSync(dir).sort()) {
  const f = `${dir}${name}/timeline.json`;
  if (!existsSync(f)) continue;
  const { timeline: tl, errors } = JSON.parse(readFileSync(f, 'utf8'));
  const me = (re) => tl.filter((e) => e.type === 'me' && re.test(e.text));
  const confirmed = me(/^mission .* started/)[0]?.t ?? 0;
  const started = me(/^starting /).filter((e) => e.t <= confirmed).pop()?.t ?? confirmed; // the call that took, not the check after it
  const firstQ = me(/^QUESTION/)[0]?.t;
  const clips = tl.filter((e) => e.type === 'clip' && e.t >= started);
  const talkBeforeFirstQ = tl.filter((e) => e.type === 'clip' && e.t >= started && e.t < firstQ).reduce((a, c) => a + (c.cut ? c.stoppedAt - c.t : c.ms), 0);
  // the response to the first deliberate wrong tap: everything said/played in the next 4 s
  const w = me(/wrong on purpose/)[0];
  const after = w ? tl.filter((e) => e.t >= w.t && e.t < w.t + 4000 && e.type !== 'me') : [];
  const wrongSay = after.filter((e) => e.type === 'say').map((e) => e.text);
  const wrongSounds = after.filter((e) => e.type === 'tone' && e.t < w.t + 400).map((e) => `${e.wave}${e.hz}${e.to > e.hz ? '↗' : e.to < e.hz ? '↘' : ''}${e.to !== e.hz ? e.to : ''}`);
  const mo = w ? JSON.parse(tl.find((e) => e.type === 'me' && e.t >= w.t && /^MOTION/.test(e.text))?.text.slice(7) || '{}') : {};
  const motion = mo.moved == null ? null : `${mo.moved}${mo.frames != null ? ` (${mo.frames} frames)` : ''}`;
  const firstWord = (arr) => (arr[0] || '').split(/[ ,.!?]/)[0];
  // the response to a right tap, for contrast
  const r = me(/\(right\)/)[0];
  const rightSay = r ? tl.filter((e) => e.type === 'say' && e.t >= r.t && e.t < r.t + 3000).map((e) => e.text) : [];
  // hesitation: lines said during the 20 s wait
  const h = me(/waiting 20 s/)[0];
  const hesitation = h ? tl.filter((e) => e.type === 'say' && e.t > h.t && e.t < h.t + 20000).map((e) => e.text) : [];
  const cut = clips.filter((c) => c.cut).length;
  const singleChoice = me(/^OPTIONS/).filter((e) => e.text.split(' ').length - 1 === 1).length;
  const questions = me(/^QUESTION/).length;
  const end = me(/celebration|no celebration/)[0]?.t;
  // the River: her hops through the stones she landed on (a new river starts at 1)
  const rivers = [];
  for (const e of me(/^STEP /)) { const [, num, x, z] = e.text.split(' '); if (num === '1') rivers.push([START]); rivers.at(-1)?.push({ x: +x, z: +z }); }
  const hops = rivers.map((p) => hopCensus(p.length > 1 ? [...p, LAND] : p)).reduce((a, c) => ({ hops: a.hops + c.hops, back: a.back + c.back, sideways: a.sideways + c.sideways }), { hops: 0, back: 0, sideways: 0 });
  rows.push({ name, motion, wrongFirst: firstWord(wrongSay), rightFirst: firstWord(rightSay), questions, minutes: end ? ((end - started) / 60000).toFixed(1) : '?', talkBeforeFirstQ: (talkBeforeFirstQ / 1000).toFixed(1), wrongSay, wrongSounds, rightSay, hesitation, cut, singleChoice, hops, errors: errors.length });
}
for (const r of rows) {
  console.log(`\n## ${r.name}: ${r.questions} questions, ${r.minutes} min, ${r.talkBeforeFirstQ} s of talk before the first question, ${r.cut} clips cut off, ${r.singleChoice} questions with one option, ${r.errors} errors`);
  console.log(`   right tap → first word "${r.rightFirst}", ${JSON.stringify(r.rightSay)}`);
  console.log(`   wrong tap → first word "${r.wrongFirst}", ${JSON.stringify(r.wrongSay)}, sounds ${r.wrongSounds.join(' ')}, object moved ${r.motion}`);
  console.log(`   20 s hesitation → ${r.hesitation.length} lines ${JSON.stringify(r.hesitation)}${new Set(r.hesitation).size < r.hesitation.length ? ' REPEATS A LINE' : ''}`);
  if (r.hops.hops) console.log(`   river → ${r.hops.hops} hops, ${r.hops.back} backwards, ${r.hops.sideways} mostly sideways`);
}
