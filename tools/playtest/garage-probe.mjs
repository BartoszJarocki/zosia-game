// The Garage, played by dragging (walk.mjs only taps): every answer is a finger drag from the thing to its place.
// Screenshots each job mid-question and after the right answer, and measures what a parent would check by eye:
// how big each option is on screen, and whether the speech bubble covers the door, the flags or a basket.
// usage: BASE=http://127.0.0.1:4199 node garage-probe.mjs <level> [landscape|portrait] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [levelArg = '1', orient = 'landscape', outName = 'after-garage-probe'] = process.argv.slice(2);
const level = Number(levelArg);
const [w, h] = orient === 'portrait' ? [820, 1180] : [1180, 820];
const OUT = new URL(`./${outName}/garage-L${level}-${orient}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:4199';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((level) => {
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { garage: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  const said = (window.__said = []);
  const push = Array.prototype.push;
  window.__sayLog = { push: (t) => push.call(said, t) };
}, level);
await page.goto(`${BASE}/?q=low`);
const st = (fn, a) => page.evaluate(fn, a);
await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1200);
const pb = await page.locator('.play').boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 60000 }); // the swoop is over
await page.waitForTimeout(2500);
await snapIsland();
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== 'garage'; i++) { await st(() => window.__pup.game.startMission('garage')); await page.waitForTimeout(700); }

async function snapIsland() { try { await page.screenshot({ path: `${OUT}00-island.png`, timeout: 15000 }); } catch {} }
let shot = 0;
const snap = async (name) => { for (let i = 0; i < 3; i++) { try { await page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png`, timeout: 20000 }); return; } catch { await page.waitForTimeout(300); } } };
const waitAsked = (ms = 120000) => page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.learn?.isOpen && !s.speaking && (s.learn.current.promptEndAt !== null || performance.now() - s.learn.current.openedAt > 1500); }, null, { timeout: ms }).then(() => true, () => false);

// everything on offer, with its on-screen box, plus the draggable thing (a block) and where the right answer goes
const scene = () => st(() => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const V = cam.position.constructor;
  const box = (o) => {
    const min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    o.updateMatrixWorld(true);
    o.traverse((m) => {
      if (!m.isMesh || !m.visible || !m.geometry) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox;
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const p = new V(x, y, z).applyMatrix4(m.matrixWorld).project(cam);
        const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight;
        min[0] = Math.min(min[0], sx); min[1] = Math.min(min[1], sy); max[0] = Math.max(max[0], sx); max[1] = Math.max(max[1], sy);
      }
    });
    return { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, w: Math.round(max[0] - min[0]), h: Math.round(max[1] - min[1]), l: min[0], t: min[1], r: max[0], b: max[1] };
  };
  const opts = s.tappables.filter((o) => o.userData.choice !== undefined).map((o) => ({ label: o.userData.choice, right: o.userData.choice === s.last, ...box(o) }));
  const block = s.tappables.find((o) => o.userData.drag && o.userData.choice === undefined);
  const rb = document.querySelector('.bubble:not(.hidden)')?.getBoundingClientRect();
  const bubble = rb ? { l: rb.left, t: rb.top, r: rb.right, b: rb.bottom } : null;
  // the middle of the scene: the door, the flag line, the baskets (to check the bubble leaves them in view)
  const middle = s.scene.children.filter((o) => o.userData.holes || o.userData.hooks).map(box);
  // where a child would drag the answer: the asked shape's hole, or the middle of the flag line
  const board = s.scene.children.find((o) => o.userData.holes);
  const hole = board?.userData.holes.find((h) => h.shape === s.last);
  const goal = hole ? (() => { const p = board.localToWorld(hole.at.clone()).project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; })() : middle[0] && { x: middle[0].x, y: middle[0].y };
  return { q: s.learn.current && { skill: s.learn.current.skill, item: s.learn.current.item }, opts, block: block && box(block), bubble, middle, goal, mode: s.L.modes[s.roundIndex % s.L.modes.length] };
});
const overlap = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

const drag = async (from, to, steps = 18) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(from.x + (to.x - from.x) * (i / steps), from.y + (to.y - from.y) * (i / steps)); await page.waitForTimeout(30); }
  await page.mouse.up();
};

const report = [];
const seen = new Set();
for (let q = 0; q < 12; q++) {
  if (!(await waitAsked())) { report.push(`no open question: ${JSON.stringify(await st(() => { const s = window.__pup.getStage(); return { kind: s?.kind, round: s?.roundIndex, open: s?.learn?.isOpen, speaking: s?.speaking }; }))}`); break; }
  const sc = await scene();
  const key = `${sc.mode}`;
  const first = !seen.has(key);
  seen.add(key);
  if (first) await snap(`${sc.mode}-asked`);
  const right = sc.opts.find((o) => o.right);
  const row = { mode: sc.mode, q: sc.q, options: sc.opts.map((o) => `${o.label}${o.right ? '*' : ''} ${o.w}x${o.h}`), smallest: Math.min(...sc.opts.map((o) => Math.min(o.w, o.h))) };
  if (sc.bubble) row.bubbleCovers = [...sc.opts, ...sc.middle].map((o) => Math.round(overlap(o, sc.bubble))).filter(Boolean);
  const before = await st(() => window.__pup.learning.recent(50).length);
  // drag: a block goes from the front to its basket; a shape piece or a flag goes from where it lies up to the door / the line
  if (sc.block) { row.dragged = 'block → basket'; await drag(sc.block, right); }
  else { row.dragged = `${right.label} → ${sc.mode === 'shapes' ? 'its hole' : 'the line'}`; await drag(right, sc.goal); }
  const answered = (n) => window.__pup.learning.recent(50).slice(n).find((e) => e.correct || e.errorType === 'wrongChoice');
  await page.waitForFunction(answered, before, { timeout: 30000 }).catch(() => {});
  const ev = await st(answered, before);
  row.result = ev ? `${ev.skill}:${ev.item} ${ev.correct ? (ev.firstTry ? 'right first try' : 'right') : ev.errorType}` : 'no event';
  report.push(row);
  console.log(JSON.stringify(row));
  if (first) { await page.waitForTimeout(900); await snap(`${sc.mode}-right`); }
  await page.waitForTimeout(600);
}
await page.waitForSelector('.celebrate', { timeout: 120000 }).then(() => report.push('celebration'), () => report.push('no celebration within 60 s'));
await page.waitForTimeout(1500);
await snap('end');
const said = await st(() => window.__said);
writeFileSync(`${OUT}report.json`, JSON.stringify({ level, orient, errors, report, said }, null, 1));
console.log(JSON.stringify({ level, orient, errors, report }, null, 1));
await browser.close();
