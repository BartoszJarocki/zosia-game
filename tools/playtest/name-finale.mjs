// Name Train finale: load a word quickly (right taps only), then screenshot the syllables as they are clapped
// and log what is said. usage: BASE=http://127.0.0.1:4173 node name-finale.mjs [level] [WORD] [landscape|portrait]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const [levelArg = '1', word = 'ZOSIA', screen = 'landscape'] = process.argv.slice(2);
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/name-finale-${word}-${screen}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: screen === 'portrait' ? { width: 820, height: 1180 } : { width: 1180, height: 820 } });
await page.addInitScript((level) => {
  localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { name: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } }));
  const t0 = performance.now();
  window.__sayLog = [];
  window.__sayLog.push = (text) => Array.prototype.push.call(window.__sayLog, `${((performance.now() - t0) / 1000).toFixed(1)}  ${text}`);
  // headless Chromium has no voices, so unrecorded lines would end at once: give each 1.5 s (slow, so the
  // screenshots can keep up)
  speechSynthesis.speak = (u) => setTimeout(() => u.onend?.(), 1500);
  // every bubble the finale shows, green letters in [brackets]
  window.__bubbles = [];
  setInterval(() => {
    const w = document.querySelector('.bubble .word');
    const text = w ? [...w.children].map((b) => (b.className === 'done' ? `[${b.textContent}]` : b.textContent)).join('').replace(/\]\[/g, '').replace(/\u00a0/g, ' ') : '';
    if (text && text !== window.__bubbles.at(-1)) window.__bubbles.push(text);
  }, 50);
}, Number(levelArg));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:4173'}/?q=low#name`);
await page.waitForFunction(() => window.__pup?.getStage()?.kind === 'name', null, { timeout: 40000 });
await page.evaluate((w) => { window.__pup.getStage().L.words = [w]; return window.__pup.game.startMission('name'); }, word);
await page.waitForFunction((w) => window.__pup.getStage()?.word === w, word, { timeout: 40000 });
// tap the right block each time a question is open, until the train is loaded
for (let i = 0; i < 12; i++) {
  const left = await page.waitForFunction(() => { const s = window.__pup.getStage(); return s.learn?.isOpen || s.open?.().length === 0 ? (s.open().length) + 1 : false; }, null, { timeout: 60000 }).then((h) => h.jsonValue());
  if (left === 1) break;
  await page.evaluate(() => { const s = window.__pup.getStage(); const b = s.blocks.find((x) => x.userData.letter === s.last); b?.userData.onTap(b); });
  await page.waitForFunction(() => !window.__pup.getStage().learn?.isOpen, null, { timeout: 30000 });
}
// the finale: a screenshot whenever the bubble changes
let last = '', n = 0;
for (let t = 0; t < 120 && n < 10; t++) {
  const bubble = await page.evaluate(() => { const b = document.querySelector('.bubble:not(.hidden)'); return b ? b.innerHTML : ''; });
  if (bubble && bubble !== last && /&nbsp;|\u00a0/.test(bubble)) { last = bubble; await page.screenshot({ path: `${OUT}${String(++n).padStart(2, '0')}.png` }).catch(() => {}); } // (syllables: spaced out)
  if (await page.evaluate(() => !!document.querySelector('.celebrate'))) break;
  await page.waitForTimeout(150);
}
const said = await page.evaluate(() => [...window.__sayLog]);
const bubbles = await page.evaluate(() => window.__bubbles.slice(-6));
writeFileSync(`${OUT}said.txt`, said.join('\n') + '\n\nbubbles (green in brackets):\n' + bubbles.join('\n') + '\n');
console.log(said.slice(-8).join('\n') + '\n' + bubbles.join('\n'));
await browser.close();
