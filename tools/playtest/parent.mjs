// parent.mjs: opens the grown-ups' page the way a parent would (3 s hold on the badge shelf) and tries the level tools (verification tooling)
// env: BASE, OUTDIR (default .), W, H (viewport, default 1180x820),
//   SAVE=file  start from that save: kid.mjs's save.json, or { progress, badges } as the page's "Copy progress" gives it
//   RELOAD=1   then reload the game and open the page again (the same save, read afresh)
//   SET_SPEED=slow|auto  taps that target speed on the page (Balloon Hill, Comet Catch), prints the saved value and the lit chip
//              (again after RELOAD), and saves speed-setting.png (and speed-setting-reload.png)
// Writes parent.txt (the page's text), parent-1.jpg (the top), parent-full.jpg (the whole page), parent-explain.jpg (the
// Missions part), then parent-2/3.jpg from the level tools; with RELOAD also parent-reload.txt and parent-reload-full.jpg.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
const OUT = `${process.env.OUTDIR || '.'}/`;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W || 1180), H = Number(process.env.H || 820);
const save = process.env.SAVE ? JSON.parse(readFileSync(process.env.SAVE, 'utf8')) : null;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true });
const page = await context.newPage();
if (save) {
  await page.addInitScript((save) => { // (once: a reload reads what the game saved since)
    if (sessionStorage.getItem('parent-seeded')) return;
    sessionStorage.setItem('parent-seeded', '1');
    localStorage.setItem('pup-patrol-progress', JSON.stringify(save.progress));
    localStorage.setItem('pup-patrol-badges', JSON.stringify(save.badges || {}));
  }, save);
}

/** From the start screen to the grown-ups' page; false when the hold did not open it. */
async function openPage() {
  await page.waitForSelector('.start .play');
  await page.waitForTimeout(1200);
  const b = await page.locator('.play').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const shelf = await page.locator('.shelf').boundingBox();
  console.log('shelf box:', JSON.stringify(shelf));
  const cdp = await context.newCDPSession(page);
  const t0 = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: shelf.x + shelf.width / 2, y: shelf.y + shelf.height / 2 }] });
  await page.waitForTimeout(3400);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const open = await page.waitForSelector('.parent-view .pv-missions', { timeout: 5000 }).then(() => true, () => false);
  console.log(`parent page opened by a 3 s hold on the shelf: ${open} (${Date.now() - t0} ms from the hold)`);
  return open;
}

/** The page's text, a picture of all of it, and whether anything is wider than the screen. */
async function record(name) {
  writeFileSync(`${OUT}${name}.txt`, await page.locator('.parent-view').innerText());
  const wide = await page.evaluate(() => {
    const v = document.querySelector('.parent-view');
    const over = [...v.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.className || e.tagName);
    return { scrollWidth: v.scrollWidth, clientWidth: v.clientWidth, over: [...new Set(over)].slice(0, 8) };
  });
  console.log(`${name}: ${wide.scrollWidth > wide.clientWidth || wide.over.length ? `WIDER THAN THE SCREEN ${JSON.stringify(wide)}` : 'nothing wider than the screen'}`);
  const tall = await page.evaluate(() => document.querySelector('.parent-view').scrollHeight);
  await page.setViewportSize({ width: W, height: Math.min(tall, 16000) });
  await page.screenshot({ path: `${OUT}${name}-full.jpg`, type: 'jpeg', quality: 70 });
  await page.setViewportSize({ width: W, height: H });
  console.log(`${name}: places`, JSON.stringify(await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.pv-mission')].map((m) => [m.dataset.kind, m.querySelector('.pv-played')?.textContent])))));
}

const speedNow = () => page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem('pup-patrol-progress') || 'null')?.targetSpeed ?? null, chipOn: document.querySelector('.pv-pace .pv-chip.on')?.dataset.speed ?? null }));
const speedShot = async (name) => { await page.locator('.pv-pace').evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200); await page.screenshot({ path: `${OUT}${name}.png` }); };

await page.goto(`${process.env.BASE || 'http://localhost:4190'}/?q=high`);
const open = await openPage();
if (open) {
  await page.screenshot({ path: `${OUT}parent-1.jpg`, type: 'jpeg', quality: 70 });
  await record('parent');
  await page.locator('.pv-explain, .pv-missions').first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); // (.pv-explain: since FX1)
  await page.screenshot({ path: `${OUT}parent-explain.jpg`, type: 'jpeg', quality: 70 });
  if (process.env.SET_SPEED) {
    await page.locator(`.pv-pace [data-speed="${process.env.SET_SPEED}"]`).click();
    await page.waitForTimeout(400);
    console.log('target speed after the tap:', JSON.stringify(await speedNow()));
    await speedShot('speed-setting');
  }
  if (process.env.RELOAD) {
    await page.reload();
    if (await openPage()) {
      await record('parent-reload');
      if (process.env.SET_SPEED) { console.log('target speed after the reload:', JSON.stringify(await speedNow())); await speedShot('speed-setting-reload'); }
    }
  }
  await page.locator('.pv-link').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}parent-2.jpg`, type: 'jpeg', quality: 70 });
  console.log('level rows:', await page.locator('button[data-lvl][data-d="1"]').count(), '; copy button:', await page.locator('.pv-copy').count(), '; max-all button:', await page.locator('[data-act="maxAll"]').count());
  const plus = page.locator('button[data-lvl="cones"][data-d="1"]');
  await plus.scrollIntoViewIfNeeded(); await plus.click(); await plus.click();
  console.log('cones level after two +:', await page.evaluate(() => JSON.parse(localStorage.getItem('pup-patrol-progress')).missions.cones));
  await page.screenshot({ path: `${OUT}parent-3.jpg`, type: 'jpeg', quality: 70 });
}
await browser.close();
