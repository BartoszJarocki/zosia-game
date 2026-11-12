// name-dead-time.mjs [level] : how long after a right letter does Name Train take the next one? (verification tooling)
// She loads a word by tapping each right block the moment it can be tapped, every 80 ms until the train has it. The gap is
// from one letter's first tap to the tap the train took for the next letter: the time a quick finger is not counted.
// env: BASE (default http://localhost:4245), Q (graphics tier, default high), W, H
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const level = Number(process.argv[2] || 1);
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true });
const page = await context.newPage();
await page.addInitScript(([level, v]) => {
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v, missions: { name: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, [level, VERSION]);
await page.goto(`${process.env.BASE || 'http://localhost:4245'}/?q=${process.env.Q || 'high'}`);
await page.waitForSelector('.play', { timeout: 60000 });
await page.waitForTimeout(1200);
const pb = await page.locator('.play').boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
await page.waitForTimeout(2500);
for (let i = 0; i < 20 && (await page.evaluate(() => window.__pup.getStage()?.kind)) !== 'name'; i++) { await page.evaluate(() => window.__pup.game.startMission('name')); await page.waitForTimeout(700); }

const state = () => page.evaluate(() => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const open = s.open?.() ?? [], next = open[0], letter = next === undefined ? null : s.word[next];
  const b = (s.tappables || []).find((o) => o.userData.letter === letter && o.visible);
  let at = null;
  if (b) { const p = b.getWorldPosition(b.position.clone()); p.y += 0.4; p.project(cam); at = { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }
  const right = window.__pup.learning.recent(40).filter((e) => e.correct && e.skill === 'letterVisual').map((e) => e.at);
  return { word: s.word, at, right, celebrated: Boolean(document.querySelector('.celebrate')) || (s.placed || []).filter((p) => p.mine).length >= s.rounds, mode: s.mode, kind: s.constructor?.name };
});
const first = await state();
console.log(`level ${level}, ${first.kind}, mode ${first.mode}, word ${first.word}`);
let s = first;
for (const end = Date.now() + 120000; Date.now() < end;) {
  s = await state();
  if (s.celebrated) break;
  if (s.at) await page.touchscreen.tap(s.at.x, s.at.y);
  await page.waitForTimeout(80);
}
const at = s.right.sort((a, b) => a - b);
console.log('ms from one right letter being counted to the next (a finger tapping the next block every 80 ms):', JSON.stringify(at.slice(1).map((t, i) => Math.round(t - at[i]))));
await browser.close();
