// shot.mjs <out.jpg> <q> <dsf> [w] [h] : one picture of the island after the greeting (verification tooling)
import { chromium } from 'playwright-core';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
const [out, q = 'high', dsf = '2', w = '1180', h = '820'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dsf, hasTouch: true })).newPage();
await page.goto(`${process.env.BASE || 'http://localhost:4190'}/?q=${q}`);
await page.waitForSelector('.start .play', { timeout: 30000 });
await page.waitForTimeout(1200);
const b = await page.locator('.play').boundingBox();
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: out, type: 'jpeg', quality: 80, scale: 'css' });
await browser.close();
