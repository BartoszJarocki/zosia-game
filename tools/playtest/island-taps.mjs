// island-taps.mjs <garage|picnic|river> [level] : real fingers on the real GPU, for the three places where a tap or a
// drop used to land on the wrong thing (G5b). Prints what each one did; exits 1 when one went wrong.
//   garage  drags the asked piece to a wrong hole, then another piece to its own hole, then the asked one to its hole
//   picnic  taps the kitten's lower body, Zosia's feet and Chase: none may choose a blanket
//   river   taps where a stone lies hidden behind Zosia (a stone put there for the test): the stone must take it
// env: BASE (default http://localhost:4246), OUTDIR, W, H
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [place = 'garage', levelArg] = process.argv.slice(2);
const level = Number(levelArg || { garage: 2, picnic: 3, river: 2 }[place]);
const kind = { garage: 'garage', picnic: 'picnic', river: 'stones' }[place];
const BASE = process.env.BASE || 'http://localhost:4246', W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const OUT = `${process.env.OUTDIR || 'out'}/island-taps-${place}-L${level}/`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(([kind, level, v]) => {
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v, missions: { [kind]: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, [kind, level, VERSION]);
await page.goto(`${BASE}/?q=high`);
const st = (fn, a) => page.evaluate(fn, a);
await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1200);
const pb = await page.locator('.play').boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 60000 });
await page.waitForTimeout(2500);
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== kind; i++) { await st((k) => window.__pup.game.startMission(k), kind); await page.waitForTimeout(700); }
if ((await st(() => window.__pup.getStage().level)) !== level) { console.error('wrong level'); process.exit(2); }
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png`, timeout: 15000 }).catch(() => {});
const screen = (world) => st((p) => { const v = new window.__pup.camera.position.constructor(...p).project(window.__pup.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, world);
const state = () => st(() => { const s = window.__pup.getStage(), q = s.learn.current; return { open: Boolean(q), wrong: q?.wrong ?? null, answers: s.answers.length, last: s.last }; });
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; };

if (place === 'garage') {
  await st(() => new Promise((r) => { const t = setInterval(() => { const s = window.__pup.getStage(); if (s.tappables.some((o) => o.userData.choice) && s.learn.current) { clearInterval(t); r(); } }, 100); }));
  await page.waitForTimeout(2500);
  const info = await st(() => {
    const s = window.__pup.getStage();
    const board = s.scene.children.find((o) => o.userData.holes);
    return { want: s.last, holes: board.userData.holes.map((h) => ({ shape: h.shape, x: board.position.x + h.at.x })), pieces: s.tappables.filter((o) => o.userData.choice).map((o) => ({ shape: o.userData.choice, x: o.position.x, y: o.position.y, z: o.position.z })) };
  });
  console.log('asked', info.want, 'holes', info.holes.map((h) => `${h.shape}@${h.x}`).join(' '));
  const piece = (shape) => info.pieces.find((p) => p.shape === shape), hole = (shape) => info.holes.find((h) => h.shape === shape);
  const drag = async (shape, holeShape) => {
    const p = piece(shape), from = await screen([p.x, p.y, p.z]), to = await screen([hole(holeShape).x, p.y, 0.2]);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 12, from.y + (to.y - from.y) * i / 12); await page.waitForTimeout(25); }
    await shot(`drag-${shape}-over-${holeShape}`);
    await page.mouse.up();
    await page.waitForTimeout(1100);
  };
  const atHome = (shape) => st((shape) => { const o = window.__pup.getStage().tappables.find((x) => x.userData.choice === shape); return o ? o.position.distanceTo(o.userData.home) : null; }, shape);
  const other = info.holes.find((h) => h.shape !== info.want).shape;
  const b0 = await state();
  await drag(info.want, other);
  const b1 = await state();
  check(b1.wrong === b0.wrong + 1 && b1.answers === 0, `the asked ${info.want} dropped over the ${other} hole: a wrong try (${b0.wrong} -> ${b1.wrong})`);
  check((await atHome(info.want)) < 0.15, `and it is back in its place (${(await atHome(info.want))?.toFixed(2)} away)`);
  await drag(other, other);
  const b2 = await state();
  check(b2.wrong === b1.wrong + 1 && b2.answers === 0, `a ${other} over its own hole when ${info.want} was asked: a wrong try (${b1.wrong} -> ${b2.wrong})`);
  check((await atHome(other)) < 0.15, `and it is back in its place (${(await atHome(other))?.toFixed(2)} away)`);
  await drag(info.want, info.want);
  await page.waitForTimeout(1200);
  const b3 = await state();
  check(b3.answers === 1 || !b3.open || b3.last !== info.want, `the asked ${info.want} dropped over its own hole fits (answers ${b3.answers})`);
  await shot('after');
}

if (place === 'picnic') {
  await st(() => new Promise((r) => { const t = setInterval(() => { const s = window.__pup.getStage(); if (s.kitten && s.learn.current) { clearInterval(t); r(); } }, 100); }));
  const spots = await st(() => {
    const s = window.__pup.getStage();
    const at = (o, dx, y) => { const p = o.getWorldPosition(o.position.clone()); return [p.x + dx, y, p.z]; };
    return { kitten: [0.1, 0.3, 0.6].map((y) => at(s.kitten, 0, y)), zosia: [[0.12, 0.1], [-0.12, 0.4], [0, 0.9]].map(([dx, y]) => at(s.girl, dx, y)), chase: [[0, 0.3], [0, 1.0]].map(([dx, y]) => at(s.pup, dx, y)) };
  });
  const b0 = await state();
  for (const [who, list] of Object.entries(spots)) for (const w of list) {
    const p = await screen(w);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(350);
    const b = await state();
    check(b.wrong === b0.wrong && b.answers === b0.answers && b.open, `a tap on ${who} at height ${w[1]} chose no blanket`);
  }
  await shot('after');
}

if (place === 'river') {
  await page.waitForTimeout(2500);
  const hidden = await st(() => {
    const s = window.__pup.getStage();
    const stone = s.tappables.find((o) => o.userData.num !== undefined);
    const g = s.girl.position;
    // a stone right behind her, the way level 7's layout once left one
    const tmp = stone.clone();
    tmp.position.set(g.x, 0.18, g.z - 0.9);
    tmp.userData = { num: 99, onTap: () => { window.__hit = 'stone'; } };
    s.scene.add(tmp);
    s.tappables.push(tmp);
    return [g.x, 0.25, g.z - 0.9];
  });
  await st(() => { window.__hit = null; });
  const p = await screen(hidden);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(300);
  check((await st(() => window.__hit)) === 'stone', 'a tap where a stone lies behind Zosia reaches the stone');
  await shot('after');
}
check(errors.length === 0, `no page errors (${errors.length})`);
await browser.close();
process.exit(bad ? 1 : 0);
