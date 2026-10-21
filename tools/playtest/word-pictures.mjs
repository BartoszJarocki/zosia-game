// Screenshot each Name Train word picture (kitten, house, heart, cheer) on a live train, for a visual check.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });
const OUT = new URL('./out/word-pictures/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const show of (process.argv[2] || 'kittenRides,houseAppears,heartFloats,girlCheers').split(',')) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:4173'}/?q=low#name`);
  await page.waitForFunction(() => window.__pup?.getStage()?.train && window.__pup.getStage().blocks?.length, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  await page.evaluate((m) => window.__pup.getStage()[m](), show);
  await page.evaluate(() => document.querySelector('.bubble')?.classList.add('hidden')); // as in the outro
  await page.waitForTimeout(show === 'heartFloats' ? 1300 : 2200);
  for (let i = 0; i < 3; i++) { try { await page.screenshot({ path: `${OUT}${show}.png` }); break; } catch { await page.waitForTimeout(500); } }
  console.log(show, 'ok');
  await page.close();
}
await browser.close();
