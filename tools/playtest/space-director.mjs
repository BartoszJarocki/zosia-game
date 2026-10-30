// The session director on the space map, in a real browser: a due finale invites her home (Earth gets the star,
// nothing moves by itself), and a wound-down session flies her home, where the island says goodnight.
// usage: BASE=http://localhost:4181 node space-director.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
process.env.TMPDIR ||= `${process.env.HOME}/.cache/pup-patrol-test-tmp`;
mkdirSync(process.env.TMPDIR, { recursive: true });

const BASE = process.env.BASE || 'http://localhost:4181';
const OUT = new URL(`./${process.env.OUTDIR || 'space-director'}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures.push(what); };

async function open(setup) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__said = [];
    const watch = () => { const b = document.querySelector('.bubble'); if (b) window.__said.push(b.innerText); };
    if ('speechSynthesis' in window) {
      const speak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (u) => { window.__said.push(u.text); return speak(u); };
    }
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(watch).observe(document.body, { childList: true, subtree: true }));
  });
  await page.goto(`${BASE}/?q=low`);
  await page.waitForSelector('.start .play', { timeout: 90000 });
  await page.waitForTimeout(1500);
  const b = await page.locator('.start .play').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(() => { const s = window.__pup?.getStage(); return s?.area === 'island' && s.markers && !s.silent; }, null, { timeout: 90000 });
  await page.evaluate(setup);
  // once the start screen's paw wipe is over (a wipe already running drops a new one); the map may be gone again by
  // the time the call returns, so a watcher notes that it showed
  await page.waitForTimeout(3000);
  await page.evaluate(() => { setInterval(() => { if (window.__pup.getStage()?.kind === 'space-map') window.__sawMap = true; }, 50); });
  await page.evaluate(() => window.__pup.game.space());
  await page.waitForFunction(() => window.__sawMap, null, { timeout: 90000 });
  return { page, errors };
}

{
  const { page, errors } = await open(() => { const s = window.__pup.session(); s.targetMissions = s.missionsCompleted; });
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => { const g = window.__pup.getStage(); return { kind: g.kind, state: g.state, suggested: g.suggested }; });
  check(st.kind === 'space-map' && st.state === 'waiting', `finale due: she stays on the map (state ${st.state})`);
  check(st.suggested === 'earth', `finale due: the star is on Earth (suggested ${st.suggested})`);
  await page.screenshot({ path: `${OUT}finale-invite.png` });
  const mars = (await page.evaluate(() => window.__pup.getStage().stopsOnScreen())).find((s) => s.kind === 'mars');
  await page.mouse.click(mars.x, mars.y);
  const flew = await page.waitForFunction(() => { const g = window.__pup.getStage(); return g.state === 'visiting' && g.visiting === 'mars'; }, null, { timeout: 60000 }).then(() => true, () => false);
  check(flew, 'finale due: she can still fly to Mars');
  const said = await page.evaluate(() => window.__said.join(' | '));
  check(/Czas wracać do domu/.test(said), `finale due: Chase invites her home (heard: ${said.slice(0, 160)})`);
  check(!errors.length, `finale due: 0 page errors ${errors.join(' | ')}`);
  await page.close();
}

{
  const { page, errors } = await open(() => { const s = window.__pup.session(); s.endedEarly = true; });
  const home = await page.waitForFunction(() => { const g = window.__pup.getStage(); return g?.area === 'island' && g.markers; }, null, { timeout: 90000 }).then(() => true, () => false);
  check(home, 'wound down: the rocket flies her home by itself');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}goodnight.png` });
  const st = await page.evaluate(() => ({ night: !!window.__pup.getStage().night, said: window.__said.join(' | ') }));
  check(/Robi się późno/.test(st.said), `wound down: Chase says it is getting late (heard: ${st.said.slice(0, 200)})`);
  check(st.night, 'wound down: the island does its goodnight');
  check(!errors.length, `wound down: 0 page errors ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();
console.log(`${failures.length ? 'FAIL' : 'ok'}: ${failures.length} of the director checks failed`);
process.exit(failures.length ? 1 : 0);
