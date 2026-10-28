// Plays the Lookout with real clicks at any screen size: taps the die when it waits, presses the right floor,
// screenshots each step and writes what was said. "finale" first makes the session's finale due (as after two missions).
// usage: BASE=http://127.0.0.1:4193 OUTDIR=… node lookout-play.mjs <level> [width height] [finale]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const args = process.argv.slice(2);
const finale = args.includes('finale');
const [level = 1, w = 1180, h = 820] = args.filter((a) => a !== 'finale').map(Number);
const name = `play-L${level}-${w}x${h}${finale ? '-finale' : ''}`;
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/${name}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:4193';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((level) => {
  const t0 = performance.now();
  const log = (window.__timeline = []);
  const say = (window.__sayLog = []);
  say.push = (text) => { log.push({ t: Math.round(performance.now() - t0), text }); return Array.prototype.push.call(say, text); };
  window.__mark = (text) => log.push({ t: Math.round(performance.now() - t0), text: `---- ${text}` });
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { lookout: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
}, level);
await page.goto(`${BASE}/?q=low`);
const st = (fn, a) => page.evaluate(fn, a);
const mark = (t) => st((x) => window.__mark(x), t);
let shot = 0;
const snap = async (n) => { try { await page.screenshot({ path: `${OUT}${String(++shot).padStart(2, '0')}-${n}.png`, timeout: 10000 }); } catch { await mark(`(screenshot ${n} failed)`); } };

await page.waitForSelector('.play', { timeout: 30000 });
await page.waitForTimeout(1500);
const pb = await page.locator('.play').boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
await page.waitForFunction(() => window.__pup.getStage()?.markers, null, { timeout: 30000 });
if (finale) await st(() => { const s = window.__pup.session(); s.missionsCompleted = s.targetMissions; });
for (let i = 0; i < 20 && (await st(() => window.__pup.getStage()?.kind)) !== 'lookout'; i++) { await st(() => window.__pup.game.startMission('lookout')); await page.waitForTimeout(700); }
await mark(`lookout L${level} ${w}x${h}${finale ? ' (finale due)' : ''}: finale=${await st(() => window.__pup.getStage().finale)} mode=${await st(() => window.__pup.getStage().L.mode)}`);

const dieWaits = () => st(() => { const s = window.__pup.getStage(); return !!s.die && s.tappables.includes(s.die); });
const asked = () => st(() => { const s = window.__pup.getStage(); return s.learn?.isOpen && !s.speaking; });
for (let r = 1; r <= 3; r++) {
  // wait for the die (dice rides) or the question
  const ok = await page.waitForFunction(() => { const s = window.__pup.getStage(); return s.kind !== 'lookout' || (s.die && s.tappables.includes(s.die)) || (s.learn?.isOpen && !s.speaking); }, null, { timeout: 60000 }).then(() => true, () => false);
  if (!ok || (await st(() => window.__pup.getStage().kind)) !== 'lookout') break;
  if (await dieWaits()) {
    await page.waitForTimeout(1200);
    await snap(`r${r}-die-waits`);
    const p = await st(() => { const s = window.__pup.getStage(), v = s.die.getWorldPosition(s.die.position.clone()).project(window.__pup.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; });
    await mark(`TAP the die at ${Math.round(p.x)},${Math.round(p.y)}`);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => { const s = window.__pup.getStage(); return s.learn?.isOpen && !s.speaking; }, null, { timeout: 60000 });
  }
  if (!(await asked())) break;
  await page.waitForTimeout(1500); // (the bubble's pop-in finishes)
  const q = await st(() => { const s = window.__pup.getStage(); return { target: s.last, floor: s.floor, skill: s.learn.current.skill, kittens: s.kittens.length, bubble: document.querySelector('.bubble')?.innerText.replace(/\s+/g, ' ').trim() }; });
  await mark(`QUESTION r${r} ${q.skill}:${q.target} from floor ${q.floor} bubble="${q.bubble}"`);
  await snap(`r${r}-asked`);
  const b = await st((t) => { const e = document.querySelector(`.lift-btn[data-floor="${t}"]`).getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2, size: Math.round(e.width) }; }, q.target);
  await mark(`TAP floor ${q.target} (button ${b.size} px)`);
  await page.mouse.click(b.x, b.y);
  await page.waitForFunction((n) => window.__pup.getStage().kittens?.length > n || window.__pup.getStage().kind !== 'lookout', q.kittens, { timeout: 90000 });
  await snap(`r${r}-kitten-in`);
}
await page.waitForSelector('.celebrate', { timeout: 120000 }).then(() => mark('celebration'), () => mark('no celebration'));
await page.waitForTimeout(3000);
await snap('end');
const tl = await st(() => window.__timeline);
writeFileSync(`${OUT}transcript.txt`, tl.map((e) => `${(e.t / 1000).toFixed(1).padStart(6)}  ${e.text}`).join('\n') + `\n\nerrors: ${JSON.stringify(errors)}\n`);
console.log(`${name}: ${tl.filter((e) => !e.text.startsWith('----')).length} lines said, ${errors.length} errors → ${OUT}`);
await browser.close();
