import * as THREE from 'three';

const cache = new Map();
const FONT = '"Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Big glyph on a colored rounded square. Optional dots row underneath (for numbers). */
export function glyphTexture(text, { bg = '#2563eb', fg = '#ffffff', dots = 0, border = '#ffffff' } = {}) {
  const key = [text, bg, fg, dots, border].join('|');
  if (cache.has(key)) return cache.get(key);
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  c.fillStyle = border;
  roundRect(c, 0, 0, S, S, 70);
  c.fill();
  c.fillStyle = bg;
  roundRect(c, 22, 22, S - 44, S - 44, 56);
  c.fill();
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const size = dots ? 300 : 380;
  c.font = `700 ${size}px ${FONT}`;
  c.lineJoin = 'round';
  c.lineWidth = 18;
  c.strokeStyle = 'rgba(0,0,0,0.25)';
  const ty = dots ? S * 0.42 : S * 0.54;
  c.strokeText(text, S / 2, ty);
  c.fillText(text, S / 2, ty);
  if (dots) {
    const perRow = Math.min(dots, 5);
    const rows = Math.ceil(dots / 5);
    const r = 26, gap = 70;
    for (let i = 0; i < dots; i++) {
      const row = Math.floor(i / 5), col = i % 5;
      const inRow = row === rows - 1 ? dots - row * 5 : perRow;
      const x = S / 2 + (col - (inRow - 1) / 2) * gap;
      const y = S * 0.8 + (row - (rows - 1) / 2) * 62;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

export const TILE_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#9333ea', '#f97316', '#db2777', '#0891b2'];

// ---------- more procedural textures ----------
function canvas(w, h = w) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function toTex(cv, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const target = amt > 0 ? new THREE.Color('#ffffff') : new THREE.Color('#000000');
  return '#' + c.lerp(target, Math.abs(amt)).getHexString();
}

/** Just the glyph, transparent background (for balloons, ghost letters). */
export function labelTexture(text, { fg = '#ffffff', stroke = 'rgba(0,0,0,0.35)' } = {}) {
  const key = 'label|' + text + fg + stroke;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = canvas(256);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 200px ${FONT}`;
  c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = stroke;
  c.strokeText(text, 128, 140);
  c.fillStyle = fg;
  c.fillText(text, 128, 140);
  const t = toTex(cv);
  cache.set(key, t);
  return t;
}

/** Round badge with a glyph (tops of stepping stones). */
export function discTexture(text, bg) {
  const key = 'disc|' + text + bg;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = canvas(512);
  c.fillStyle = '#9ca3af'; c.fillRect(0, 0, 512, 512);
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(256, 256, 236, 0, Math.PI * 2); c.fill();
  c.fillStyle = bg; c.beginPath(); c.arc(256, 256, 212, 0, Math.PI * 2); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 280px ${FONT}`;
  c.lineJoin = 'round'; c.lineWidth = 18; c.strokeStyle = 'rgba(0,0,0,0.25)';
  c.strokeText(text, 256, 276);
  c.fillStyle = '#fff'; c.fillText(text, 256, 276);
  const t = toTex(cv);
  cache.set(key, t);
  return t;
}

/** Chase-style fur map for a sphere head: brown cap with a widow's peak, tan eyebrow spots. */
export function pupHeadTexture({ tan, brown, light }) {
  const key = 'pup|' + tan + brown;
  if (cache.has(key)) return cache.get(key);
  const W = 1024, H = 512;
  const [cv, c] = canvas(W, H);
  c.fillStyle = tan; c.fillRect(0, 0, W, H);
  // brown cap: boundary is lower at the back, peaks down between the eyes
  c.fillStyle = brown;
  c.beginPath();
  c.moveTo(0, 0);
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    let d = Math.abs(u - 0.25); d = Math.min(d, 1 - d); // 0 = front centre, .5 = back
    const y = H * (0.335 + 0.2 * (d / 0.5) ** 1.3 + 0.075 * Math.exp(-((d / 0.028) ** 2)));
    c.lineTo(u * W, y);
  }
  c.lineTo(W, 0);
  c.closePath();
  c.fill();
  // soft edge
  c.filter = 'blur(6px)';
  c.drawImage(cv, 0, 0);
  c.filter = 'none';
  // tan eyebrow spots
  c.fillStyle = light;
  for (const du of [-0.058, 0.058]) {
    c.beginPath();
    c.ellipse((0.25 + du) * W, H * 0.355, W * 0.018, H * 0.022, 0, 0, Math.PI * 2);
    c.fill();
  }
  furStrokes(c, W, H, 2600);
  const t = toTex(cv);
  cache.set(key, t);
  return t;
}

function furStrokes(c, W, H, n) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    c.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(60,30,10,0.08)';
    c.lineWidth = 1 + Math.random() * 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (Math.random() - 0.5) * 6, y + 6 + Math.random() * 8);
    c.stroke();
  }
}

/** Plain fur with subtle strokes (bodies). */
export function furTexture(color) {
  const key = 'fur|' + color;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = canvas(256);
  c.fillStyle = color; c.fillRect(0, 0, 256, 256);
  furStrokes(c, 256, 256, 900);
  const t = toTex(cv);
  cache.set(key, t);
  return t;
}

/** Blonde hair with strands running top-to-bottom (i.e. swept back on a sphere). */
export function hairTexture(base) {
  const key = 'hair|' + base;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = canvas(512);
  c.fillStyle = base; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 512;
    const light = Math.random() < 0.55;
    c.strokeStyle = light ? shade(base, 0.35 + Math.random() * 0.3) : shade(base, -0.15 - Math.random() * 0.2);
    c.globalAlpha = 0.25 + Math.random() * 0.35;
    c.lineWidth = 1 + Math.random() * 2.5;
    c.beginPath();
    c.moveTo(x, 0);
    c.bezierCurveTo(x + (Math.random() - 0.5) * 30, 170, x + (Math.random() - 0.5) * 30, 340, x + (Math.random() - 0.5) * 20, 512);
    c.stroke();
  }
  c.globalAlpha = 1;
  const t = toTex(cv);
  cache.set(key, t);
  return t;
}

/** Speckled grass for big ground planes. */
export function grassTexture(base = '#6fcf5c', repeat = 24) {
  const key = 'grass|' + base + repeat;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = canvas(256);
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = Math.random() < 0.5 ? shade(base, 0.12 + Math.random() * 0.12) : shade(base, -0.08 - Math.random() * 0.1);
    c.globalAlpha = 0.6;
    const x = Math.random() * 256, y = Math.random() * 256;
    c.fillRect(x, y, 2, 3 + Math.random() * 3);
  }
  c.globalAlpha = 1;
  const t = toTex(cv, { repeat });
  cache.set(key, t);
  return t;
}

/** Wavy stripes for moving water. */
export function waterTexture(base = '#38bdf8', repeat = 8) {
  const key = 'water|' + base + repeat;
  if (cache.has(key)) return cache.get(key);
  const [cv, c] = canvas(256);
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, w = 14 + Math.random() * 26;
    c.lineWidth = 2 + Math.random() * 2.5;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + w / 2, y - 5, x + w, y);
    c.stroke();
  }
  const t = toTex(cv, { repeat });
  cache.set(key, t);
  return t;
}
