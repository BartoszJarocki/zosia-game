// Probes for the number missions (River, Cone Road, Pup Picnic): the things walk.mjs does not look at.
// usage: node numbers-probe.mjs <probe> <level>   (BASE and OUTDIR as for walk.mjs; ASSIST=1 seeds a rough last run,
//        PORTRAIT=1 holds the iPad upright)
//   cones-count   tap the right cone, then a picture of its sign each time a dot is counted aloud
//   river-gentle  the river a gentler run lays out (run it with ASSIST=1)
//   picnic-clue   wait for the clue like a child who thinks, picture both blankets, then tap the row that is
//                 longer / shorter / the same as Chase's, judged only from where the treats lie, and log the answer
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [probe, levelArg] = process.argv.slice(2);
const level = Number(levelArg || 1);
const kind = probe.split('-')[0] === 'river' ? 'stones' : probe.split('-')[0];
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/probe-${probe}-L${level}${process.env.ASSIST ? '-gentle' : ''}${process.env.PORTRAIT ? '-portrait' : ''}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:4173';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: process.env.PORTRAIT ? { width: 820, height: 1180 } : { width: 1180, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(([kind, level, lastAcc, slow]) => {
  // speech at 1/__slow speed, so a slow software renderer can picture every counted dot (the game waits for each clip)
  const AC = window.AudioContext || window.webkitAudioContext, make = AC.prototype.createBufferSource;
  window.__slow = slow;
  AC.prototype.createBufferSource = function () { const s = make.call(this); s.playbackRate.value = 1 / window.__slow; return s; };
  const t0 = performance.now();
  const log = (window.__timeline = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push({ t: Math.round(performance.now() - t0), type: 'say', text }); return Array.prototype.push.call(say, text); };
  window.__mark = (text) => log.push({ t: Math.round(performance.now() - t0), type: 'me', text });
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { [kind]: { level, good: 0, lastAcc } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, [kind, level, process.env.ASSIST ? 0.2 : 1, 1]);

const st = (fn, a) => page.evaluate(fn, a);
const mark = (text) => st((x) => window.__mark(x), text);
let shot = 0;
const snap = async (name, clip) => {
  const path = `${OUT}${String(++shot).padStart(2, '0')}-${name}.png`;
  for (let i = 0; i < 3; i++) { try { await page.screenshot({ path, clip, timeout: 8000 }); return; } catch { await page.waitForTimeout(300); } }
};
const said = () => st(() => window.__sayLog.length);
const saidSince = (n) => st((n) => window.__sayLog.slice(n), n);
const waitAsked = (ms = 40000) => page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.learn?.isOpen && !s.speaking && (s.learn.current.promptEndAt !== null || performance.now() - s.learn.current.openedAt > 1500); }, null, { timeout: ms }).then(() => true, () => false);
const lastEvent = () => st(() => { const e = window.__pup.learning.recent(1)[0]; return e && { item: e.item, correct: e.correct, assist: e.assistLevel }; });
/** Screen point of a world position. */
const screen = (p) => st((p) => { const v = new window.__pup.camera.position.constructor(p.x, p.y, p.z).project(window.__pup.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; }, p);

// like a parent: the start paw (sound on), then the place
await page.goto(`${BASE}/?q=low`);
await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1500);
const pb = await page.locator('.play').boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => window.__pup.getStage()?.markers, null, { timeout: 30000 });
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== kind; i++) { await st((k) => window.__pup.game.startMission(k), kind); await page.waitForTimeout(700); }
await mark(`mission ${kind} started`);
const result = { probe, level, settings: await st(() => window.__pup.getStage().L) };

if (probe === 'cones-count') {
  await waitAsked();
  const right = await st(() => {
    const s = window.__pup.getStage(), cam = window.__pup.camera;
    const c = s.tappables.find((o) => o.userData.sign && o.userData.num === s.last);
    const p = c.userData.sign.getWorldPosition(c.position.clone()); p.project(cam);
    return { num: c.userData.num, x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
  });
  const clip = { x: Math.max(0, right.x - 170), y: Math.max(0, right.y - 110), width: 340, height: 340 };
  await snap('asked');
  const from = await said();
  await st(() => (window.__slow = 30)); // a screenshot takes 7–15 s here: hold each counted number long enough for one
  await mark(`TAP ${right.num} (right)`);
  await page.mouse.click(right.x, right.y);
  // a picture each time a new line starts: "Brawo!", "Jeden!", "Dwa!"… and the total
  const lines = [];
  for (const until = Date.now() + 300000; Date.now() < until && lines.length < right.num + 2;) {
    const now = await saidSince(from);
    if (now.length > lines.length) { lines.push(now[lines.length]); await mark(`snap ${lines.at(-1)}`); await snap(`count-${lines.length}-${lines.at(-1).replace(/[^\p{L}\d]+/gu, '')}`, clip); await mark('snapped'); }
    else await page.waitForTimeout(100);
  }
  result.count = lines;
}

if (probe === 'river-gentle') {
  for (let q = 0; q < 2; q++) {
    await waitAsked();
    const opts = await st(() => window.__pup.getStage().tappables.filter((o) => o.userData.num !== undefined).map((o) => o.userData.num));
    const bubble = await st(() => document.querySelector('.bubble')?.innerText.replace(/\s+/g, ' ').trim());
    await snap(`q${q + 1}-asked`);
    (result.questions ||= []).push({ bubble, stones: opts });
    const right = await st(() => { const s = window.__pup.getStage(), o = s.tappables.find((t) => t.userData.num === s.last && !t.userData.gone), p = o.getWorldPosition(o.position.clone()); p.y += 0.3; p.project(window.__pup.camera); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; });
    await page.mouse.click(right.x, right.y);
    await page.waitForTimeout(1500);
  }
}

if (probe === 'picnic-clue') {
  for (let r = 0; r < 8; r++) {
    if (!(await waitAsked())) break;
    const from = await said();
    const mode = await st(() => { const s = window.__pup.getStage(); return s.L.modes[s.roundIndex % s.L.modes.length]; });
    await mark(`ROUND ${r + 1} ${mode}`);
    await snap(`r${r + 1}-asked`);
    // she thinks: the clue comes by itself after ~17 s of quiet
    await page.waitForFunction((n) => window.__sayLog.slice(n).some((l) => /Popatrz uważnie/.test(l)), from, { timeout: 40000 }).catch(() => mark('no clue within 40 s'));
    await page.waitForTimeout(1500);
    await snap(`r${r + 1}-clue`);
    // what she sees: treats (or numeral cards) on the left blanket, the right blanket, and Chase's plate
    const seen = await st(() => {
      const s = window.__pup.getStage(), out = { left: [], right: [], plate: [] };
      s.scene.traverse((o) => {
        if (!o.userData.treat || !o.parent || o.scale.x < 0.5) return;
        const p = o.getWorldPosition(o.position.clone());
        out[p.z < -1.2 ? 'plate' : p.x < 0 ? 'left' : 'right'].push({ x: p.x, y: p.y, z: p.z, num: o.userData.num ?? 1 }); // (the plate is behind the blankets)
      });
      return out;
    });
    const amount = (side) => seen[side].reduce((a, o) => a + o.num, 0);
    const [l, rr, plate] = [amount('left'), amount('right'), amount('plate')];
    const pickLeft = mode === 'more' ? l > rr : mode === 'less' ? l < rr : l === plate;
    const side = pickLeft ? 'left' : 'right';
    const row = seen[side];
    const mid = row.reduce((a, o) => ({ x: a.x + o.x / row.length, y: a.y + o.y / row.length, z: a.z + o.z / row.length }), { x: 0, y: 0, z: 0 });
    const at = await screen(mid);
    await mark(`SEE left ${l} right ${rr}${mode === 'same' ? ` plate ${plate}` : ''}: tap the ${side} row at ${Math.round(at.x)},${Math.round(at.y)}`);
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(600);
    const ev = await lastEvent();
    await mark(`ANSWER ${ev?.correct ? 'right' : 'WRONG'} (${ev?.item}, help ${ev?.assist})`);
    (result.rounds ||= []).push({ mode, left: l, right: rr, plate: mode === 'same' ? plate : undefined, tapped: side, correct: !!ev?.correct });
    if (!ev?.correct) break;
    await page.waitForTimeout(1500);
  }
}

result.said = await st(() => window.__sayLog);
result.timeline = await st(() => window.__timeline.map((e) => `${(e.t / 1000).toFixed(1)} ${e.type === 'say' ? 'SAY ' : ''}${e.text}`));
result.errors = errors;
writeFileSync(`${OUT}result.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ ...result, said: undefined, timeline: undefined }, null, 1));
await browser.close();
