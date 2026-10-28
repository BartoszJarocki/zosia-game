// How evenly does the real scheduler spread questions over a pool? (learning/scheduler.js + mastery.js, real code)
import { pickLearningItem, categorize } from '../../src/learning/scheduler.js';
import { applyEvent } from '../../src/learning/mastery.js';
import { makeEvent } from '../../src/learning/events.js';
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ALL = [...'ABCDEFGHIJKLMNOPRSTUWZ'], MORE = [...'ZOSIAMTEULDPKBW'];
function run(pool, p, picks, seed, perSession = 8) {
  const rng = mulberry(seed), skills = {}; let recent = [], now = Date.UTC(2026, 10, 1);
  const count = Object.fromEntries(pool.map((l) => [l, 0])); let allSeenAt = null;
  for (let i = 0; i < picks; i++) {
    if (i % perSession === 0) { recent = []; now += 1.75 * 86400000; } // a session: two Kitty Park runs (8 questions)
    const it = pickLearningItem({ candidates: pool, stats: skills.letterAudio || {}, recent, now, rng });
    recent.push(it); if (recent.length > 8) recent.shift();
    count[it]++; now += 9000;
    const ft = rng() < p;
    applyEvent(skills, makeEvent({ mission: 'letters', skill: 'letterAudio', item: it, correct: true, firstTry: ft, attempt: ft ? 1 : 2, assistLevel: 0, at: now }));
    if (!allSeenAt && pool.every((l) => count[l] > 0)) allSeenAt = i + 1;
  }
  return { count, allSeenAt, skills: skills.letterAudio };
}
for (const [name, pool] of [['MORE (Kitty L3-4, 15 letters)', MORE], ['ALL (Kitty L5, 22 letters)', ALL]]) {
  for (const p of [0.6, 0.9]) {
    const seen = [], minShare = [], maxShare = [], unseenAt40 = [];
    for (let s = 0; s < 200; s++) {
      const r = run(pool, p, 160, 77 + s);
      seen.push(r.allSeenAt ?? 999);
      const c = Object.values(r.count).sort((a, b) => a - b);
      minShare.push(c[0]); maxShare.push(c.at(-1));
      unseenAt40.push(pool.filter((l) => run(pool, p, 40, 77 + s).count[l] === 0).length);
    }
    const med = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];
    const p90 = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length * 0.9)];
    console.log(`${name}, first-try ${p}: questions until every letter asked once: median ${med(seen)}, p90 ${p90(seen)} (uniform random would need ~${Math.round(pool.length * (Math.log(pool.length) + 0.577))}); after 40 questions (10 runs) letters never asked: median ${med(unseenAt40)}; over 160 questions the least-asked letter got ${med(minShare)}, the most-asked ${med(maxShare)} (even = ${(160 / pool.length).toFixed(1)})`);
  }
}
