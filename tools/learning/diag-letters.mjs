// Why does Kitty Park take ~45 runs to reach level 6? Per-level entry runs and letterAudio mastery at the gate.
process.env.NOMAIN = '1';
const { simulateChild, LEVELS } = await import('./sim.mjs');
import { averageMastery } from '../../src/learning/mastery.js';
for (const p of [0.6, 0.9]) {
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const c = simulateChild(p, 5000 + i);
    const la = c.skills.letterAudio || {};
    const sounds = [...LEVELS.letters[5].pool];
    rows.push({ L2: c.levelAt?.letters2, L3: c.levelAt?.letters3, L4: c.levelAt?.letters4, L5: c.levelAt?.letters5, L6: c.levelAt?.letters6,
      soundsAvgAtEnd: averageMastery(c.skills, 'letterAudio', sounds).toFixed(2),
      perLetter: sounds.map((l) => `${l}:${(la[l]?.attempts || 0)}/${(la[l]?.mastery || 0).toFixed(2)}`).join(' ') });
  }
  const med = (k) => { const v = rows.map((r) => r[k]).filter(Number.isFinite).sort((a, b) => a - b); return v[v.length >> 1]; };
  console.log(`p=${p}: Kitty Park run index when each level opened (median): L2 ${med('L2')} · L3 ${med('L3')} · L4 ${med('L4')} · L5 ${med('L5')} · L6 ${med('L6')}`);
  console.log('  example child (letterAudio attempts/mastery for the SOUNDS letters at the end):', rows[0].perLetter);
}
