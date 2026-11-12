// delivery-lift.mjs [level] [landscape|portrait] : how far must she drag the parcel before a drop posts it? (verification tooling)
// Pup Delivery, a `soundLetter` level. For each drag length (px, straight up from the parcel's middle) the parcel is let go and
// the game says whether it posted (a learning event was logged: right or wrong) or floated back. A drag that barely moves
// must post nothing. Also drags the parcel onto each mailbox's middle: those must post.
// env: BASE (default http://localhost:4245), Q (graphics tier, default high), SNAP (a path: a screenshot of the first round)
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const level = Number(process.argv[2] || 3);
const portrait = process.argv[3] === 'portrait';
const W = portrait ? 820 : 1180, H = portrait ? 1180 : 820;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true })).newPage();
await page.addInitScript(([level, v]) => {
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v, missions: { delivery: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, [level, VERSION]);
await page.goto(`${process.env.BASE || 'http://localhost:4245'}/?q=${process.env.Q || 'high'}`);
await page.waitForSelector('.play', { timeout: 60000 });
await page.waitForTimeout(1200);
const pb = await page.locator('.play').boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
await page.waitForTimeout(2500);

const spots = () => page.evaluate(() => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const at = (o, up = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += up; p.project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
  const parcel = (s.tappables || []).find((o) => o.userData.drag);
  const boxes = (s.tappables || []).filter((o) => o.userData.letter && !o.userData.drag && o.visible);
  return { kind: s.kind, mode: s.L?.mode, parcel: parcel && at(parcel, 0.6), boxes: boxes.map((b) => ({ letter: b.userData.letter, ...at(b, 1.9) })), events: window.__pup.learning.recent(50).length };
});
const events = () => page.evaluate(() => window.__pup.learning.recent(50).length);
const fresh = async () => {
  await page.evaluate(() => window.__pup.game.startMission('delivery'));
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(300); const s = await spots(); if (s.kind === 'delivery' && s.parcel && s.boxes.length) { await page.waitForTimeout(1500); return spots(); } }
  throw new Error('no parcel and mailboxes');
};
const drag = async (from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(900);
};

let s = await fresh();
if (process.env.SNAP) await page.screenshot({ path: process.env.SNAP });
console.log(`${s.mode} level ${level}, ${W}x${H}; parcel at ${Math.round(s.parcel.x)},${Math.round(s.parcel.y)}; mailboxes ${s.boxes.map((b) => `${b.letter}@${Math.round(b.x)},${Math.round(b.y)}`).join(' ')}`);
if (s.mode !== 'soundLetter') { console.log('this level has no mailboxes'); await browser.close(); process.exit(0); }
for (const dy of [14, 30, 50, 70, 90, 110, 130, 160, 200, 260]) {
  s = await fresh();
  const before = await events();
  await drag(s.parcel, { x: s.parcel.x, y: s.parcel.y - dy });
  const posted = (await events()) > before;
  console.log(`drag ${String(dy).padStart(3)} px up: ${posted ? 'POSTED' : 'floated back'}`);
}
for (const i of [0, 1, 2]) {
  s = await fresh();
  const b = s.boxes[i];
  if (!b) continue;
  const before = await events();
  await drag(s.parcel, { x: b.x, y: b.y });
  console.log(`drag onto mailbox ${b.letter} (${Math.round(b.x)},${Math.round(b.y)}): ${(await events()) > before ? 'POSTED' : 'floated back'}`);
}
await browser.close();
