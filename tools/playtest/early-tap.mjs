// The River: tap stone 1 while it is still dropping in (300 ms). It should not be asked for again afterwards.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.addInitScript(() => { window.__sayLog = []; });
await page.goto(`${process.env.BASE || 'http://127.0.0.1:4173'}/?q=low#stones`);
await page.waitForFunction(() => window.__pup?.getStage()?.tappables?.some((o) => o.userData.num === 1), null, { timeout: 40000 });
await page.waitForTimeout(300);
await page.evaluate(() => { const s = window.__pup.getStage(); const one = s.tappables.find((o) => o.userData.num === 1); one.userData.onTap(one); });
await page.waitForTimeout(6000);
const said = await page.evaluate(() => window.__sayLog);
console.log(JSON.stringify(said));
const askedOneAgain = said.slice(said.findIndex((x) => /^(Tak|Brawo|Super)! Jeden!/.test(x)) + 1).some((x) => /numer(u)? jeden|Zacznij od|jedynki/.test(x));
console.log(askedOneAgain ? 'FAIL: stone 1 was asked for again after she tapped it' : 'ok: after "Jeden!" the next line is about stone 2');
await browser.close();
