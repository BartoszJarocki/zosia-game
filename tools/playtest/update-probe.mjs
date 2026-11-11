// update-probe.mjs <island|mission> : does a suspended home-screen app pick up a new deploy, and only where that
// cannot interrupt her? (verification tooling for unit A2)
// Builds A into OUTDIR/dist and serves it, opens it and reaches the island (or a mission), rebuilds with another
// label into the same folder, hides and shows the page (spoofed: headless Chromium has no real app switcher), then
// reads the build label from the start screen and from the grown-ups' page.
// env: OUTDIR (default out), PORT (default 4202)
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const where = process.argv[2] === 'mission' ? 'mission' : 'island';
const OUT = resolve(process.env.OUTDIR || 'out', `update-${where}`);
const DIST = join(OUT, 'dist'), PORT = Number(process.env.PORT || 4202), BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });

const build = (sha) => execFileSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { env: { ...process.env, GIT_SHA: sha }, stdio: 'ignore' });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(req.url.split('?')[0]));
  const file = existsSync(path) && extname(path) ? path : join(DIST, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

const log = (...a) => console.log(`[${where}]`, ...a);
build('aaaaaaa');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let loads = 0;
page.on('load', () => loads++);
const until = async (fn, ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await new Promise((r) => setTimeout(r, 500))) if (await fn()) return true; return false; };
const startLabel = () => page.locator('.start .build').textContent();

await page.goto(`${BASE}/?q=high`);
await until(() => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r?.active?.state === 'activated'; }), 90000);
await page.reload(); // (the first visit is not yet controlled by the worker, like a second launch of the app)
await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
await page.waitForSelector('.start .play');
const labelA = await startLabel();
log('build A on the start screen:', labelA);
const b = await page.locator('.play').boundingBox();
await page.waitForTimeout(1200);
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForFunction(() => { const s = window.__pup.getStage(); return s?.markers && !s.silent && !s.busy; }, null, { timeout: 30000 });
if (where === 'mission') {
  await page.evaluate(() => window.__pup.game.startMission('letters'));
  await page.waitForFunction(() => window.__pup.getStage()?.kind === 'letters', null, { timeout: 15000 });
  await page.waitForTimeout(2000);
}
await page.evaluate(() => { window.__still = true; });
log('reached', where === 'mission' ? 'a mission (letters)' : 'the island, idle');

build('bbbbbbb');
log('rebuilt with another label (bbbbbbb) into the served folder');
await page.evaluate(async () => {
  const fire = (hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  fire(true);
  await new Promise((r) => setTimeout(r, 500));
  fire(false);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
});
log('page hidden and shown again');

const waiting = () => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r?.waiting)), null).catch(() => null);
const alive = () => page.evaluate(() => window.__still === true).catch(() => false);
const loadsBefore = loads;
if (where === 'mission') {
  await until(waiting, 60000);
  await page.waitForTimeout(8000);
  log('after 8 s in the mission: same page (no reload):', await alive(), '; new version waiting:', await waiting(), '; page loads since:', loads - loadsBefore);
  await page.screenshot({ path: join(OUT, 'mission-after-return.jpg'), type: 'jpeg', quality: 70 });
  await page.evaluate(() => window.__pup.game.home());
  log('went home (the home button)');
}
await page.waitForSelector('.start .play', { timeout: 90000 }).catch(() => {});
const reloaded = !(await alive());
log('the page reloaded into the new version:', reloaded, '; page loads since:', loads - loadsBefore);
let labelStart = null, labelParent = null;
if (reloaded) {
  labelStart = await startLabel();
  await page.goto(`${BASE}/#parent`);
  await page.reload();
  await page.waitForSelector('.pv-build', { timeout: 15000 });
  labelParent = await page.locator('.pv-head .pv-build').first().textContent();
  await page.screenshot({ path: join(OUT, 'grownups-page.jpg'), type: 'jpeg', quality: 70 });
}
log('label on the start screen:', labelStart, '; label on the grown-ups\' page:', labelParent);
log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
server.close();
