import * as THREE from 'three';
import { Stage, animate, ease, hop, wait, camera, renderer } from '../engine.js';
import { mat, mesh, star, starShape } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { makeCloud } from '../world/nature.js';
import { makeRocket, makeLaunchPad } from '../world/rocket.js';
import { sparkle } from '../fx/particles.js';
import { say, sfx, hush, unlockAudio } from '../audio.js';
import { SPACE_LINES, SPACE_INVITE, SPACE_TO, SPACE_PASS, SPACE_FACTS } from '../lang/pl.js';
import { PLACES, placesIn } from '../places.js';
import { getVisited, recordVisit } from '../progress.js';
import { getSession, checkAttention } from '../session/session.js';
import { spaceDecision, suggestSpace } from '../session/space.js';
import { spaceHud, launchHud } from '../ui.js';

const rand = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const TAU = Math.PI * 2;

function paint(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.space = true;
  return t;
}

// Repeat across the seam of the sphere.
function blob(c, w, x, y, r, rx = r) {
  for (const dx of [-w, 0, w]) { c.beginPath(); c.ellipse(x + dx, y, rx, r, 0, 0, TAU); c.fill(); }
}

function bands(c, w, h, stops, seed, wobble = 5) {
  const r = rand(seed);
  stops.forEach(([v0, col], i) => {
    const v1 = stops[i + 1]?.[0] ?? 1.05;
    const f = 2 + Math.floor(r() * 3), ph = r() * TAU; // whole waves round the sphere: no seam
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, v0 * h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, v0 * h + (i ? Math.sin((x / w) * TAU * f + ph) * wobble : 0));
    c.lineTo(w, v1 * h + wobble + 2);
    c.lineTo(0, v1 * h + wobble + 2);
    c.closePath();
    c.fill();
  });
}

function craters(c, w, h, base, seed, n) {
  const r = rand(seed);
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; blob(c, w, r() * w, r() * h, 8 + r() * 30); }
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = h * 0.18 + r() * h * 0.64, s = 6 + r() * 16;
    c.fillStyle = 'rgba(40,30,30,0.28)'; blob(c, w, x, y, s);
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = Math.max(2, s * 0.22);
    c.beginPath(); c.arc(x - s * 0.08, y - s * 0.08, s, Math.PI * 0.85, Math.PI * 1.85); c.stroke();
  }
}

const SKINS = {
  sun: (c, w, h) => {
    const r = rand(9);
    c.fillStyle = '#ffc93a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,240,150,0.5)' : 'rgba(255,150,40,0.35)'; blob(c, w, r() * w, r() * h, 10 + r() * 26); }
  },
  mercury: (c, w, h) => craters(c, w, h, '#ae8060', 1, 36),
  pluto: (c, w, h) => {
    craters(c, w, h, '#c1a18c', 23, 8);
    c.fillStyle = '#fff0df';
    c.beginPath();
    c.moveTo(w * 0.28, h * 0.73);
    c.bezierCurveTo(w * 0.06, h * 0.5, w * 0.15, h * 0.26, w * 0.28, h * 0.44);
    c.bezierCurveTo(w * 0.43, h * 0.26, w * 0.51, h * 0.5, w * 0.28, h * 0.73);
    c.fill();
  },
  moon: (c, w, h) => craters(c, w, h, '#f1efe9', 4, 14),
  venus: (c, w, h) => {
    bands(c, w, h, [[0, '#f6e3a4'], [0.18, '#efd38a'], [0.34, '#fbecc0'], [0.5, '#f1d690'], [0.66, '#fbe9b8'], [0.82, '#efd38a']], 2, 9);
    c.filter = 'blur(5px)'; c.drawImage(c.canvas, 0, 0); c.filter = 'none';
  },
  earth: (c, w, h) => {
    const r = rand(3);
    c.fillStyle = '#2f86e8'; c.fillRect(0, 0, w, h);
    const lands = [[0.1, 0.36, 6], [0.24, 0.66, 6], [0.5, 0.34, 8], [0.58, 0.62, 5], [0.82, 0.42, 6], [0.86, 0.7, 3]];
    for (const [u, v, n] of lands) {
      for (let i = 0; i < n * 3; i++) { c.fillStyle = '#4cc24a'; blob(c, w, u * w + (r() - 0.5) * 80, v * h + (r() - 0.5) * 56, 12 + r() * 18); }
      for (let i = 0; i < n; i++) { c.fillStyle = '#2f9e3c'; blob(c, w, u * w + (r() - 0.5) * 50, v * h + (r() - 0.5) * 36, 6 + r() * 9); }
    }
    c.fillStyle = '#f4fbff'; c.fillRect(0, 0, w, h * 0.08); c.fillRect(0, h * 0.92, w, h * 0.08);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      c.lineWidth = 6 + r() * 6;
      const x = r() * w, y = h * 0.15 + r() * h * 0.7, l = 30 + r() * 60;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 9, x + l, y); c.stroke();
    }
  },
  mars: (c, w, h) => {
    const r = rand(5);
    c.fillStyle = '#e0663a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(150,50,25,0.45)'; blob(c, w, r() * w, h * 0.2 + r() * h * 0.6, 10 + r() * 26, 16 + r() * 40); }
    for (let i = 0; i < 20; i++) { c.fillStyle = 'rgba(255,170,120,0.35)'; blob(c, w, r() * w, r() * h, 8 + r() * 20); }
    c.fillStyle = '#fff7f0'; c.fillRect(0, 0, w, h * 0.07);
  },
  jupiter: (c, w, h) => {
    bands(c, w, h, [[0, '#e9d6b4'], [0.1, '#c99a6b'], [0.2, '#f3e6c8'], [0.3, '#b8784e'], [0.4, '#f6ead0'], [0.49, '#e6c79a'],
      [0.57, '#b06d43'], [0.67, '#f3e3c3'], [0.77, '#c99a6b'], [0.88, '#e9d6b4']], 7, 5);
    c.fillStyle = '#f6dcc0'; blob(c, w, w * 0.3, h * 0.64, 22, 40);
    c.fillStyle = '#d4513a'; blob(c, w, w * 0.3, h * 0.64, 16, 32);
  },
  saturn: (c, w, h) => bands(c, w, h, [[0, '#f0d79a'], [0.18, '#e6c47a'], [0.34, '#f5e0a8'], [0.47, '#dcb062'], [0.58, '#f3dc9e'], [0.73, '#e2bd72'], [0.87, '#f0d79a']], 11, 4),
  uranus: (c, w, h) => bands(c, w, h, [[0, '#b8f4f4'], [0.3, '#a5eef0'], [0.5, '#9be6ea'], [0.7, '#a9f0f2']], 13, 3),
  neptune: (c, w, h) => {
    const r = rand(17);
    bands(c, w, h, [[0, '#4a78ee'], [0.22, '#3a66e0'], [0.42, '#2f57d2'], [0.6, '#3d6ae2'], [0.8, '#2f57d2']], 17, 5);
    c.fillStyle = '#1e3a9a'; blob(c, w, w * 0.62, h * 0.6, 14, 26);
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { c.lineWidth = 4 + r() * 4; const x = r() * w, y = h * (0.3 + r() * 0.4); c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30 + r() * 30, y - 2); c.stroke(); }
  },
};

// RingGeometry uses planar UVs.
const ringTexture = (stops) => paint(512, 512, (c) => {
  for (const [f0, f1, col] of stops) { c.strokeStyle = col; c.lineWidth = (f1 - f0) * 256; c.beginPath(); c.arc(256, 256, ((f0 + f1) / 2) * 256, 0, TAU); c.stroke(); }
});

let haloTex = null;
const halo = () => (haloTex ||= paint(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
}));
const glowSprite = (color, size, opacity) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  s.raycast = () => {}; // (a glow must never take a tap meant for the planet in front of it)
  return s;
};

function makePlanet(b, face, r) {
  const g = new THREE.Group();
  const axis = new THREE.Group();
  axis.quaternion.copy(face).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(b.tilt || [0.3, 0, 0.12]))));
  g.add(axis);
  const body = mesh(new THREE.SphereGeometry(r, 40, 28), new THREE.MeshStandardMaterial({ map: paint(512, 256, SKINS[b.id]), roughness: 0.75 }), { shadow: false });
  axis.add(body);
  if (b.ring) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(b.ring.inner * r, b.ring.outer * r, 96, 1),
      new THREE.MeshStandardMaterial({ map: ringTexture(b.ring.stops), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
    ring.rotation.x = -Math.PI / 2;
    axis.add(ring);
  }
  g.add(glowSprite(b.glow, r * 2.9, 0.32));
  body.userData.dynamic = true;
  g.userData.spinner = body;
  g.userData.foot = r * (b.ring?.outer ?? 1);
  return g;
}

export function makeBlackHole(face, R) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(R, 40, 28), new THREE.MeshBasicMaterial({ color: '#150b2e' }), { shadow: false }));
  const front = new THREE.Group();
  front.quaternion.copy(face);
  front.userData.dynamic = true;
  g.add(front);
  front.add(mesh(new THREE.TorusGeometry(R * 1.03, R * 0.07, 10, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.3) }), { shadow: false }));
  g.userData.ring = front.children[0];
  const tilt = new THREE.Group();
  tilt.rotation.set(-1.18, 0, 0.18);
  front.add(tilt);
  const diskTex = paint(512, 512, (c) => {
    const grad = c.createRadialGradient(256, 256, 256 * 0.52, 256, 256, 256);
    grad.addColorStop(0, 'rgba(255,246,200,1)'); grad.addColorStop(0.25, 'rgba(255,180,60,1)'); grad.addColorStop(0.55, 'rgba(255,100,70,0.9)');
    grad.addColorStop(0.8, 'rgba(210,80,220,0.6)'); grad.addColorStop(1, 'rgba(120,60,220,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(255,245,210,0.55)'; c.lineCap = 'round';
    for (let arm = 0; arm < 5; arm++) {
      c.lineWidth = 9;
      c.beginPath();
      for (let f = 0.54; f <= 0.98; f += 0.01) {
        const a = (arm / 5) * TAU + 3.2 * Math.log(f / 0.54);
        const x = 256 + Math.cos(a) * f * 256, y = 256 + Math.sin(a) * f * 256;
        f === 0.54 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }
  });
  const disk = new THREE.Mesh(new THREE.RingGeometry(R * 1.25, R * 2.4, 96, 1),
    new THREE.MeshBasicMaterial({ map: diskTex, color: new THREE.Color(1, 1, 1), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  tilt.add(disk);
  g.add(glowSprite('#c084fc', R * 4.2, 0.28));
  disk.userData.dynamic = true;
  g.userData.spinner = disk;
  g.userData.spinAxis = 'z';
  g.userData.foot = R * 2.4;
  return g;
}

export const LAYOUT = {
  sun: { at: [-20, 0, 13], r: 2.7, disc: 3.8 },
  mercury: { at: [-11.5, 0, 13], r: 2.18, disc: 2.9 },
  venus: { at: [-3.5, 0, 13], r: 2.18, disc: 3 },
  earth: { at: [4.5, 0, 13], r: 2.18, disc: 3 },
  moon: { at: [12.5, 0, 13], r: 2.18, disc: 2.9 },
  mars: { at: [20, 0, 6], r: 2.28, disc: 3 },
  jupiter: { at: [10, 0, 0], r: 2.8, disc: 3.9 },
  saturn: { at: [-3, 0, 0], r: 2.43, disc: 4.3 },
  uranus: { at: [-18, 0, -4], r: 2.43, disc: 3.6 },
  neptune: { at: [-11, 0, -15], r: 2.65, disc: 3.4 },
  pluto: { at: [1, 0, -15], r: 2.4, disc: 3 },
  blackhole: { at: [17, 0, -23], r: 1.6, disc: 4.2, far: true },
  comet: { at: [30, 0, -19], r: 1.8, disc: 3.6, far: true },
  stars: { at: [33, 0, -5], r: 2.4, disc: 4, far: true },
};
export const ROAD_ORDER = Object.keys(LAYOUT);

export function checkLayout(kinds = placesIn('space'), layout = LAYOUT) {
  for (const kind of kinds) {
    if (!layout[kind]) throw new Error(`Missing space layout for ${kind}`);
  }
}
checkLayout();

export const MOVES = {
  launch: ['waiting'],
  waiting: ['flying', 'returning'],
  flying: ['visiting', 'returning'],
  visiting: ['waiting', 'returning'],
  returning: [],
};

export function nextState(state, next) {
  if (!MOVES[state]?.includes(next)) throw new Error(`Invalid space move: ${state} to ${next}`);
  return next;
}

export function flightStops(from, to) {
  const out = [];
  const direction = Math.sign(to - from);
  if (!direction) return out;
  for (let i = direction > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
    direction > 0 ? i <= to : i >= to; i += direction) out.push(i);
  return out;
}

const PAD_VIEW = { pos: new THREE.Vector3(0, 7, 16), look: new THREE.Vector3(-0.7, 2.5, 0), minWidth: 12 };
const RINGS = {
  saturn: { tilt: [0.5, 0, -0.32], ring: { inner: 1.3, outer: 2.1, stops: [[0.62, 0.72, '#c9a25e'], [0.72, 0.84, '#f4dc9c'], [0.87, 0.96, '#e3bf78'], [0.96, 1, '#f6e7bf']] } },
  uranus: { tilt: [0.1, 0.65, -1.3], ring: { inner: 1.45, outer: 1.75, stops: [[0.83, 0.88, '#e6fbff'], [0.94, 1, '#e6fbff']] } },
};
const noShadows = (root) => root.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
const copyView = (view) => ({ pos: view.pos.clone(), look: view.look.clone(), minWidth: view.minWidth });
const forward = (q) => new THREE.Vector3(0, 0, 1).applyQuaternion(q);
const mapAim = new THREE.PerspectiveCamera();
mapAim.position.set(0, 54, 38);
mapAim.lookAt(0, 0, 0);
const MAP_FACE = mapAim.quaternion.clone();
const MAP_RIGHT = new THREE.Vector3(1, 0, 0).applyQuaternion(MAP_FACE);
const MAP_UP = new THREE.Vector3(0, 1, 0).applyQuaternion(MAP_FACE);
const MAP_FORWARD = forward(MAP_FACE);
const bodyPosition = (kind) => new THREE.Vector3(LAYOUT[kind].at[0], LAYOUT[kind].r * 0.55, LAYOUT[kind].at[2]);
const footprint = (kind) => LAYOUT[kind].r * (RINGS[kind]?.ring.outer ?? ({ blackhole: 2.4, comet: 2, stars: 1.3 }[kind] || 1));
const starPosition = (kind) => bodyPosition(kind).addScaledVector(MAP_UP, footprint(kind) + 1.4);

function corners(min, max) {
  const points = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) points.push(new THREE.Vector3(x, y, z));
  return points;
}

function faceBox(center, x, y, z = 0) {
  return corners(new THREE.Vector3(-x, -y, -z), new THREE.Vector3(x, y, z)).map((p) => p.applyQuaternion(MAP_FACE).add(center));
}

function discPoints(kind) {
  const { at, disc } = LAYOUT[kind], r = disc + 0.18;
  return corners(new THREE.Vector3(at[0] - r, -0.06, at[2] - r), new THREE.Vector3(at[0] + r, 0, at[2] + r));
}

export function parkedPosition(kind) {
  const center = bodyPosition(kind);
  const obstacles = ROAD_ORDER.flatMap((k) => [discPoints(k), faceBox(bodyPosition(k), footprint(k), footprint(k)), faceBox(starPosition(k), 1.1, 1.3)]).map((points) => {
    const xs = points.map((p) => p.dot(MAP_RIGHT)), ys = points.map((p) => p.dot(MAP_UP));
    return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
  });
  for (let radius = LAYOUT[kind].disc + 1.8; ; radius += 0.5) {
    for (const angle of [0, Math.PI, Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, -3 * Math.PI / 4]) {
      const p = center.clone().addScaledVector(MAP_RIGHT, Math.cos(angle) * radius).addScaledVector(MAP_UP, Math.sin(angle) * radius);
      const x = p.dot(MAP_RIGHT), y = p.dot(MAP_UP);
      if (obstacles.every((b) => x + 1.8 < b.left || x - 1.8 > b.right || y + 2.2 < b.bottom || y - 2.2 > b.top)) return p;
    }
  }
}

export function mapPoints(here = 'earth', suggested = null) {
  const points = ROAD_ORDER.flatMap((kind) => {
    const r = Math.max(footprint(kind), LAYOUT[kind].r * (kind === 'sun' ? 2.5 : kind === 'comet' ? 3 : 1.45));
    return [...discPoints(kind), ...faceBox(bodyPosition(kind), r, r, LAYOUT[kind].r)];
  });
  points.push(...faceBox(parkedPosition(here), 1.2, 1.6, 0.8));
  if (suggested) points.push(...faceBox(starPosition(suggested), 0.9, 1.1, 0.2));
  return points;
}

export function mapView(width, height, here = 'earth', suggested = null, fov = 42) {
  const points = mapPoints(here, suggested).map((p) => p.applyQuaternion(MAP_FACE.clone().invert()));
  const sy = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 0.88, sx = sy * width / height;
  const bounds = (axis, slope) => [Math.min(...points.map((p) => p[axis] - slope * p.z)), Math.max(...points.map((p) => p[axis] + slope * p.z))];
  const [left, right] = bounds('x', sx), [bottom, top] = bounds('y', sy);
  // These perspective bounds include depth, so the nearer bottom row gets the same screen margin.
  const distance = Math.max((right - left) / (2 * sx), (top - bottom) / (2 * sy));
  const look = new THREE.Vector3((left + right) / 2, (bottom + top) / 2, 0).applyQuaternion(MAP_FACE);
  return { look, pos: look.clone().addScaledVector(MAP_FORWARD, distance), minWidth: 0 };
}

function makeSun(r) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(r, 40, 28), new THREE.MeshBasicMaterial({ map: paint(512, 256, SKINS.sun) }), { shadow: false });
  g.add(body, glowSprite('#ffcf57', r * 3.6, 0.65), glowSprite('#ffad61', r * 5, 0.3));
  body.userData.dynamic = true;
  g.userData.spinner = body;
  g.userData.foot = r;
  return g;
}

function makeComet(face, r) {
  const g = new THREE.Group();
  const tail = paint(256, 128, (c, w, h) => {
    const grad = c.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#b5efff'); grad.addColorStop(1, 'rgba(189,222,255,0)');
    c.fillStyle = grad;
    c.beginPath(); c.moveTo(12, h - 12); c.quadraticCurveTo(w * 0.3, h * 0.25, w, 0); c.quadraticCurveTo(w * 0.65, h * 0.9, 12, h - 12); c.fill();
  });
  const plume = new THREE.Sprite(new THREE.SpriteMaterial({ map: tail, transparent: true, depthWrite: false }));
  plume.scale.set(r * 4, r * 2, 1);
  plume.position.copy(new THREE.Vector3(r, r * 0.4, 0).applyQuaternion(face));
  g.add(plume);
  const body = mesh(new THREE.SphereGeometry(r * 0.65, 24, 18), mat('#e3faff'), { shadow: false });
  g.add(body, glowSprite('#b3efff', r * 2.2, 0.55));
  body.userData.dynamic = true;
  g.userData.spinner = body;
  g.userData.foot = r * 2;
  return g;
}

function makeStars(face, r) {
  const g = new THREE.Group();
  g.quaternion.copy(face);
  const points = [[-1, 0.1], [-0.6, 0.5], [-0.1, 0.35], [0.3, 0], [1, 0.15], [0.8, -0.5], [0.15, -0.5]];
  const v = points.map(([x, y]) => new THREE.Vector3(x * r, y * r, 0));
  const edges = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 3].map((i) => v[i]);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edges), new THREE.LineBasicMaterial({ color: '#ded6ff' })));
  for (const p of v) {
    const s = star('#fff1a3', r * 0.18, 0.08);
    s.position.copy(p);
    g.add(s);
  }
  g.userData.foot = r * 1.3;
  return g;
}

function addSpace(scene) {
  scene.background = new THREE.Color('#8260c7');
  scene.add(new THREE.HemisphereLight('#f1eaff', '#7562a8', 2));
  const light = new THREE.DirectionalLight('#fff1dc', 2.2);
  light.position.set(-10, 30, 28);
  scene.add(light);
  const r = rand(42), positions = [];
  for (let i = 0; i < 850; i++) {
    const p = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(180);
    positions.push(p.x, p.y, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff1cf', size: 3, sizeAttenuation: false, transparent: true, map: halo(), depthWrite: false })));
}

function makeRoad(curve) {
  const g = new THREE.Group();
  g.userData.bakeInside = true;
  const n = 450, pos = [], idx = [], points = curve.getSpacedPoints(n);
  for (let i = 0; i <= n; i++) {
    const t = curve.getTangentAt(i / n);
    const side = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(0.95);
    const p = points[i];
    pos.push(p.x + side.x, -0.06, p.z + side.z, p.x - side.x, -0.06, p.z - side.z);
    if (i < n && curve.getUtoTmapping((i + 1) / n) <= ROAD_ORDER.indexOf('pluto') / (ROAD_ORDER.length - 1)) {
      idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
  }
  const lane = new THREE.BufferGeometry();
  lane.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  lane.setIndex(idx);
  lane.computeVertexNormals();
  g.add(mesh(lane, new THREE.MeshBasicMaterial({ color: '#b1a1ec', side: THREE.DoubleSide }), { shadow: false }));
  const starGeo = new THREE.ShapeGeometry(starShape(0.32, 0.14));
  const starMat = new THREE.MeshBasicMaterial({ color: '#fff4a3', side: THREE.DoubleSide });
  const padMat = new THREE.MeshBasicMaterial({ color: '#7461ba' });
  const rimMat = new THREE.MeshBasicMaterial({ color: '#ddcbff' });
  const len = curve.getLength(), dots = [];
  for (let d = 0.5; d < len; d += 1.15) {
    const p = curve.getPointAt(d / len);
    if (Object.values(LAYOUT).some((s) => p.distanceTo(new THREE.Vector3(...s.at)) < s.disc)) continue;
    if (curve.getUtoTmapping(d / len) > ROAD_ORDER.indexOf('pluto') / (ROAD_ORDER.length - 1)) {
      dots.push(p.x, 0.02, p.z);
      continue;
    }
    g.add(mesh(starGeo, starMat, { x: p.x, y: 0.02, z: p.z, rx: -Math.PI / 2, rz: d * 0.3, shadow: false }));
  }
  g.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(dots, 3)),
    new THREE.PointsMaterial({ color: '#e4d8ff', size: 4, sizeAttenuation: false, map: halo(), transparent: true, opacity: 0.65, depthWrite: false })));
  g.add(mesh(new THREE.PlaneGeometry(32, 34), new THREE.MeshBasicMaterial({ map: halo(), color: '#60419e', transparent: true, opacity: 0.9, depthWrite: false }),
    { x: 27, y: -0.2, z: -16, rx: -Math.PI / 2, shadow: false }));
  for (const { at: [x, , z], disc } of Object.values(LAYOUT)) {
    g.add(mesh(new THREE.CircleGeometry(disc, 48), padMat, { x, y: -0.03, z, rx: -Math.PI / 2, shadow: false }));
    g.add(mesh(new THREE.RingGeometry(disc, disc + 0.18, 48), rimMat, { x, y: -0.02, z, rx: -Math.PI / 2, shadow: false }));
  }
  return g;
}

function helmet(who, radius) {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  g.add(mesh(new THREE.SphereGeometry(radius, 32, 20), new THREE.MeshStandardMaterial({ color: '#d5f6ff', transparent: true, opacity: 0.16, roughness: 0.12, depthWrite: false }), { shadow: false }));
  g.add(mesh(new THREE.TorusGeometry(radius * 0.7, 0.055, 8, 32), mat('#f3f7ff'), { y: -radius * 0.65, rx: Math.PI / 2, shadow: false }));
  who.userData.parts.head.add(g);
  return g;
}

function sunglasses(pup) {
  const g = new THREE.Group();
  g.userData.dynamic = true;
  for (const x of [-0.24, 0.24]) g.add(mesh(new THREE.SphereGeometry(0.2, 16, 12), mat('#192f50'), { x, y: 0.07, z: 0.58, s: [1.1, 0.72, 0.35], shadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), mat('#192f50'), { y: 0.07, z: 0.61, rz: Math.PI / 2, shadow: false }));
  pup.userData.parts.head.add(g);
  g.visible = false;
  return g;
}

function crewPortrait(girl, pup, glasses, shaded) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#244b87');
  scene.add(new THREE.HemisphereLight('#ffffff', '#a8c8ee', 2.4));
  const key = new THREE.DirectionalLight('#fff3dd', 2.5);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const saved = [girl, pup].map((g) => ({ parent: g.parent, position: g.position.clone(), scale: g.scale.clone() }));
  [girl, pup].forEach((g, i) => { scene.add(g); g.scale.setScalar(0.8); g.position.set(i ? 0.48 : -0.48, i ? -1.24 : -1.4, 0); });
  glasses.visible = shaded;
  const cam = new THREE.OrthographicCamera(-1.1, 1.1, 1.1, -1.1, 0.1, 10);
  cam.position.set(0, 0, 5);
  const target = new THREE.WebGLRenderTarget(256, 256);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, cam);
  renderer.setRenderTarget(previous);
  [girl, pup].forEach((g, i) => { saved[i].parent.add(g); g.position.copy(saved[i].position); g.scale.copy(saved[i].scale); });
  glasses.visible = false;
  return target;
}

export class Space extends Stage {
  get at() { return ROAD_ORDER[Math.round(this.routeIndex)]; }

  constructor(game, { launch = false, at = 'earth' } = {}) {
    super();
    this.game = game;
    this.kind = 'space-map';
    this.area = 'space';
    this.state = launch ? 'launch' : 'waiting';
    this.visiting = null;
    this.revision = 0;
    this.view = launch ? copyView(PAD_VIEW) : mapView(globalThis.innerWidth || 1180, globalThis.innerHeight || 820);
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.routeIndex = ROAD_ORDER.indexOf(LAYOUT[at] ? at : 'earth');
    this.returned = PLACES[at]?.game === true;
    this.bodies = {};
    this.idleAt = null;
    this.inviteAt = null;
    this.suggested = null;
    this.nudgeAt = null;
    this.nudges = 0;
  }

  changeState(next, visiting = null) {
    this.state = nextState(this.state, next);
    this.visiting = next === 'visiting' ? visiting : null;
    this.revision++;
    this.idleAt = null;
    this.nudgeAt = null;
    if (next === 'waiting' && this.logAt) this.logAt = performance.now() + 1500;
  }

  enter() {
    addSpace(this.scene);
    this.face = MAP_FACE.clone();
    this.right = MAP_RIGHT.clone();
    this.up = MAP_UP.clone();
    this.map = new THREE.Group();
    this.map.userData.dynamic = true;
    this.scene.add(this.map);
    this.curve = new THREE.CatmullRomCurve3(ROAD_ORDER.map((k) => new THREE.Vector3(...LAYOUT[k].at)), false, 'catmullrom', 0.35);
    this.road = makeRoad(this.curve);
    this.map.add(this.road);
    for (const kind of ROAD_ORDER) this.addStop(kind);
    this.suggestion = star('#ffe066', 0.8, 0.16);
    this.suggestion.userData.dynamic = true;
    this.suggestion.material = new THREE.MeshBasicMaterial({ color: '#ffe895' });
    this.map.add(this.suggestion);
    this.suggestion.userData.tapHeight = 0;
    this.tappable(this.suggestion, () => this.tapStop(this.suggested));
    this.rocket = makeRocket();
    this.rocket.userData.dynamic = true;
    this.scene.add(this.rocket);
    this.makeCrew();
    this.rocket.userData.window.material.map = this.portraits[0].texture;
    this.rocket.userData.window.material.color.set('#ffffff');
    this.rocket.userData.window.material.needsUpdate = true;
    this.activity = () => {
      if (this.state === 'visiting') this.idleAt = performance.now() + 20000;
      if (this.nudgeAt) this.nudgeAt = performance.now() + 25000;
    };
    window.addEventListener('pointerdown', this.activity, true);
    this.resize = () => {
      this.mapView = mapView(innerWidth, innerHeight, ROAD_ORDER[Math.round(this.routeIndex)], this.suggested, camera.fov);
      if (['waiting', 'flying'].includes(this.state) && !this.cameraMove) this.view = copyView(this.mapView);
    };
    window.addEventListener('resize', this.resize);
    if (this.state === 'launch') {
      this.map.visible = false;
      this.buildPad();
      this.prepareLaunch();
    } else {
      this.parkRocket();
      this.showHud();
      this.direct(this.returned ? SPACE_LINES.again : SPACE_LINES.map);
    }
    noShadows(this.scene);
    this.startLog();
    this.onUpdate((dt, t) => this.tick(dt, t));
  }

  addStop(kind) {
    const { r, at } = LAYOUT[kind];
    const b = { id: kind, glow: '#e0d7ff', ...RINGS[kind] };
    const g = kind === 'sun' ? makeSun(r) : kind === 'blackhole' ? makeBlackHole(this.face, r)
      : kind === 'comet' ? makeComet(this.face, r) : kind === 'stars' ? makeStars(this.face, r) : makePlanet(b, this.face, r);
    g.position.set(at[0], r * 0.55, at[2]);
    g.userData.dynamic = true;
    g.userData.tapHeight = 0;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.dynamic = true;
    g.add(hit);
    g.userData.hit = hit;
    this.bodies[kind] = g;
    this.map.add(g);
    this.tappable(g, () => this.tapStop(kind));
    if (kind === 'neptune') {
      const wind = new THREE.Group();
      wind.userData.dynamic = true;
      wind.quaternion.copy(this.face);
      const material = new THREE.MeshBasicMaterial({ color: '#e1faff', transparent: true, opacity: 0.8 });
      for (let i = 0; i < 6; i++) wind.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1 + i % 3 * 0.35, 6), material,
        { x: (i % 2 - 0.5) * r, y: (i - 2.5) * r * 0.3, z: r * 1.05, rz: Math.PI / 2, shadow: false }));
      wind.visible = false;
      g.add(wind);
      this.wind = wind;
    }
  }

  makeCrew() {
    this.crew = new THREE.Group();
    this.crew.userData.dynamic = true;
    this.girl = makeGirl();
    this.pup = makePup();
    this.crew.add(this.girl, this.pup);
    this.scene.add(this.crew);
    this.helmets = [helmet(this.girl, 0.76), helmet(this.pup, 0.9)];
    this.glasses = sunglasses(this.pup);
    noShadows(this.crew);
    this.portraits = [false, true].map((shaded) => crewPortrait(this.girl, this.pup, this.glasses, shaded));
    this.crew.visible = false;
  }

  buildPad() {
    this.launchRoot = new THREE.Group();
    this.launchRoot.userData.bakeInside = true;
    this.scene.add(this.launchRoot);
    this.scene.background.set('#9cddff');
    this.launchRoot.add(makeLaunchPad({ rocket: false }));
    this.launchRoot.add(mesh(new THREE.CylinderGeometry(9, 10, 0.6, 64), mat('#72c95a'), { y: -0.3, shadow: false }));
    this.launchRoot.add(mesh(new THREE.CircleGeometry(90, 64), mat('#65cde3'), { y: -0.65, rx: -Math.PI / 2, shadow: false }));
    for (let i = 0; i < 5; i++) {
      const cloud = makeCloud({ seed: i + 3, scale: 1.6 });
      cloud.position.set(i % 2 ? 6 : -6, 9 + i * 4, -5 - i);
      this.launchRoot.add(cloud);
    }
    this.rocket.position.set(0, 2.8, 0);
    this.rocket.scale.setScalar(1.8);
    this.launchRoot.add(this.crew);
    this.crew.visible = true;
    this.girl.position.set(-2, 0.35, 1.3);
    this.pup.position.set(-3.8, 0.35, 1.1);
    this.helmets.forEach((h) => { h.visible = false; });
    this.launchEarth = makePlanet({ id: 'earth', glow: '#a8ddff' }, camera.quaternion, 5);
    this.launchEarth.position.set(-4.5, 22, -12);
    this.launchEarth.visible = false;
    this.launchRoot.add(this.launchEarth);
    this.rocket.userData.window.material.map = null;
    this.rocket.userData.window.material.color.set('#8edbff');
    this.launchUi = launchHud();
  }

  async prepareLaunch() {
    await wait(800);
    if (!this.alive) return;
    this.helmets.forEach((h) => { h.visible = true; });
    await Promise.all([say(SPACE_LINES.helmets), hop(this.girl, 0.3, 600), hop(this.pup, 0.3, 600)]);
    if (!this.alive) return;
    const from = [this.girl.position.clone(), this.pup.position.clone()];
    await Promise.all([say(SPACE_LINES.board), animate(2200, (t) => {
      [this.girl, this.pup].forEach((who, i) => {
        who.position.lerpVectors(from[i], new THREE.Vector3(i ? 0.35 : -0.35, 2.5, 0.9), t);
        who.position.y += Math.sin(t * Math.PI) * 0.55;
        who.scale.setScalar(1 - t * 0.8);
        who.userData.idle(performance.now() / 1000);
      });
    })]);
    if (!this.alive) return;
    this.crew.visible = false;
    this.rocket.userData.window.material.map = this.portraits[0].texture;
    this.rocket.userData.window.material.color.set('#ffffff');
    this.rocket.userData.window.material.needsUpdate = true;
    let numeral = null;
    await Promise.all([say(SPACE_LINES.countdown), animate(6200, (t) => {
      const n = Math.max(1, 5 - Math.floor(Math.max(0, t * 6.2 - 1.2)));
      if (n !== numeral) { numeral = n; this.launchUi.number(n); }
    }, ease.linear)]);
    if (!this.alive) return;
    this.launchUi.start(() => {
      if (!this.alive || this.state !== 'launch') return;
      unlockAudio();
      this.inviteAt = null;
      this.launchUi.remove();
      this.liftOff();
    });
    this.inviteAt = performance.now() + 10000;
    say(SPACE_LINES.start);
  }

  async liftOff() {
    say(SPACE_LINES.lift);
    sfx.whoosh();
    this.rocket.userData.flame.visible = true;
    const blue = new THREE.Color('#9cddff'), violet = new THREE.Color('#8260c7');
    await animate(5200, (t) => {
      this.rocket.position.y = 2.8 + t * 27;
      this.scene.background.copy(blue).lerp(violet, t);
      this.view.look.lerpVectors(PAD_VIEW.look, new THREE.Vector3(-1, 27, 0), t);
      this.view.pos.lerpVectors(PAD_VIEW.pos, new THREE.Vector3(0, 33, 22), t);
      this.launchEarth.visible = t > 0.45;
      this.launchEarth.scale.setScalar(Math.max(0.01, (t - 0.45) / 0.55));
    }, ease.inOut);
    if (!this.alive) return;
    await say(SPACE_LINES.earth);
    await wait(700);
    if (!this.alive) return;
    const { pawWipe } = await import('../fx/transition.js');
    await pawWipe(() => {
      if (!this.alive) return;
      this.launchRoot.visible = false;
      this.map.visible = true;
      this.parkRocket();
      this.changeState('waiting');
      this.showHud();
      this.direct(SPACE_LINES.map);
    });
  }

  parkRocket() {
    this.rocket.quaternion.copy(this.face);
    this.rocket.scale.setScalar(1.05);
    this.rocket.userData.flame.visible = false;
    this.rocket.position.copy(parkedPosition(ROAD_ORDER[Math.round(this.routeIndex)]));
  }

  positionRocket(index) {
    this.routeIndex = index;
    this.curve.getPoint(index / (ROAD_ORDER.length - 1), this.rocket.position);
    // Above the lane and in front of the stops, never through a planet or the dark centre.
    this.rocket.position.y += 4.2;
    this.rocket.position.z += 4.5;
  }

  direct(greeting) {
    const session = getSession();
    const decision = spaceDecision(session, checkAttention());
    const games = placesIn('space').filter((kind) => PLACES[kind].game);
    this.suggested = decision === 'invite' ? 'earth' : decision === 'suggest'
      ? suggestSpace(session, ROAD_ORDER, ROAD_ORDER[Math.round(this.routeIndex)], getVisited(), games) : null;
    this.suggestion.visible = !!this.suggested;
    this.updateSuggestion(0);
    this.resize();
    if (decision === 'home') { this.returnHome(SPACE_LINES.goodnight); return; }
    this.nudgeLine = decision === 'invite' ? SPACE_LINES.inviteHome : SPACE_INVITE[this.suggested];
    this.nudges = 0;
    this.nudgeAt = this.nudgeLine ? performance.now() + 25000 : null;
    say(greeting === SPACE_LINES.again ? [...greeting, ...(decision === 'invite' ? this.nudgeLine : [])] : this.nudgeLine || greeting);
  }

  updateSuggestion(t) {
    if (!this.suggested) return;
    this.suggestion.position.copy(starPosition(this.suggested)).addScaledVector(this.up, Math.sin(t * 3) * 0.2);
    this.suggestion.quaternion.copy(this.face);
    this.suggestion.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
  }

  showHud() {
    spaceHud({ visiting: this.state === 'visiting', onHome: () => this.returnHome(), onBack: () => this.backToMap() });
  }

  async tapStop(kind) {
    if (!this.alive || this.cameraMove) return;
    if (this.state === 'visiting') {
      if (kind === this.visiting) this.fact();
      return;
    }
    if (this.state !== 'waiting') return;
    if (kind === 'earth') return this.returnHome();
    this.changeState('flying');
    const revision = this.revision;
    this.suggestion.visible = false;
    await this.flyTo(kind, SPACE_TO[kind]);
    if (!this.alive || revision !== this.revision) return;
    await this.visit(kind);
  }

  async flyTo(kind, line) {
    const revision = this.revision;
    const target = ROAD_ORDER.indexOf(kind);
    const stops = flightStops(this.routeIndex, target);
    this.rocket.userData.flame.visible = true;
    let talk = say(line);
    for (const index of stops) {
      if (!this.alive || revision !== this.revision) return;
      const from = this.routeIndex;
      const far = LAYOUT[ROAD_ORDER[index]].far && !LAYOUT[ROAD_ORDER[Math.floor(from)]].far;
      if (far) {
        await talk;
        if (!this.alive || revision !== this.revision) return;
        talk = say(SPACE_LINES.far);
      }
      const a = this.curve.getPoint(from / (ROAD_ORDER.length - 1));
      const b = this.curve.getPoint(index / (ROAD_ORDER.length - 1));
      const dir = b.clone().sub(a);
      const angle = Math.atan2(-dir.dot(this.right), dir.dot(this.up));
      await Promise.all([talk, animate(Math.max(1100, a.distanceTo(b) * (far ? 190 : 105)), (t) => {
        if (revision !== this.revision) return;
        this.positionRocket(from + (index - from) * t);
        this.rocket.quaternion.copy(this.face).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle));
      }, ease.inOut)]);
      if (!this.alive || revision !== this.revision) return;
      talk = index !== target && SPACE_PASS[ROAD_ORDER[index]] ? say(SPACE_PASS[ROAD_ORDER[index]]) : Promise.resolve();
    }
    await talk;
    if (this.alive && revision === this.revision) this.parkRocket();
  }

  async moveView(to, ms = 1100) {
    const revision = this.revision, from = copyView(this.view);
    const moving = animate(ms, (t) => {
      if (revision !== this.revision) return;
      this.view.pos.lerpVectors(from.pos, to.pos, t);
      this.view.look.lerpVectors(from.look, to.look, t);
      this.view.minWidth = from.minWidth + (to.minWidth - from.minWidth) * t;
    });
    this.cameraMove = moving;
    await moving;
    if (this.cameraMove === moving) this.cameraMove = null;
  }

  async visit(kind) {
    this.changeState('visiting', kind);
    recordVisit(kind);
    const session = getSession();
    session.lastActiveAt = Date.now();
    const visited = (session.visited ||= {});
    visited[kind] = (visited[kind] || 0) + 1;
    if (PLACES[kind].game) return this.game.startMission(kind);
    const revision = this.revision;
    this.road.visible = false;
    Object.entries(this.bodies).forEach(([k, g]) => { g.visible = k === kind; });
    this.rocket.visible = kind === 'sun';
    const body = this.bodies[kind], r = body.userData.foot;
    const look = body.position.clone();
    if (kind === 'sun') {
      look.addScaledVector(this.right, r * 0.65);
      this.rocket.position.copy(body.position).addScaledVector(this.right, r * 2.5).addScaledVector(this.up, -r * 0.7);
      this.rocket.scale.setScalar(r * 0.55);
    }
    const distance = r * (kind === 'blackhole' ? 7 : kind === 'sun' ? 6 : 4.3);
    const pos = look.clone().addScaledVector(forward(this.face), distance);
    await this.moveView({ pos, look, minWidth: r * (kind === 'sun' ? 6.3 : kind === 'blackhole' ? 4.8 : 2.9) });
    if (!this.alive || revision !== this.revision) return;
    this.factIndex = SPACE_FACTS[kind].length > 2 ? 2 : 1;
    this.showHud();
    this.activity();
    say(SPACE_FACTS[kind].slice(0, 2));
  }

  fact() {
    const lines = SPACE_FACTS[this.visiting];
    const line = lines[this.factIndex];
    this.factIndex = this.factIndex + 1 < lines.length ? this.factIndex + 1 : 1;
    this.activity();
    this.react();
    say(this.visiting === 'sun' ? [line, ...SPACE_LINES.sunglasses] : line);
  }

  react() {
    const kind = this.visiting, body = this.bodies[kind];
    sfx.pop();
    if (kind === 'sun') {
      this.rocket.userData.window.material.map = this.portraits[1].texture;
      hop(this.rocket, 0.18, 500);
    } else if (kind === 'uranus') {
      const start = body.rotation.z;
      animate(1600, (t) => { body.rotation.z = start + t * TAU; });
    } else if (kind === 'neptune') {
      this.windUntil = performance.now() + 2200;
    } else if (kind === 'blackhole') {
      const glow = body.children.find((o) => o.isSprite);
      animate(1100, (t) => { glow.material.opacity = 0.28 + Math.sin(t * Math.PI) * 0.22; });
    } else {
      hop(body, LAYOUT[kind].r * 0.12, 600);
      sparkle(this, body.position.clone().addScaledVector(forward(this.face), LAYOUT[kind].r * 1.2), { count: 8, size: 0.15, speed: 1.5 });
    }
  }

  showMap() {
    this.road.visible = true;
    Object.values(this.bodies).forEach((g) => { g.visible = true; });
    this.rocket.visible = true;
    this.rocket.userData.window.material.map = this.portraits[0].texture;
    this.parkRocket();
    this.resize();
  }

  async backToMap() {
    if (!this.alive || this.state !== 'visiting' || this.cameraMove) return;
    const revision = this.revision;
    this.idleAt = null;
    this.showMap();
    await this.moveView(this.mapView);
    if (!this.alive || revision !== this.revision) return;
    this.changeState('waiting');
    this.showHud();
    this.direct(SPACE_LINES.again);
  }

  async returnHome(line = SPACE_LINES.home) {
    if (!this.alive || !MOVES[this.state].includes('returning')) return;
    this.changeState('returning');
    this.suggestion.visible = false;
    this.showMap();
    hush();
    const talk = say(line);
    await this.moveView(this.mapView, 800);
    if (!this.alive) return;
    await talk;
    await this.flyTo('earth', []);
    if (!this.alive) return;
    await animate(650, (t) => this.rocket.scale.setScalar(1.05 - t * 0.5));
    if (this.alive) this.game.hub();
  }

  stopsOnScreen() {
    if (!['waiting', 'visiting'].includes(this.state) || this.cameraMove) return [];
    const rect = renderer.domElement.getBoundingClientRect();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    return Object.entries(this.bodies).filter(([k]) => this.state === 'waiting' || k === this.visiting).map(([kind, g]) => {
      const p = g.getWorldPosition(new THREE.Vector3());
      const c = p.clone().project(camera);
      const edge = p.addScaledVector(right, g.userData.hit.scale.x * g.scale.x).project(camera);
      return { kind, x: rect.left + (c.x + 1) * rect.width / 2, y: rect.top + (1 - c.y) * rect.height / 2,
        r: Math.abs(edge.x - c.x) * rect.width / 2 };
    });
  }

  startLog() {
    if (!new URLSearchParams(location.search).has('spacelog')) return;
    this.previousReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    this.logAt = performance.now() + 1500;
    this.onUpdate(() => {
      if (this.logAt && this.state === 'waiting' && performance.now() > this.logAt) {
        console.info('[space] renderer.info.render.calls', renderer.info.render.calls);
        this.logAt = null;
      }
      renderer.info.reset();
    });
  }

  tick(dt, t) {
    const now = performance.now();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const width = renderer.domElement.getBoundingClientRect().width;
    for (const [kind, g] of Object.entries(this.bodies)) {
      const spin = g.userData.spinner;
      if (spin) spin.rotation[g.userData.spinAxis || 'y'] += dt * (kind === 'sun' ? 0.06 : 0.18);
      const c = g.position.clone().project(camera), edge = g.position.clone().add(right).project(camera);
      const perUnit = Math.abs(edge.x - c.x) * width / 2;
      g.userData.hit.scale.setScalar(Math.max(g.userData.foot, 38 / Math.max(perUnit, 0.01)));
    }
    if (this.state === 'waiting') this.updateSuggestion(t);
    this.rocket.userData.flame.scale.y = 1 + Math.sin(t * 24) * 0.15;
    this.wind.visible = this.visiting === 'neptune' && now < (this.windUntil || 0);
    if (this.wind.visible) this.wind.position.copy(this.right).multiplyScalar(Math.sin(t * 7) * 0.8);
    if (this.inviteAt && now >= this.inviteAt) { this.inviteAt = null; say(SPACE_LINES.startAgain); }
    if (this.idleAt && now >= this.idleAt) this.backToMap();
    if (this.nudgeAt && now >= this.nudgeAt && this.state === 'waiting') {
      say(this.nudgeLine);
      this.nudgeAt = ++this.nudges < 2 ? now + 25000 : null;
    }
  }

  resumed(ms) {
    if (this.idleAt) this.idleAt += ms;
    if (this.inviteAt) this.inviteAt += ms;
    if (this.nudgeAt) this.nudgeAt += ms;
  }

  exit() {
    window.removeEventListener('pointerdown', this.activity, true);
    window.removeEventListener('resize', this.resize);
    this.launchUi?.remove();
    this.portraits?.forEach((p) => p.dispose());
    const textures = new Set();
    this.scene.traverse((o) => {
      for (const m of [o.material].flat().filter(Boolean)) {
        for (const t of [m.map, m.emissiveMap]) if (t?.userData.space && t !== haloTex) textures.add(t);
      }
    });
    textures.forEach((t) => t.dispose());
    if (this.previousReset !== undefined) renderer.info.autoReset = this.previousReset;
    hush();
  }
}
