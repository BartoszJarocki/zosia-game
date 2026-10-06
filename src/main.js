import './style.css';
import { setStage, getStage } from './engine.js';
import { unlockAudio, sfx, hush } from './audio.js';
import { pawWipe } from './fx/transition.js';
import * as ui from './ui.js';
import { Hub } from './scenes/hub.js';
import { LettersMission } from './scenes/letters.js';
import { CountingMission } from './scenes/counting.js';
import { ConesMission } from './scenes/cones.js';
import { NameMission } from './scenes/name.js';
import { BalloonsMission } from './scenes/balloons.js';
import { StonesMission } from './scenes/stones.js';
import { LookoutMission } from './scenes/lookout.js';
import { resetProgress } from './progress.js';
import { allSegments } from './lang/pl.js';
import { registerSW } from 'virtual:pwa-register';

// Offline + installable. A new version is switched in only while the start screen is showing,
// never in the middle of a mission; otherwise it waits for the next launch.
let started = false;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { if (!started) updateSW(true); },
});

const MISSIONS = {
  letters: LettersMission, balloons: BalloonsMission, name: NameMission,
  cones: ConesMission, stones: StonesMission, counting: CountingMission, lookout: LookoutMission,
};

const game = {
  hub({ greet = false } = {}) {
    hush();
    return pawWipe(() => { setStage(new Hub(game, { greet })); ui.hubHud(); });
  },
  startMission(kind) {
    hush();
    return pawWipe(() => setStage(new MISSIONS[kind](game)));
  },
};

// iOS: stop pinch-zoom / double-tap zoom / rubber-banding.
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

async function boot() {
  // 3D letters are drawn with the Fredoka font, so wait for it (but never hang).
  try { await Promise.race([Promise.all([document.fonts.load('700 100px Fredoka'), document.fonts.load('500 40px Fredoka')]), new Promise((r) => setTimeout(r, 2500))]); } catch {}

  const jump = location.hash.slice(1);
  if (jump === 'reset') { resetProgress(); try { localStorage.removeItem('pup-patrol-badges'); } catch {} location.hash = ''; }

  // The hub slowly orbits behind the start button; a tap unlocks sound + speech.
  setStage(new Hub(game, { silent: true }));
  ui.showStart(() => {
    started = true;
    unlockAudio();
    sfx.bark();
    game.hub({ greet: true });
  });

  // Debug shortcuts: #letters, #balloons, #name, #cones, #stones, #counting, #lookout, #avatar
  if (MISSIONS[jump]) { ui.clear(); setStage(new MISSIONS[jump](game)); }
  if (jump === 'avatar') import('./scenes/avatar.js').then((m) => { ui.clear(); setStage(new m.AvatarStage()); });
}
boot();

// Handy for poking at the game from the browser console.
window.__pup = { game, getStage, allSegments, THREE_REVISION: 1 };
