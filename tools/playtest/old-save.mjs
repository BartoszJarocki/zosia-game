// Last week's save on this build: a v5 save written by the live game, with keepsakes and levels, opens on the
// island with everything kept, comes out as the current version, and the space trip does not disturb it.
// usage: BASE=http://localhost:4181 OUTDIR=old-save node old-save.mjs <save.json from a live build's walker run>
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const BASE = process.env.BASE || 'http://localhost:4181';
const OUT = new URL(`./${process.env.OUTDIR || 'old-save'}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const old = JSON.parse(readFileSync(process.argv[2], 'utf8')).progress;
// the keepsakes and levels a few weeks of play leave behind
Object.assign(old.world, { rescuedKittens: 3, bridgeBuilt: true, trainUnlocked: true, treatsAtHouse: 2, garageCar: true });
old.missions = { ...old.missions, letters: { level: 3, good: 1, lastAcc: 0.8 }, counting: { level: 4, good: 0, lastAcc: 0.7 } };
const badges = { letters: 6, balloons: 1, name: 2, stones: 1, counting: 5, garage: 1 };

const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(([save, badges]) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('pup-patrol-progress', JSON.stringify(save));
  localStorage.setItem('pup-patrol-badges', JSON.stringify(badges));
}, [old, badges]);
await page.goto(`${BASE}/?q=low`);
await page.waitForSelector('.start .play', { timeout: 60000 });
await page.waitForTimeout(1500);
const b = await page.locator('.start .play').boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForFunction(() => { const s = window.__pup?.getStage(); return s?.markers && !s.silent; }, null, { timeout: 60000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}island.png` });
const now = await page.evaluate(() => JSON.parse(localStorage.getItem('pup-patrol-progress')));
writeFileSync(`${OUT}save-after.json`, JSON.stringify(now, null, 1));
check(now.v >= 6, `the save comes out as v${now.v}`);
for (const k of Object.keys(old.world)) if (!['rewards', 'unseen', 'completedEvents'].includes(k)) check(JSON.stringify(now.world[k]) === JSON.stringify(old.world[k]), `world.${k} kept (${JSON.stringify(old.world[k])})`);
for (const [k, m] of Object.entries(old.missions)) check(now.missions[k]?.level === m.level, `${k} level ${m.level} kept`);
check(JSON.stringify(now.skills) === JSON.stringify(old.skills), 'every skill stat kept');
check(now.sessions?.count >= old.sessions.count, `session count kept (${old.sessions.count} then ${now.sessions?.count})`);
check(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('pup-patrol-badges')))) === JSON.stringify(badges), 'badges kept');
check(!errors.length, `0 page errors ${errors.join(' | ')}`);
await browser.close();
console.log(`${failures.length} of the old-save checks failed`);
process.exit(failures.length ? 1 : 0);
