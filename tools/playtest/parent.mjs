// parent.mjs: opens the grown-ups' page the way a parent would (3 s hold on the badge shelf) and tries the level tools (verification tooling)
import { chromium } from 'playwright-core';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = await context.newPage();
await page.goto('http://localhost:4190/?q=high');
await page.waitForSelector('.start .play');
await page.waitForTimeout(1200);
const b = await page.locator('.play').boundingBox();
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const shelf = await page.locator('.shelf').boundingBox();
console.log('shelf box (no badges yet):', JSON.stringify(shelf));
const cdp = await context.newCDPSession(page);
const pt = [{ x: shelf.x + shelf.width / 2, y: shelf.y + shelf.height / 2 }];
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
await page.waitForTimeout(3400);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const open = await page.waitForSelector('.parent-view', { timeout: 5000 }).then(() => true, () => false);
console.log('parent page opened by a 3 s hold on the shelf:', open);
if (open) {
  await page.screenshot({ path: 'parent-1.jpg', type: 'jpeg', quality: 70, fullPage: false });
  await page.locator('.pv-link').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'parent-2.jpg', type: 'jpeg', quality: 70 });
  console.log('level rows:', await page.locator('button[data-lvl][data-d="1"]').count(), '; copy button:', await page.locator('.pv-copy').count(), '; max-all button:', await page.locator('[data-act="maxAll"]').count());
  const plus = page.locator('button[data-lvl="cones"][data-d="1"]');
  await plus.scrollIntoViewIfNeeded(); await plus.click(); await plus.click();
  console.log('cones level after two +:', await page.evaluate(() => JSON.parse(localStorage.getItem('pup-patrol-progress')).missions.cones));
  await page.screenshot({ path: 'parent-3.jpg', type: 'jpeg', quality: 70 });
}
await browser.close();
