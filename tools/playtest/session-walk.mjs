// session-walk.mjs : one sitting by touch on the real GPU (verification tooling, written for unit B5).
//   part 1  the start screen, the two missions the island suggests, the Lookout finale and the thanks
//   part 2  a long break, then a tired spell: "Jeszcze tylko jedno!", "again" on the celebration (said only once),
//           the goodnight, a sleepy Chase, and a tap on a place that wakes him into a new session
// Two things are steered so a script can play them: the hub's suggestion (the director's dev.suggestOnce, so the
// player knows the mission) and the tired spell (five tired answers added to the session's history, so the real
// score winds it down). Everything else is taps on what she sees. env: BASE, OUTDIR, W, H, Q
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const ROOT = `${process.env.OUTDIR || 'walk'}/session-walk/`;
const PART = [`${ROOT}part1/`, `${ROOT}part2/`];
for (const d of PART) mkdirSync(d, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4190';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: true });
const page = await context.newPage();
const errors = [], notes = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  const t0 = performance.now();
  const said = (window.__said = []);
  const log = (window.__sayLog = []);
  log.push = (text) => { said.push(`${((performance.now() - t0) / 1000).toFixed(1).padStart(6)}  ${text}`); return Array.prototype.push.call(log, text); };
  window.__T = () => (performance.now() - t0) / 1000;
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: {}, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
});
const st = (fn, a) => page.evaluate(fn, a);
const T = () => st(() => window.__T());
let part = 0, n = 0;
const snap = async (label) => { try { await page.screenshot({ path: `${PART[part]}${String(++n).padStart(2, '0')}-${label}.png`, scale: 'css', timeout: 8000 }); } catch {} };
const note = async (text) => { const line = `${(await T()).toFixed(1).padStart(6)}  ${text}`; notes.push(line); console.log(line); };
const tap = (p) => page.touchscreen.tap(Math.max(2, Math.min(W - 2, p.x)), Math.max(2, Math.min(H - 2, p.y)));
const heard = async (from) => (await st(() => window.__said)).slice(from).map((l) => l.trim().replace(/^\S+\s+/, '')).join(' | ');
const saidCount = () => st(() => window.__said.length);
const stage = () => st(() => { const s = window.__pup.getStage(); return { ctor: s?.constructor?.name, kind: s?.kind, busy: Boolean(s?.busy), asleep: Boolean(s?.asleep), night: Boolean(s?.night), suggested: s?.suggested, rounds: s?.rounds, open: Boolean(s?.learn?.current), q: s?.learn?.current ? `${s.learn.current.item}@${s.learn.current.openedAt}` : null, celebrated: Boolean(document.querySelector('.celebrate')) }; });
const until = async (pred, ms = 60000, every = 150) => { const end = Date.now() + ms; for (;;) { const s = await stage(); if (pred(s)) return s; if (Date.now() > end) return null; await page.waitForTimeout(every); } };
const session = () => st(() => { const s = window.__pup.session(); return { id: s.id, completed: [...s.completed], endedEarly: s.endedEarly, finaleDone: s.finaleDone }; });
const sessions = () => st(() => JSON.parse(localStorage.getItem('pup-patrol-progress')).sessions.count);
const project = (expr) => st(new Function('arg', `const { getStage, camera } = window.__pup; const s = getStage(); const o = (${expr})(s); if (!o) return null; const p = o.getWorldPosition(o.position.clone()); p.y += (o.userData.tapHeight ?? 0.3); p.project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };`));
const marker = (kind) => st((kind) => { const { getStage, camera } = window.__pup; const m = getStage().markers?.[kind]?.marker; if (!m) return null; const p = m.getWorldPosition(m.position.clone()); p.project(camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }, kind);
const suggestNext = (kind) => st((k) => { window.__pup.dev.suggestOnce = k; }, kind);

/** Where the right answer is on screen: a Kitty Park block, a Cone Road sign or a lift button. */
const rightAnswer = () => st(() => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  if (s.kind === 'lookout') {
    const b = [...document.querySelectorAll('.lift-btn')].find((x) => Number(x.dataset.floor) === s.last);
    const r = b?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  }
  const o = s.tappables.find((x) => x.visible && (s.kind === 'letters' ? x.userData.letter === s.last : x.userData.sign && x.userData.num === s.last));
  if (!o) return null;
  const p = o.getWorldPosition(o.position.clone());
  p.y += s.kind === 'cones' ? 2.7 : 0.4;
  p.project(cam);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
});

/** She taps the place's star on the island and the mission opens (a second tap if the first one was lost). */
async function goTo(kind) {
  for (let i = 0; i < 3; i++) {
    const m = await marker(kind);
    if (m) await tap(m);
    if (await until((s) => s.kind === kind, 12000)) return true;
  }
  return false;
}

/** Plays the open mission quickly and right, up to its celebration. Returns the rounds it had at the start and end. */
async function play(label) {
  const start = await until((s) => s.open && !s.celebrated, 45000); // (after "again" the old celebration is still up)
  const rounds = [start?.rounds];
  await snap(`${label}-asked`);
  for (let i = 0; i < 40; i++) {
    const s = await until((x) => x.open || x.celebrated, 45000);
    if (!s || s.celebrated) break;
    const p = await rightAnswer();
    if (!p) { await page.waitForTimeout(300); continue; }
    await page.waitForTimeout(400);
    await tap(p);
    await until((x) => x.q !== s.q || x.celebrated, 5000);
  }
  const end = await until((s) => s.celebrated, 60000);
  rounds.push((await stage()).rounds);
  await page.waitForTimeout(1500);
  await snap(`${label}-celebration`);
  return { celebrated: Boolean(end), rounds };
}

async function press(button) {
  await page.waitForTimeout(3000);
  const b = await page.locator(`.celebrate .${button}`).boundingBox();
  await tap({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
}

async function backOnIsland(label) {
  const from = await saidCount();
  await until((s) => s.ctor === 'Hub' && !s.celebrated, 20000);
  await page.waitForTimeout(5000);
  await snap(label);
  return heard(from);
}

await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
await page.waitForSelector('.start .play', { timeout: 90000 }); // (slow when the GPU is shared)
await page.waitForTimeout(1500);
await snap('start-screen');
await suggestNext('letters');
const pb = await page.locator('.play').boundingBox();
await tap({ x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 });
await until((s) => s.ctor === 'Hub' && !s.busy && s.suggested, 30000);
await page.waitForTimeout(4000);
await snap('island-invites');
await note(`the island greets her and suggests ${(await stage()).suggested}: ${await heard(0)}`);
const first = await session();

for (const [i, kind, next] of [[1, 'letters', 'cones'], [2, 'cones', null]]) {
  await note(`she taps the glowing star: ${kind} opens ${await goTo(kind)}`);
  const r = await play(`m${i}-${kind}`);
  await note(`${kind}: celebrated ${r.celebrated}, rounds ${r.rounds.join(' -> ')}`);
  if (next) await suggestNext(next);
  await press('home');
  await note(`back on the island it says: ${await backOnIsland(`island-after-m${i}`)}`);
}
await note(`the island now suggests: ${(await stage()).suggested}`);
await note(`the finale: lookout opens ${await goTo('lookout')}`);
const fin = await play('m3-lookout-finale');
await note(`lookout finale: celebrated ${fin.celebrated}`);
await press('home');
await note(`back on the island it says: ${await backOnIsland('island-thanks')}`);
const s1 = await session();
await note(`session 1: ${JSON.stringify(s1)}; sessions saved: ${await sessions()}`);

part = 1; n = 0;
await st(() => { window.__pup.session().lastActiveAt -= 16 * 60 * 1000; });
const s2 = await session();
await note(`a long break (the walk moves the session's last answer 16 min back): a new session ${s2.id !== s1.id}`);
await st(() => {
  const s = window.__pup.session();
  for (let i = 0; i < 5; i++) s.recentQuestions.push({ mission: 'cones', wrongChoice: 0, overTap: 2, timeout: 1, missTap: 0, replays: 1, latencyMs: 20000, assist: 3 });
});
await note('the walk adds five tired answers to the new session (as after a distracted spell)');
await note(`she taps Cone Road: opens ${await goTo('cones')}`);
let from = await saidCount();
const tired = await play('m4-cones-tired');
await note(`cones while tired: rounds ${tired.rounds.join(' -> ')}; she heard "${(await heard(from)).includes('Jeszcze tylko jedno') ? 'Jeszcze tylko jedno!' : 'no one-more'}"`);
from = await saidCount();
await press('again');
await note('she taps "again" on the celebration');
const again = await play('m5-cones-again');
await note(`cones again: rounds ${again.rounds.join(' -> ')}; "Jeszcze tylko jedno" said again: ${(await heard(from)).includes('Jeszcze tylko jedno')}`);
await press('home');
from = await saidCount();
await until((s) => s.ctor === 'Hub' && s.night, 20000);
const tg = await T();
await page.waitForTimeout(3500);
await snap('goodnight-dusk');
await until((s) => s.asleep, 60000);
await note(`the goodnight (${((await T()) - tg).toFixed(1)} s): ${await heard(from)}`);
await page.waitForTimeout(1500);
await snap('island-asleep');
from = await saidCount();
await tap(await project('(s) => s.pup'));
await page.waitForTimeout(2500);
await note(`she taps sleeping Chase: ${await heard(from)}; the island is still asleep ${(await stage()).asleep}`);
from = await saidCount();
const tw = await T();
await tap(await marker('letters'));
await page.waitForTimeout(250);
await note(`250 ms after her tap on Kitty Park's star: Chase's eyes open (drowsy ${(await st(() => window.__pup.getStage().drowsy)).toFixed(2)}, 1 = asleep)`);
await page.waitForTimeout(500);
await snap('waking');
const woke = await until((s) => s.kind === 'letters', 20000);
const s3 = await session();
await note(`${((await T()) - tw).toFixed(1)} s after the tap: Kitty Park open ${Boolean(woke)}; she heard: ${await heard(from)}; a new session ${s3.id !== s2.id}; night tint gone ${!(await st(() => document.getElementById('game').classList.contains('night')))}`);
const last = await play('m6-letters-new-session');
await note(`letters in the new session: celebrated ${last.celebrated}`);
await press('home');
const awake = await backOnIsland('island-awake');
await note(`back on the island it says: ${awake}; it suggests ${(await stage()).suggested}; asleep ${(await stage()).asleep}; sessions saved: ${await sessions()} (session 1 counted at its first mission: ${first.id === s1.id})`);

writeFileSync(`${ROOT}notes.txt`, [...notes, '', 'SAID:', ...(await st(() => window.__said)), '', `errors: ${JSON.stringify(errors)}`].join('\n'));
console.log(`errors: ${JSON.stringify(errors)}`);
await browser.close();
