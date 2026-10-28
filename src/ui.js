import { sfx, say } from './audio.js';
import { T } from './lang/pl.js';
import { CONFIG } from './config.js';
import { DICE } from './textures.js';

const ui = document.getElementById('ui');

export const MISSIONS = {
  letters: { label: 'ABC', color: '#ef4444' },
  balloons: { label: '🎈', color: '#db2777' },
  name: { label: (CONFIG.childName || 'A')[0].toUpperCase(), color: '#9333ea' },
  cones: { label: '123', color: '#2563eb' },
  stones: { label: '1·2·3', color: '#0891b2' },
  counting: { label: '🦴', color: '#f59e0b' },
  lookout: { label: '🐾', color: '#e23b3b' },
  delivery: { label: '📦', color: '#b45309' },
  picnic: { label: '🧺', color: '#16a34a' },
};
const ZERO = Object.fromEntries(Object.keys(MISSIONS).map((k) => [k, 0]));

// ---------- icons (crisp SVG instead of emoji) ----------
const PAW_PATH = '<ellipse cx="50" cy="66" rx="23" ry="19"/><ellipse cx="22" cy="42" rx="10" ry="13" transform="rotate(-20 22 42)"/><ellipse cx="40" cy="25" rx="10" ry="13" transform="rotate(-6 40 25)"/><ellipse cx="60" cy="25" rx="10" ry="13" transform="rotate(6 60 25)"/><ellipse cx="78" cy="42" rx="10" ry="13" transform="rotate(20 78 42)"/>';
export const ICON = {
  paw: (c = 'currentColor') => `<svg viewBox="0 0 100 100" fill="${c}">${PAW_PATH}</svg>`,
  home: '<svg viewBox="0 0 100 100"><path d="M50 14 L90 48 H78 V86 H22 V48 H10 Z" fill="#ef4444" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><rect x="40" y="58" width="20" height="28" rx="4" fill="#fff"/></svg>',
  again: '<svg viewBox="0 0 100 100"><path d="M78 50 A28 28 0 1 1 64 25.8" fill="none" stroke="#2563eb" stroke-width="12" stroke-linecap="round"/><path d="M58 8 L84 22 L60 40 Z" fill="#2563eb"/></svg>',
  speaker: '<svg viewBox="0 0 100 100"><path d="M18 38 H36 L58 20 V80 L36 62 H18 Z" fill="#1e4fbf"/><path d="M70 34 Q82 50 70 66 M78 24 Q98 50 78 76" fill="none" stroke="#1e4fbf" stroke-width="8" stroke-linecap="round"/></svg>',
};

export const starsHTML = (level, cls = '', total = 3) =>
  `<div class="stars ${cls}">${Array.from({ length: total }, (_, i) => `<span class="${i < level ? 'on' : ''}">★</span>`).join('')}</div>`;

export function badgeSVG(kind) {
  const m = MISSIONS[kind];
  const fs = m.label.length > 3 ? 22 : m.label.length > 2 ? 30 : 42;
  return `<svg viewBox="0 0 100 110" aria-hidden="true">
    <defs><linearGradient id="g-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="M50 4 L92 18 V52 C92 80 72 98 50 106 C28 98 8 80 8 52 V18 Z" fill="${m.color}" stroke="#fcd34d" stroke-width="7" stroke-linejoin="round"/>
    <path d="M50 12 L84 23 V50 C84 58 82 64 79 70 C60 60 38 56 16 58 V23 Z" fill="url(#g-${kind})"/>
    <text x="50" y="68" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="${fs}" font-weight="700" fill="#fff" stroke="rgba(0,0,0,.2)" stroke-width="1.5">${m.label}</text></svg>`;
}

function nameBadge() {
  const n = (CONFIG.childName || '').toUpperCase();
  return `<svg viewBox="0 0 220 240" class="name-badge" aria-hidden="true">
    <defs><linearGradient id="nb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7bf0"/><stop offset="1" stop-color="#173c9a"/></linearGradient></defs>
    <path d="M110 8 L204 38 V112 C204 176 160 214 110 232 C60 214 16 176 16 112 V38 Z" fill="url(#nb)" stroke="#fcd34d" stroke-width="12" stroke-linejoin="round"/>
    <g transform="translate(60 40) scale(1)" fill="#fcd34d">${PAW_PATH}</g>
    <text x="110" y="178" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${n.length > 6 ? 34 : 44}" fill="#fff" letter-spacing="2">${n}</text></svg>`;
}

// ---------- badges (per-device) ----------
const KEY = 'pup-patrol-badges';
export const badges = {
  get() {
    try { return { ...ZERO, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...ZERO }; }
  },
  add(kind) {
    const b = this.get();
    b[kind] = (b[kind] || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {}
    return b;
  },
};

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const press = (node, fn) => node.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.pop(); fn(); });
const later = (ms) => new Promise((r) => setTimeout(r, ms));

/** The home ring: a circle round the button that fills while it is held. */
const RING = '<svg class="hold-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/></svg>';
/**
 * Hold to leave: the ring fills in ms, then fn runs. Letting go (or sliding off) earlier does nothing, so a
 * stray tap near the speech bubble never ends the mission.
 */
function holdToLeave(btn, fn, ms = 800) {
  let t = null;
  const stop = () => { clearTimeout(t); t = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stop();
    btn.classList.add('holding');
    t = setTimeout(() => { stop(); sfx.pop(); fn(); }, ms);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
}

export function clear() { ui.innerHTML = ''; }

/** "4e01bb5 · 6.10 22:51" — which version this is (for grown-ups; tiny and faint). */
export function buildLabel() {
  const b = typeof __BUILD__ === 'object' ? __BUILD__ : { sha: 'dev', at: '' };
  const d = b.at ? new Date(b.at) : null;
  const when = d ? `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  return [b.sha, when].filter(Boolean).join(' · ');
}

export function showStart(onGo) {
  clear();
  const s = el(`<div class="start">
      <div class="start-badge">${nameBadge()}</div>
      <button class="play" aria-label="Play">${ICON.paw('#fff')}</button>
      <small class="build">${buildLabel()}</small>
    </div>`);
  s.querySelector('.play').addEventListener('pointerdown', (e) => { e.preventDefault(); onGo(); }, { once: true });
  ui.append(s);
}

export function hubHud() {
  clear();
  const b = badges.get();
  const shelf = el(`<div class="shelf"></div>`);
  for (const kind of Object.keys(MISSIONS)) {
    const n = b[kind];
    if (!n) continue;
    shelf.append(el(`<div class="shelf-item">${badgeSVG(kind)}${n > 1 ? `<span>${n}</span>` : ''}</div>`));
  }
  ui.append(shelf);
  // grown-ups: press and hold the shelf for 3 seconds to open their page (a child's tap does nothing)
  let t = null;
  shelf.addEventListener('pointerdown', () => { clearTimeout(t); t = setTimeout(() => onParent?.(), 3000); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) shelf.addEventListener(ev, () => clearTimeout(t));
}
let onParent = null;
/** What a long press on the badge shelf opens (main.js). */
export function setParentOpener(fn) { onParent = fn; }

export function missionHud({ rounds, level = 1, total = 3, bubbleAt = 'middle', onHome }) {
  clear();
  const top = el(`<div class="topbar">
      <button class="round-btn home hold" aria-label="Home (hold)">${ICON.home}${RING}</button>
      <div class="paws">${Array.from({ length: rounds }, () => `<span class="paw">${ICON.paw()}</span>`).join('')}</div>
      <span class="spacer">${starsHTML(level, 'small', total)}</span>
    </div>`);
  holdToLeave(top.querySelector('.home'), onHome);
  ui.append(top);
  ui.append(el(`<button class="bubble hidden ${bubbleAt}" aria-label="Say again"></button>`));
}

/** The mission got shorter (or longer): redraw the paws, keeping the ones already earned. */
export function setRounds(n) {
  const paws = ui.querySelector('.paws');
  if (!paws) return;
  const on = paws.querySelectorAll('.paw.on').length;
  paws.innerHTML = Array.from({ length: n }, (_, i) => `<span class="paw${i < on ? ' on' : ''}">${ICON.paw()}</span>`).join('');
}

export function setProgress(done) {
  ui.querySelectorAll('.paw').forEach((p, i) => {
    const on = i < done;
    if (on && !p.classList.contains('on')) { p.classList.add('on', 'just'); setTimeout(() => p.classList.remove('just'), 600); }
    if (!on) p.classList.remove('on');
  });
}

/**
 * The speech bubble. Tapping it repeats the question.
 *  big: glyph, dots: number of dots (under the glyph, or alone if big is empty)
 *  pic: emoji picture clue, word + at: a whole word with one letter lit, seq: "3 → ?"
 */
export function bubble({ big = '', pic = '', dots = 0, dice = false, word = '', at = -1, done = at, seq = null, onTap, passthrough = false }) {
  const b = ui.querySelector('.bubble');
  if (!b) return;
  const pips = dice && DICE[dots];
  const dotRow = !dots ? '' : pips
    ? `<span class="dots dice ${big ? '' : 'solo'}">${Array.from({ length: 9 }, (_, k) => (pips.includes(k) ? '<i></i>' : '<b></b>')).join('')}</span>`
    : `<span class="dots ${big ? '' : 'solo'}">${'<i></i>'.repeat(dots)}</span>`;
  let main = '';
  if (word) main = `<span class="word">${[...word].map((c, i) => `<b class="${i === at ? 'lit' : (Array.isArray(done) ? done.includes(i) : i < done) ? 'done' : ''}">${c}</b>`).join('')}</span>`;
  else if (seq) main = `<span class="big seq">${seq[0]}<em>${seq[1] || '➜'}</em><span class="q">?</span></span>`;
  else if (big || dots) main = `<span class="big">${big}${dotRow}</span>`;
  b.innerHTML = `${main}${pic ? `<span class="pic">${pic}</span>` : ''}<span class="spk">${ICON.speaker}</span>`;
  b.classList.remove('hidden', 'pop', 'nudge');
  b.classList.toggle('passthrough', passthrough);
  void b.offsetWidth;
  b.classList.add('pop');
  b.onpointerdown = () => { sfx.pop(); onTap?.(); };
}
/** The question is waiting: the bubble bounces (no words). */
export function nudgeBubble() {
  const b = ui.querySelector('.bubble');
  if (!b) return;
  b.classList.remove('nudge');
  void b.offsetWidth;
  b.classList.add('nudge');
}

export function hideBubble() { ui.querySelector('.bubble')?.classList.add('hidden'); }

/** No tap for this long after "Jeszcze raz czy na wyspę?": back to the island by itself. */
export const CELEBRATION_IDLE_MS = 10000;

/**
 * The badge, the stars, and two big buttons (again / the island) under them, clear of the heroes below.
 * talk: resolves when the badge line has been said (until a mission passes it, a guess at its length);
 * then Chase asks "Jeszcze raz czy na wyspę?", and with no tap for a while it is the island.
 */
export function celebrate({ kind, level = 1, total = 3, levelUp = false, onHome, onAgain, talk = null }) {
  const c = el(`<div class="celebrate">
      <div class="rays"></div>
      <div class="big-badge"><div class="flip">${badgeSVG(kind)}</div>${starsHTML(level, levelUp ? 'levelup' : '', total)}</div>
      <div class="actions">
        <button class="round-btn huge again" aria-label="Play again">${ICON.again}</button>
        <button class="round-btn huge home" aria-label="Home">${ICON.home}</button>
      </div>
    </div>`);
  let timer = null, done = false;
  const live = () => !done && c.isConnected; // (a new scene clears the HUD)
  const leave = (fn) => { if (!live()) return; done = true; clearTimeout(timer); window.removeEventListener('pointerdown', rearm, true); fn(); };
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => leave(onHome), CELEBRATION_IDLE_MS); };
  function rearm() { if (live()) arm(); else window.removeEventListener('pointerdown', rearm, true); } // any tap: she is still here
  press(c.querySelector('.again'), () => leave(onAgain));
  press(c.querySelector('.home'), () => leave(onHome));
  ui.append(c);
  confetti();
  (talk || later(levelUp ? 8500 : 5500))
    .then(() => { if (!live()) return; c.classList.add('asking'); return say(T.againOrIsland()); })
    .then(() => { if (!live()) return; arm(); window.addEventListener('pointerdown', rearm, true); });
}

export function confetti(n = 110) {
  const colors = ['#ef4444', '#f59e0b', '#fde047', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const layer = el(`<div class="confetti"></div>`);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.9 + 's';
    p.style.animationDuration = 2.2 + Math.random() * 2 + 's';
    p.style.setProperty('--spin', (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720) + 'deg');
    if (i % 3 === 0) p.classList.add('round');
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 5200);
}

// ---------- elevator panel (The Lookout) ----------
/** Real-elevator style panel: floor display + a button per floor (1 at the bottom). */
export function liftPanel({ floors, onPress }) {
  ui.querySelector('.lift')?.remove();
  const cols = floors > 4 ? 2 : 1;
  const order = [];
  for (let f = floors; f >= 1; f -= cols) for (let c = cols - 1; c >= 0; c--) if (f - c >= 1) order.push(f - c);
  const p = el(`<div class="lift cols-${cols}">
      <div class="lift-display"><span class="arrow"></span><b>0</b></div>
      <div class="lift-buttons">${order.map((f) => `<button class="lift-btn" data-floor="${f}" aria-label="${f}">${f}</button>`).join('')}</div>
    </div>`);
  p.querySelectorAll('.lift-btn').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(Number(b.dataset.floor), b); }));
  ui.append(p);
  const btn = (f) => p.querySelector(`.lift-btn[data-floor="${f}"]`);
  return {
    light(f) { btn(f)?.classList.add('lit'); },
    clear() { p.querySelectorAll('.lift-btn').forEach((b) => b.classList.remove('lit', 'hint')); },
    show(f, dir = 0) { p.querySelector('.lift-display b').textContent = f; p.querySelector('.arrow').textContent = dir > 0 ? '▲' : dir < 0 ? '▼' : ''; },
    nope(f) { const b = btn(f); if (!b) return; b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); },
    hint(f) { btn(f)?.classList.add('hint'); },
    lock(on) { p.classList.toggle('locked', on); },
    remove() { p.remove(); },
  };
}
