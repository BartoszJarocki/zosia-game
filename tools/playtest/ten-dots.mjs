// Does the speech bubble lay ten dots out in rows of five (Cone Road's top level, "dots" in the bubble)?
// The walker can't force a number, so this opens Cone Road at the given level and puts ten dots into the bubble
// with the markup ui.bubble() writes for dots without dice. usage: node ten-dots.mjs [level]   (BASE, OUTDIR)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });
const level = Number(process.argv[2] || 9);
const OUT = new URL(`./${process.env.OUTDIR || 'out'}/probe-ten-dots-L${level}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.addInitScript((level) => localStorage.setItem('pup-patrol-progress', JSON.stringify({ v: 4, missions: { cones: { level, good: 0, lastAcc: 1 } }, items: {}, skills: {}, sessions: { count: 0, recent: [] } })), level);
await page.goto(`${process.env.BASE || 'http://127.0.0.1:4173'}/?q=low#cones`);
await page.waitForFunction(() => window.__pup.getStage()?.learn?.isOpen && !document.querySelector('.bubble')?.classList.contains('hidden'), null, { timeout: 60000 });
const rows = await page.evaluate(() => {
  const dots = document.querySelector('.bubble .dots');
  dots.innerHTML = '<i></i>'.repeat(10);
  const ys = [...dots.querySelectorAll('i')].map((i) => Math.round(i.getBoundingClientRect().top));
  return [...new Set(ys)].map((y) => ys.filter((v) => v === y).length);
});
await page.screenshot({ path: `${OUT}bubble-ten-dots.png` });
console.log(`level ${level}: ten dots in the bubble sit in rows of ${rows.join(' + ')}`);
await browser.close();
