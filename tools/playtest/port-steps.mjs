// port-steps.mjs : the Port's first-visit steps, played the way she would meet them, on the real GPU with touch input
// (verification tooling for the guided demo and the confirm line, docs/FIX-PLAN-2026-11-13.md unit FX4).
//   fresh save, Port level 2: the first boat is guided (Chase claps it), the next boat asks one thing; the confirm line
//   follows her first toot; a replay keeps her toot marks; a wrong count says no and keeps the boat; the next boat is clean.
// env: BASE, OUTDIR (default port-steps), SAVE=file (kid.mjs's save.json: a second visit, no demo), LEVEL (default 2), Q, W, H
// Writes <slug>.png per step, steps.txt (what was said, with the step names) and prints PASS or FAIL per check; exits 1 on a FAIL.
import { chromium } from 'playwright-core';
import { VERSION } from '../../src/progress/migrations.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;

const OUT = `${process.env.OUTDIR || 'port-steps'}/`;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4190';
const LEVEL = Number(process.env.LEVEL || 2), W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const resume = process.env.SAVE ? JSON.parse(readFileSync(process.env.SAVE, 'utf8')) : null;
const GOTOWE = 'Gotowe? Dotknij łódki!', ZATRAB = 'Zatrąb jej imię po kawałku!';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: false });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(([level, v, resume]) => {
  const t0 = performance.now();
  window.__sayLog = [];
  window.__said = [];
  window.__sayLog.push = (text) => { window.__said.push({ t: Math.round(performance.now() - t0), text }); return Array.prototype.push.call(window.__sayLog, text); };
  const fresh = { v, missions: { port: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } };
  const progress = resume ? { ...resume.progress, missions: { ...resume.progress.missions, port: { level, good: 0, lastAcc: 1 } } } : fresh;
  localStorage.setItem('pup-patrol-progress', JSON.stringify(progress));
  localStorage.setItem('pup-patrol-badges', JSON.stringify(resume?.badges || {}));
}, [LEVEL, VERSION, resume]);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const st = (fn, a) => page.evaluate(fn, a);
const shot = (slug) => page.screenshot({ path: `${OUT}${slug}.png`, scale: 'css' });
const sleep = (ms) => page.waitForTimeout(ms);
const log = [];
const mark = (text) => log.push(text);

/** What the scene holds now: step, count, her marks (dots on the board, lit pieces), the boat and the question. */
const state = () => st(() => {
  const s = window.__pup.getStage(), board = s.boats?.[0]?.userData.board;
  const lit = board ? board.userData.blocks.filter((b) => b.material.emissiveIntensity > 0.5).length : 0;
  return {
    step: s.step, phase: s.phase, mode: s.mode, count: s.count, target: s.target, word: s.word, speaking: Boolean(s.speaking),
    dots: board ? board.userData.dots.children.length : 0, lit, split: Boolean(board?.userData.split), boat: s.boats?.[0]?.userData.boatName ?? null,
    open: Boolean(s.learn.current), q: s.learn.current ? `${s.learn.current.item}:${s.learn.current.openedAt}` : null, round: s.roundIndex,
    celebrated: Boolean(document.querySelector('.celebrate')), said: window.__said.length,
  };
});
const said = (from = 0) => st((from) => window.__said.slice(from).map((x) => x.text), from);
const waitFor = async (pred, ms = 25000) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(100)) { const s = await state(); if (pred(s)) return s; } return null; };
const where = (what) => st((what) => {
  const s = window.__pup.getStage(), o = what === 'horn' ? s.horn : s.boats[0];
  const p = o.getWorldPosition(o.position.clone()); p.y += o.userData.tapHeight ?? 0.5; p.project(window.__pup.camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}, what);
const tapAt = async (p) => { await page.touchscreen.tap(Math.max(2, Math.min(W - 2, p.x)), Math.max(2, Math.min(H - 2, p.y))); };
const tap = async (what) => { mark(`tap ${what}`); await tapAt(await where(what)); };
const toot = async (n, gap = 450) => { for (let i = 0; i < n; i++) { await tap('horn'); await sleep(gap); } };
const bubbleTap = async () => { const b = await page.locator('.bubble .spk').boundingBox(); mark('tap the speaker in the bubble'); await tapAt({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); };

await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
await page.waitForSelector('.play', { timeout: 30000 });
await sleep(1200);
const pb = await page.locator('.play').boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
await sleep(2500);
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== 'port'; i++) { await st(() => window.__pup.game.startMission('port')); await sleep(700); }
const demoSeenBefore = await st(() => JSON.parse(localStorage.getItem('pup-patrol-progress')).demos?.includes('port.together') ?? false);
mark(`mission port L${LEVEL} started, demo seen before: ${demoSeenBefore}`);

// ---- boat 1: guided on a fresh save, one question first
const first = await waitFor((s) => s.open && s.phase === 'asking');
const guided = first.mode === 'together';
check(demoSeenBefore ? 'second visit: the first boat is not guided' : 'fresh save: the first boat is guided', guided === !demoSeenBefore, `mode ${first.mode}`);
if (guided) {
  const clap = await waitFor((s) => s.split);
  await shot('port-demo');
  check('the guided boat shows its pieces on the board while Chase claps', Boolean(clap));
}
await waitFor((s) => s.step === 'toot' && !s.speaking);
const asked = await said();
const upToFirst = asked.slice(asked.findIndex((l) => l.startsWith('W porcie')) + 1);
mark(`said before her first toot: ${JSON.stringify(upToFirst)}`);
check('the first boat asks one thing before her first toot (and does not yet say the confirm)', upToFirst.filter((l) => l.includes(ZATRAB)).length === 1 && !upToFirst.some((l) => l.includes(GOTOWE)), JSON.stringify(upToFirst));
await shot('port-first');
check(guided ? 'the guided boat has Chase clap its name, no name line' : 'the plain first boat says its name, then the one thing', guided ? !upToFirst.some((l) => l.startsWith('Ta łódka nazywa się')) : upToFirst.some((l) => l.startsWith('Ta łódka nazywa się') && l.endsWith(ZATRAB)), JSON.stringify(upToFirst));
const afterAsk = (await state()).said;
await toot(1);
const t1 = await state();
check('one toot is counted, and the confirm is not said at once', t1.count === 1 && !(await said(afterAsk)).includes(GOTOWE));
await sleep(2800);
const sayings = await said(afterAsk);
mark(`said after her first toot: ${JSON.stringify(sayings)}`);
check('the confirm line follows her first toot, whatever the count', sayings.includes(GOTOWE), `count ${t1.count} of ${t1.target}`);
await shot('port-confirm');
// finish boat 1 with the right count
let s1 = await state();
await toot(Math.max(0, s1.target - s1.count));
await sleep(400);
await tap('boat');
const second = await waitFor((s) => s.round === 1 && s.open && s.phase === 'asking' && s.step === 'toot', 30000);
check('boat 1 solved, boat 2 opens', Boolean(second));
if (!second) { await shot('stuck'); await browser.close(); process.exit(1); }

// ---- boat 2: a plain boat asks one thing, starts clean
for (let i = 0; i < 100 && !(await said(second.said)).some((l) => l.startsWith('Ta łódka nazywa się')); i++) await sleep(100);
const tail = (await said(second.said)).filter((l) => !l.startsWith('Foka!') && !l.includes('Brawo'));
check('boat 2 is a plain boat: its name and one thing to do, in one go', second.mode === 'alone' && tail.length === 1 && tail[0].startsWith('Ta łódka nazywa się') && tail[0].endsWith(ZATRAB) && !tail[0].includes(GOTOWE), JSON.stringify(tail));
check('boat 2 starts clean: no toots, no marks, no confirm yet', second.count === 0 && second.dots === 0 && second.lit === 0);
await waitFor((s) => !s.speaking);
await shot('port-next');

// ---- a wrong count: no, the same boat, clean marks, and she toots again
const before = await state();
const wrongCount = before.target > 1 ? before.target - 1 : before.target + 1;
const boatName = before.boat, from = before.said;
await toot(wrongCount);
await tap('boat');
await waitFor((s) => s.count === 0 && s.phase === 'asking' && s.said > from);
await sleep(300);
const afterWrong = await state();
const wrongSaid = await said(from);
mark(`said after the wrong count: ${JSON.stringify(wrongSaid)}`);
check('a wrong count says no', wrongSaid.some((l) => l.startsWith('Za mało!') || l.startsWith('Za dużo!')), JSON.stringify(wrongSaid.slice(0, 2)));
check('it keeps the boat and clears her marks', afterWrong.boat === boatName && afterWrong.count === 0 && afterWrong.dots === 0 && afterWrong.open, `${afterWrong.boat}, dots ${afterWrong.dots}`);
await shot('port-wrong-count');

// ---- her toot marks stay through a replay of the question
await waitFor((s) => !s.speaking);
await toot(2);
const marks = await state();
const fromReplay = marks.said;
await bubbleTap();
await sleep(1200);
const afterReplay = await state();
const replaySaid = await said(fromReplay);
mark(`said at the replay: ${JSON.stringify(replaySaid)}`);
check('the replay says the question again', replaySaid.some((l) => l.includes(ZATRAB)), JSON.stringify(replaySaid));
check('both toot marks stay through the replay', afterReplay.count === 2 && (afterReplay.dots === 2 || afterReplay.lit === 2), `count ${afterReplay.count}, dots ${afterReplay.dots}, lit ${afterReplay.lit}`);
await shot('port-replay');

// ---- finish the boat, and the third boat is clean too
const left = await state();
if (left.count !== left.target) {
  if (left.count > left.target) { await tap('boat'); await waitFor((s) => s.count === 0 && s.phase === 'asking'); await sleep(300); await toot(left.target); }
  else await toot(left.target - left.count);
}
await sleep(400);
await tap('boat');
const third = await waitFor((s) => s.round === 2 && s.open && s.phase === 'asking' && s.step === 'toot', 30000);
check('boat 2 solved, boat 3 starts clean', Boolean(third) && third.count === 0 && third.dots === 0 && third.lit === 0);
await shot('port-next-2');

const progress = await st(() => JSON.parse(localStorage.getItem('pup-patrol-progress')));
check('the save remembers the demo', progress.demos?.includes('port.together') === true, JSON.stringify(progress.demos));
writeFileSync(`${OUT}steps.txt`, log.join('\n') + '\n\nsaid:\n' + (await st(() => window.__said.map((x) => `${String(x.t).padStart(7)}  ${x.text}`).join('\n'))) + '\n');
writeFileSync(`${OUT}save.json`, JSON.stringify({ progress, badges: await st(() => JSON.parse(localStorage.getItem('pup-patrol-badges') || '{}')) }));
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
