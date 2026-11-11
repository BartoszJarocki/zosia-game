// kid.mjs <mission> <level> <plan> : plays one mission the way a quick 3.5-year-old does, on the real GPU, with
// touch input and the graphics the iPad shows (verification tooling, written for the November review).
//   plan fast   answers right the moment an answer can be tapped, without waiting for the voice
//   plan mash   pokes everything quickly while the voice talks, then answers
//   plan polite waits for the voice to finish (the old walker's manners)
// env: BASE, OUTDIR, Q (graphics tier, default high), W, H (viewport), FILM=seconds between filmstrip frames (0 = none),
//   FINALE=1 makes the session's finale due first (play it with `lookout`)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [kind, levelArg = '1', plan = 'fast'] = process.argv.slice(2);
const level = Number(levelArg);
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const OUT = `${process.env.OUTDIR || 'out'}/${kind}-L${level}-${plan}${process.env.FINALE ? '-finale' : ''}/`;
mkdirSync(`${OUT}film`, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4190';
const FILM = Number(process.env.FILM ?? 3);

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: true, isMobile: false });
const page = await context.newPage();
const errors = [], consoleErrors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

await page.addInitScript(([kind, level]) => {
  const t0 = performance.now();
  const T = () => Math.round(performance.now() - t0);
  const log = (window.__timeline = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push({ t: T(), type: 'say', text }); return Array.prototype.push.call(say, text); };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => {
    if (!window.__celebrated && document.querySelector('.celebrate')) { window.__celebrated = T(); log.push({ t: T(), type: 'me', text: 'celebration' }); }
  }).observe(document.body, { childList: true, subtree: true }));
  const AC = window.AudioContext || window.webkitAudioContext;
  const buf = AC.prototype.createBufferSource;
  const mk = AC.prototype.createBuffer;
  AC.prototype.createBuffer = function (...a) { const b = mk.apply(this, a); b.__noise = true; return b; };
  AC.prototype.createBufferSource = function () {
    const s = buf.call(this);
    const start = s.start.bind(s), stop = s.stop.bind(s);
    s.start = (...a) => {
      const len = s.buffer ? Math.round(s.buffer.duration * 1000) : 0;
      if (!s.buffer?.__noise) { s.__rec = { t: T(), type: 'clip', ms: len }; log.push(s.__rec); }
      start(...a);
    };
    s.stop = (...a) => { if (s.__rec) { s.__rec.stoppedAt = T(); s.__rec.cut = T() - s.__rec.t < s.__rec.ms - 60; } stop(...a); };
    return s;
  };
  // frames per second, one sample a second
  const fps = (window.__fps = []);
  let n = 0, mark = performance.now();
  const frame = () => { n++; const now = performance.now(); if (now - mark >= 1000) { fps.push(Math.round(n * 1000 / (now - mark))); n = 0; mark = now; } requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { [kind]: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  window.__mark = (text) => log.push({ t: T(), type: 'me', text });
  window.__T = T;
}, [kind, level]);

await page.goto(`${BASE}/?q=${process.env.Q || 'high'}`);
const st = (fn, a) => page.evaluate(fn, a);
const mark = (text) => st((x) => window.__mark(x), text);
const now = () => st(() => window.__T());
let shot = 0;
const snap = async (name) => { try { await page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${name}.png`, scale: 'css', timeout: 8000 }); } catch { await mark(`(screenshot ${name} failed)`); } };
let film = 0, filming = FILM > 0;
(async () => { while (filming) { try { await page.screenshot({ path: `${OUT}film/${String(++film).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 55, scale: 'css', timeout: 5000 }); } catch {} await new Promise((r) => setTimeout(r, FILM * 1000)); } })();

const options = () => st((kind) => {
  const s = window.__pup.getStage(), cam = window.__pup.camera;
  const proj = (o, lift = 0) => { const p = o.getWorldPosition(o.position.clone()); p.y += lift; p.project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; };
  const out = [];
  if (kind === 'lookout') {
    document.querySelectorAll('.lift-btn').forEach((b) => { const r = b.getBoundingClientRect(); out.push({ label: b.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, right: Number(b.textContent) === s.last }); });
    return out;
  }
  for (const o of s.tappables || []) {
    const u = o.userData;
    if (!o.visible) continue;
    if (u.letter !== undefined && u.letter) out.push({ label: u.letter, ...proj(o, kind === 'delivery' && u.tapHeight === 1.9 ? 1.9 : 0.4), right: u.letter === s.last });
    else if (u.word) out.push({ label: u.word, ...proj(u.board, 0), right: u.word === s.last });
    else if (u.num !== undefined && (kind !== 'cones' || u.sign)) out.push({ label: String(u.num), ...proj(o, kind === 'cones' ? 2.7 : 0.3), right: u.num === s.last });
    else if (kind === 'picnic' && o.geometry?.type === 'BoxGeometry' && o.material?.visible === false) out.push({ label: o.position.x < 0 ? 'left' : 'right', ...proj(o, -0.4), right: null });
    else if (kind === 'counting' && u.drag) out.push({ label: 'bone', ...proj(o, 0.2), right: true });
    else if (kind === 'counting' && u.hungry !== undefined) out.push({ label: 'plate', ...proj(o, 0), right: u.hungry });
    else if (u.choice !== undefined) out.push({ label: String(u.choice), ...proj(o, u.tapHeight ?? 0.3), right: u.choice === s.last });
    else if (u.jumper) out.push({ label: 'Chase', ...proj(o, 0.8), right: null });
    else if (u.pebble) out.push({ label: 'pebble', ...proj(o, 0), right: null });
    else if (u.done) out.push({ label: 'done', ...proj(o, u.tapHeight ?? 0.5), right: null });
    else if (u.place) out.push({ label: u.place, ...proj(o, 0), right: u.place === s.last });
    else out.push({ label: 'other', ...proj(o, u.tapHeight ?? 0.5), right: null, other: true });
  }
  return out;
}, kind);

const tap = async (o, why) => { await mark(`TAP ${o.label} (${why}) at ${Math.round(o.x)},${Math.round(o.y)}`); await page.touchscreen.tap(Math.max(2, Math.min(W - 2, o.x)), Math.max(2, Math.min(H - 2, o.y))); };
const qState = () => st(() => { const s = window.__pup.getStage(); const q = s?.learn?.current; return { kind: s?.kind, open: Boolean(q), id: q ? `${q.skill}:${q.item}:${q.round}:${q.openedAt}` : null, skill: q?.skill, item: q?.item, round: s?.roundIndex, rounds: s?.rounds, speaking: Boolean(s?.speaking), celebrated: Boolean(window.__celebrated), t: window.__T(), bubble: document.querySelector('.bubble')?.innerText.replace(/\s+/g, ' ').trim() }; });
const waitFor = async (pred, ms, every = 100) => { const end = Date.now() + ms; for (;;) { const s = await qState(); if (pred(s)) return s; if (Date.now() > end) return null; await page.waitForTimeout(every); } };
const solved = (id) => (s) => s.celebrated || s.id !== id;

await mark('page loaded');
await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1200);
await snap('start-screen');
const pb = await page.locator('.play').boundingBox();
await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent; }, null, { timeout: 30000 });
await page.waitForTimeout(2500);
if (process.env.FINALE) await st(() => { const s = window.__pup.session(); s.missionsCompleted = s.targetMissions; });
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== kind; i++) { await st((k) => window.__pup.game.startMission(k), kind); await page.waitForTimeout(700); }
const tStart = await now();
await mark(`mission ${kind} L${level} started, plan ${plan}`);
await page.waitForTimeout(600);
await snap('mission-open');

const rounds = [];
const rand = (a, b) => a + Math.random() * (b - a);
for (let r = 0; r < 24; r++) {
  const s0 = await waitFor((s) => s.open || s.celebrated, 45000);
  if (!s0) { await mark('STUCK: no open question and no celebration for 45 s'); await snap(`r${r + 1}-stuck`); rounds.push({ r: r + 1, stuck: true }); break; }
  if (s0.celebrated) break;
  if (plan === 'polite') await waitFor((s) => !s.speaking || s.celebrated, 30000);
  const q = await qState();
  const rec = { r: r + 1, q: `${q.skill}:${q.item}`, bubble: q.bubble, tOpen: q.t, spokeWhenOpen: q.speaking, taps: 0, ignored: 0 };
  await mark(`QUESTION ${rec.q} bubble="${q.bubble}" speaking=${q.speaking}`);
  await page.waitForTimeout(350);
  await snap(`r${r + 1}-asked`);
  let opts = await options();
  await mark(`OPTIONS ${opts.map((o) => `${o.label}${o.right ? '*' : ''}@${Math.round(o.x)},${Math.round(o.y)}`).join(' ')}`);

  if (plan === 'mash') {
    // ten quick pokes: answers, other things, empty spots, the bubble, two fingers at once
    for (let i = 0; i < 10; i++) {
      const cur = await qState();
      if (cur.celebrated || cur.id !== q.id) break;
      const pool = (await options()).filter((o) => !o.right);
      const roll = Math.random();
      if (roll < 0.6 && pool.length) await tap(pool[Math.floor(Math.random() * pool.length)], 'mash');
      else if (roll < 0.8) await tap({ label: 'empty', x: rand(60, W - 60), y: rand(140, H - 60) }, 'mash');
      else if (roll < 0.9) await tap({ label: 'bubble', x: 300, y: 190 }, 'mash');
      else { // two fingers land together
        const a = { x: rand(200, W - 200), y: rand(250, H - 100) }, b = { x: a.x + 90, y: a.y + 40 };
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await mark(`TAP two fingers at ${Math.round(a.x)},${Math.round(a.y)}`);
      }
      await page.waitForTimeout(rand(110, 260));
    }
    await snap(`r${r + 1}-mashed`);
    await page.waitForTimeout(900);
  }

  // answer: keep doing the right thing until the question closes (a quick child taps again when nothing happens)
  const deadline = Date.now() + 60000;
  let last = null;
  while (Date.now() < deadline) {
    const cur = await qState();
    if (cur.celebrated || cur.id !== q.id) { last = cur; break; }
    opts = await options();
    const multi = (kind === 'counting' && opts.some((o) => o.label === 'bone')) || ((kind === 'moon' || kind === 'blackhole') && q.skill === 'counting') || (kind === 'lighthouse' && ['counting', 'sequence'].includes(q.skill)) || (kind === 'port' && q.item && !/^\d+$/.test(q.item));
    if (kind === 'picnic') {
      const [a, b] = opts.filter((o) => o.label === 'left' || o.label === 'right');
      if (!a) { await page.waitForTimeout(300); continue; }
      await tap(a, 'picnic left'); rec.taps++;
      if (!(await waitFor(solved(q.id), 1500))) { if (b) { await tap(b, 'picnic right'); rec.taps++; } await waitFor(solved(q.id), 2500); }
    } else if (kind === 'counting' && opts.some((o) => o.label === 'plate')) {
      const p = opts.find((o) => o.label === 'plate' && o.right);
      if (p) { await tap(p, 'hungry plate'); rec.taps++; }
      await page.waitForTimeout(500);
    } else if (multi) {
      const n = kind === 'port' ? (await st(() => window.__pup.getStage().target)) : Number(q.item);
      const label = { moon: 'Chase', blackhole: 'pebble', lighthouse: 'lamp', port: 'horn', counting: 'bone' }[kind];
      const count = () => st(() => { const s = window.__pup.getStage(); if (s.kind === 'lighthouse' || s.kind === 'port') return s.count; if (s.kind === 'counting') return s.given?.length ?? s.tray?.length ?? 0; return (s.prints || s.beads || []).length; });
      let made = kind === 'counting' ? 0 : await count();
      for (let i = 0; i < n * 4 && made < n; i++) {
        const o = (await options()).find((x) => x.label === label);
        if (!o) break;
        await tap(o, `${label} ${made + 1} of ${n}`); rec.taps++;
        await page.waitForTimeout(plan === 'polite' ? 1500 : 450);
        const after = kind === 'counting' ? made + 1 : await count(); // (Treat House keeps its count private: one tap, one treat)
        if (after === made) rec.ignored++;
        made = after;
        if (!(await qState()).open) break;
      }
      await page.waitForTimeout(900);
      if (!(await waitFor(solved(q.id), 600))) {
        const done = (await options()).find((x) => x.label === 'done') || (kind === 'counting' ? await st(() => { const s = window.__pup.getStage(); if (s.L.auto || !s.pup) return null; const p = s.pup.getWorldPosition(s.pup.position.clone()); p.y += 0.8; p.project(window.__pup.camera); return { label: 'done', x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; }) : null);
        if (done) { await tap(done, 'done'); rec.taps++; }
        await waitFor(solved(q.id), 4000);
      }
    } else {
      const right = opts.find((o) => o.right);
      if (!right) { await page.waitForTimeout(300); continue; }
      await tap(right, 'right'); rec.taps++;
      if (!rec.tFirstTap) rec.tFirstTap = await now();
      if (!(await waitFor(solved(q.id), 1200))) rec.ignored++;
    }
    if (!rec.tFirstTap) rec.tFirstTap = await now();
  }
  if (!last) { await mark('STUCK: the question did not close in 60 s of right answers'); await snap(`r${r + 1}-stuck`); rec.stuck = true; rounds.push(rec); break; }
  rec.tSolved = last.t;
  await page.waitForTimeout(500);
  await snap(`r${r + 1}-answered`);
  rounds.push(rec);
}
const done = await waitFor((s) => s.celebrated, 60000);
await page.waitForTimeout(2500);
await snap('end');
filming = false;
const tEnd = await now();
const timeline = await st(() => window.__timeline);
const events = await st(() => window.__pup.learning.recent(80));
const fps = await st(() => window.__fps);
const tier = await st(() => localStorage.getItem('pup-patrol-quality-v2'));
const celebratedAt = await st(() => window.__celebrated || null);
const savedLevel = await st((k) => JSON.parse(localStorage.getItem('pup-patrol-progress') || 'null')?.missions?.[k]?.level ?? null, kind);
// each round: when she could first answer, how long the game then took to ask the next thing
for (let i = 0; i < rounds.length; i++) { const a = rounds[i], b = rounds[i + 1]; a.answerMs = a.tSolved != null ? a.tSolved - a.tOpen : null; a.waitNextMs = a.tSolved != null ? ((b?.tOpen ?? celebratedAt ?? tEnd) - a.tSolved) : null; }
const sorted = [...fps].sort((x, y) => x - y);
const summary = {
  kind, level, savedLevel, plan, viewport: `${W}x${H}`, celebrated: Boolean(done), missionSeconds: celebratedAt ? Math.round((celebratedAt - tStart) / 100) / 10 : null,
  rounds, errors, consoleErrors: consoleErrors.slice(0, 10), fps: { min: sorted[0], median: sorted[sorted.length >> 1], n: fps.length }, tier,
  cutClips: timeline.filter((e) => e.type === 'clip' && e.cut).length, clips: timeline.filter((e) => e.type === 'clip').length,
  wrongEvents: events.filter((e) => !e.correct).map((e) => e.errorType).reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {}),
};
writeFileSync(`${OUT}summary.json`, JSON.stringify(summary, null, 1));
const lines = timeline.map((e) => {
  const t = (e.t / 1000).toFixed(1).padStart(6);
  if (e.type === 'say') return `${t}  SAY   ${e.text}`;
  if (e.type === 'me') return `${t}  ----  ${e.text}`;
  if (e.type === 'clip') return `${t}  clip  ${e.ms} ms${e.cut ? `  CUT OFF after ${e.stoppedAt - e.t} ms` : ''}`;
  return `${t}  ${e.type}`;
});
writeFileSync(`${OUT}transcript.txt`, lines.join('\n') + `\n\nerrors: ${JSON.stringify(errors)}\nconsole: ${JSON.stringify(consoleErrors.slice(0, 10))}\n`);
console.log(`${kind} L${level} ${plan}: ${done ? 'celebrated' : 'NO CELEBRATION'} in ${summary.missionSeconds}s, saved level ${savedLevel}, ${rounds.length} rounds, ignored taps ${rounds.reduce((n, x) => n + (x.ignored || 0), 0)}, stuck ${rounds.some((x) => x.stuck)}, errors ${errors.length}, fps median ${summary.fps.median}`);
await browser.close();
