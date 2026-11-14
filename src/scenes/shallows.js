import * as THREE from 'three';
import { animate, ease, hop } from '../engine.js';
import { mat, mesh, rbox } from '../models.js';
import { portrait } from '../world/portrait.js';
import { sparkle } from '../fx/particles.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { shallowsPlan } from '../levels/shallows.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

// A glass pool on the beach, seen from the side: blue water up to a white surface line, sand on its bottom.
const SURFACE = 4.2;
const BOTTOM = 0.34;
const POOL_X = 3.9, POOL_Z = 1.3;
const PLANK_Y = SURFACE + 1.35;
const WAIT_AT = new THREE.Vector3(0, PLANK_Y + 0.11, -0.55); // on the plank above the water
const DROP_AT = new THREE.Vector3(0, 0, 0.25);
const SHELF_X = 7.45;
const SLOTS = [[0, 1.72], [-1.5, 1.72], [1.5, 1.72], [0, 0.52], [-1.5, 0.52], [1.5, 0.52]]; // the top board first, from the middle

const SAND_SIZE = { kłoda: 3.6, moneta: 2.4, default: 2.7 }; // waiting on the plank and in the water
const SHELF_SIZE = { kłoda: 1.6, moneta: 1.6, default: 1.55 };
const target = (table, id) => table[id] ?? table.default;
const tall = () => globalThis.innerHeight > globalThis.innerWidth;

/** Small drawn pictures for the bubble, matching the things in the scene. */
const THING_PICTURES = {
  'jabłko': `<circle cx="50" cy="57" r="27" fill="#ef4444"/>
    <ellipse cx="39" cy="48" rx="8" ry="5" fill="#f87171" opacity=".7"/>
    <path d="M50 31 Q52 20 58 15" stroke="#7c4a1e" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M58 20 Q72 10 78 22 Q68 32 58 20 Z" fill="#22c55e"/>`,
  piłka: `<circle cx="50" cy="52" r="28" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>
    <path d="M50 24 Q38 52 50 80 Q62 52 50 24 Z" fill="#ef4444"/>
    <path d="M22 52 Q50 40 78 52 Q50 64 22 52 Z" fill="#2563eb"/>`,
  kaczka: `<ellipse cx="45" cy="62" rx="28" ry="19" fill="#fde047"/>
    <circle cx="66" cy="38" r="15" fill="#fde047"/>
    <path d="M80 38 L94 33 L80 45 Z" fill="#f97316"/>
    <circle cx="70" cy="34" r="3.5" fill="#1f2937"/>
    <path d="M28 62 Q38 72 48 62" stroke="#f59e0b" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  'liść': `<path d="M22 70 Q20 30 74 22 Q84 66 42 78 Q30 78 22 70 Z" fill="#4ade80" stroke="#16a34a" stroke-width="3"/>
    <path d="M28 72 Q48 52 72 30" stroke="#166534" stroke-width="3" fill="none"/>
    <path d="M23 71 L12 82" stroke="#166534" stroke-width="4" stroke-linecap="round"/>`,
  klocek: `<rect x="24" y="40" width="52" height="42" rx="6" fill="#b45309"/>
    <rect x="24" y="32" width="52" height="16" rx="6" fill="#d97706"/>
    <rect x="34" y="52" width="12" height="20" rx="4" fill="#92400e"/>`,
  'kłoda': `<rect x="16" y="42" width="60" height="30" rx="14" fill="#8b4a20"/>
    <ellipse cx="76" cy="57" rx="12" ry="16" fill="#e5b878" stroke="#6b3410" stroke-width="3"/>
    <ellipse cx="76" cy="57" rx="6" ry="8" fill="none" stroke="#b1702f" stroke-width="2"/>
    <path d="M34 46 L28 34" stroke="#6b3410" stroke-width="4" stroke-linecap="round"/>`,
  'kamień': `<path d="M22 64 Q18 44 38 34 Q58 22 74 38 Q88 52 80 68 Q70 80 46 80 Q26 78 22 64 Z" fill="#94a3b8" stroke="#64748b" stroke-width="3"/>
    <path d="M36 48 Q46 42 56 48" stroke="#cbd5e1" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  klucz: `<circle cx="32" cy="38" r="14" fill="none" stroke="#fbbf24" stroke-width="8"/>
    <path d="M42 48 L76 72" stroke="#fbbf24" stroke-width="8" stroke-linecap="round"/>
    <path d="M64 64 L72 54 M70 70 L78 60" stroke="#fbbf24" stroke-width="7" stroke-linecap="round"/>`,
  moneta: `<circle cx="50" cy="52" r="28" fill="#fbbf24" stroke="#d97706" stroke-width="4"/>
    <circle cx="50" cy="52" r="19" fill="none" stroke="#fde68a" stroke-width="4"/>
    <path d="M44 44 L44 62 M44 44 L58 44 Q64 44 64 50 Q64 56 58 56 L44 56" stroke="#d97706" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  'łyżka': `<ellipse cx="42" cy="38" rx="16" ry="21" fill="#cbd5e1" stroke="#94a3b8" stroke-width="3" transform="rotate(-25 42 38)"/>
    <path d="M52 52 L76 80" stroke="#94a3b8" stroke-width="8" stroke-linecap="round"/>`,
};

export function thingPicture(id) {
  const art = THING_PICTURES[id];
  if (!art) return '';
  return `<svg data-thing="${id}" viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true">${art}</svg>`;
}

/** A shelf's picture: the pool again, with a duck sitting on the surface line or a stone lying on the bottom. */
function signMap(side) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 384;
  const c = cv.getContext('2d');
  const line = 150;
  c.fillStyle = '#f0f9ff';
  c.fillRect(0, 0, 512, 384);
  c.fillStyle = '#fde68a';
  c.fillRect(0, 328, 512, 56);
  const water = c.createLinearGradient(0, line, 0, 328);
  water.addColorStop(0, '#7dd3fc');
  water.addColorStop(1, '#0ea5e9');
  c.fillStyle = water;
  c.fillRect(0, line, 512, 328 - line);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '170px "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  if (side === 'float') c.fillText('🦆', 256, line - 30);
  else {
    c.fillText('🪨', 256, 262);
    c.fillStyle = 'rgba(14, 165, 233, 0.35)'; // under water
    c.fillRect(0, line, 512, 328 - line);
  }
  c.strokeStyle = '#ffffff';
  c.lineWidth = 14;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(8, line);
  for (let x = 8; x < 504; x += 62) c.quadraticCurveTo(x + 31, line + (x / 62 % 2 ? 12 : -12), x + 62, line);
  c.stroke();
  c.strokeStyle = '#b45309';
  c.lineWidth = 16;
  c.strokeRect(8, 8, 496, 368);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The pool's front glass: clear above the wavy white surface line, blue below it, darker towards the bottom. */
function waterMap() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const c = cv.getContext('2d');
  const line = 24; // the canvas reaches a little above the surface, for the crests
  const water = c.createLinearGradient(0, line, 0, 256);
  water.addColorStop(0, 'rgba(125, 211, 252, 0.5)');
  water.addColorStop(1, 'rgba(2, 132, 199, 0.62)');
  c.fillStyle = water;
  c.beginPath();
  c.moveTo(0, line);
  for (let x = 0; x < 512; x += 64) c.quadraticCurveTo(x + 32, line + (x / 64 % 2 ? 9 : -9), x + 64, line);
  c.lineTo(512, 256);
  c.lineTo(0, 256);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  c.lineWidth = 9;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, line);
  for (let x = 0; x < 512; x += 64) c.quadraticCurveTo(x + 32, line + (x / 64 % 2 ? 9 : -9), x + 64, line);
  c.stroke();
  c.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  c.lineWidth = 4;
  for (const [x, y, w] of [[70, 90, 90], [300, 130, 120], [170, 190, 80], [400, 210, 70]]) {
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + w / 2, y - 8, x + w, y);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringMap() {
  return texture(256, (c, size) => {
    c.fillStyle = '#e5b878';
    c.fillRect(0, 0, size, size);
    c.strokeStyle = '#b1702f';
    c.lineWidth = 6;
    for (const r of [34, 58, 84, 112]) {
      c.beginPath();
      c.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      c.stroke();
    }
  });
}

function skyMap() {
  return texture(512, (c, size) => {
    const sky = c.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, '#7dd3fc');
    sky.addColorStop(0.55, '#bae6fd');
    sky.addColorStop(1, '#fef3c7');
    c.fillStyle = sky;
    c.fillRect(0, 0, size, size);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (const [x, y, rx, ry] of [[90, 105, 54, 18], [350, 140, 70, 22], [220, 70, 40, 14]]) {
      c.beginPath();
      c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function bottomMap() {
  return texture(512, (c, size) => {
    c.fillStyle = '#fde68a';
    c.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = (i * 173 + 41) % size, y = (i * 311 + 97) % size, r = 3 + i % 5;
      c.fillStyle = i % 3 ? '#fcd34d' : '#e7c873';
      c.beginPath();
      c.ellipse(x, y, r * 1.6, r, i, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function makeShelf() {
  const g = new THREE.Group();
  const wood = mat('#b45309', { roughness: 0.85 });
  const board = mat('#d97706', { roughness: 0.8 });
  g.add(mesh(rbox(4.8, 3.0, 0.18, 0.09), mat('#fdf4e3', { roughness: 0.9 }), { y: 1.5, z: -0.18, shadow: false })); // (light, so the things on it stand out)
  for (const x of [-2.32, 2.32]) g.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.0, 8), wood, { x, y: 1.5, z: -0.14, shadow: false }));
  for (const y of [0.45, 1.65]) g.add(mesh(rbox(4.7, 0.14, 0.7, 0.05), board, { y, z: 0.26, shadow: false }));
  return g;
}

export function makeThing(id, hitMat) {
  const g = new THREE.Group();
  const add = (geo, material, opts) => g.add(mesh(geo, material, { shadow: false, ...opts }));

  if (id === 'jabłko') {
    add(new THREE.SphereGeometry(0.5, 20, 16), mat('#ef4444', { roughness: 0.45 }), { y: 0.5 });
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), mat('#7c4a1e'), { y: 1.02 });
    add(new THREE.SphereGeometry(0.17, 12, 8), mat('#22c55e'), { x: 0.14, y: 0.96, z: 0, s: [1.3, 0.35, 0.8], rz: -0.35 });
  } else if (id === 'piłka') {
    add(new THREE.SphereGeometry(0.48, 20, 16), mat('#f8fafc', { roughness: 0.35 }), { y: 0.48 });
    add(new THREE.TorusGeometry(0.47, 0.085, 8, 28), mat('#ef4444'), { y: 0.48, rx: Math.PI / 2 });
    add(new THREE.TorusGeometry(0.47, 0.085, 8, 28), mat('#2563eb'), { y: 0.48, ry: Math.PI / 2 });
  } else if (id === 'kaczka') {
    add(new THREE.SphereGeometry(0.5, 20, 16), mat('#fde047', { roughness: 0.5 }), { y: 0.36, s: [1.2, 0.72, 0.86] });
    add(new THREE.SphereGeometry(0.27, 16, 12), mat('#fde047', { roughness: 0.5 }), { x: 0.36, y: 0.82 });
    add(new THREE.ConeGeometry(0.11, 0.24, 10), mat('#f97316'), { x: 0.65, y: 0.8, rz: -Math.PI / 2 });
    add(new THREE.SphereGeometry(0.035, 8, 6), mat('#1f2937'), { x: 0.43, y: 0.9, z: 0.2 });
    add(new THREE.SphereGeometry(0.035, 8, 6), mat('#1f2937'), { x: 0.43, y: 0.9, z: -0.2 });
  } else if (id === 'liść') {
    const leaf = new THREE.Shape(); // pointed at both ends, so it reads as a leaf from the side
    leaf.moveTo(0, -0.62);
    leaf.quadraticCurveTo(0.8, 0, 0, 0.62);
    leaf.quadraticCurveTo(-0.8, 0, 0, -0.62);
    add(new THREE.ExtrudeGeometry(leaf, { depth: 0.06, bevelEnabled: false }), mat('#4ade80', { roughness: 0.6 }), { y: 0.62, rz: -0.9 });
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), mat('#166534'), { y: 0.62, z: 0.07, rz: -0.9 });
  } else if (id === 'klocek') {
    add(rbox(0.85, 0.85, 0.85, 0.08), mat('#b45309', { roughness: 0.75 }), { y: 0.425 });
    add(rbox(0.87, 0.08, 0.87, 0.04), mat('#d97706', { roughness: 0.7 }), { y: 0.85 });
  } else if (id === 'kłoda') {
    const log = new THREE.Group();
    const bark = mat('#8b4a20', { roughness: 0.95 });
    log.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.6, 20), bark, { y: 0.62, rz: Math.PI / 2, shadow: false }));
    const cut = new THREE.MeshStandardMaterial({ map: ringMap(), roughness: 0.85 });
    log.add(mesh(new THREE.CircleGeometry(0.6, 26), cut, { x: 1.32, y: 0.62, ry: Math.PI / 2, shadow: false }));
    log.add(mesh(new THREE.TorusGeometry(0.6, 0.045, 8, 26), mat('#6b3410'), { x: 1.33, y: 0.62, ry: Math.PI / 2, shadow: false }));
    log.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 8), mat('#6b3410'), { x: -0.4, y: 1.18, z: 0.28, rz: -0.55, rx: 0.25, shadow: false }));
    log.rotation.y = -0.55;
    g.add(log);
  } else if (id === 'kamień') {
    add(new THREE.DodecahedronGeometry(0.55, 0), mat('#94a3b8', { roughness: 1 }), { y: 0.5, s: [1.1, 1.05, 1], ry: 0.4 });
  } else if (id === 'klucz') {
    add(new THREE.TorusGeometry(0.19, 0.065, 8, 20), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: -0.2, y: 0.55 });
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 8), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: 0.18, y: 0.55, rz: Math.PI / 2 });
    add(rbox(0.13, 0.16, 0.07, 0.02), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: 0.42, y: 0.47 });
    add(rbox(0.13, 0.13, 0.07, 0.02), mat('#fbbf24', { metalness: 0.5, roughness: 0.3 }), { x: 0.3, y: 0.47 });
  } else if (id === 'moneta') {
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), mat('#fbbf24', { metalness: 0.55, roughness: 0.25, emissive: '#f59e0b', emissiveIntensity: 0.18 }), { y: 0.42, rx: Math.PI / 2 });
    add(new THREE.TorusGeometry(0.35, 0.03, 8, 24), mat('#fde68a', { metalness: 0.4, roughness: 0.3 }), { y: 0.42, z: 0.06 });
  } else {
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), mat('#cbd5e1', { metalness: 0.45, roughness: 0.3 }), { x: 0.12, y: 0.5, rz: 0.5 - Math.PI / 2 });
    add(new THREE.SphereGeometry(0.28, 16, 10), mat('#cbd5e1', { metalness: 0.45, roughness: 0.3 }), { x: -0.28, y: 0.28, s: [1, 0.65, 0.7], rz: 0.5 });
  }

  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  g.userData.shelfScale = target(SHELF_SIZE, id) / span;
  g.userData.half = size.y * target(SAND_SIZE, id) / span;
  g.scale.setScalar(target(SAND_SIZE, id) / span);

  // The hit zone moves with the thing, so the tap target is the drawn object's own group.
  const hit = mesh(new THREE.SphereGeometry(Math.max(size.x, size.y) * 0.55, 10, 8), hitMat, { y: size.y * 0.5, shadow: false });
  hit.userData.zone = true;
  g.add(hit);
  return g;
}

function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    if (o.userData.zone) return;
    for (const m of [o.material].flat()) {
      if (!m) continue;
      m.map?.dispose();
      m.dispose();
    }
  });
}

export class ShallowsMission extends Mission {
  constructor(game) {
    super(game, 'shallows');
    this.view = { pos: new THREE.Vector3(0, 7.7, 20), look: new THREE.Vector3(0, 6.3, 0), get minWidth() { return tall() ? 21.6 : 22.2; } }; // (side on, a little above the water line)
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'waiting';
    this.plan = null;
    this.thing = null;
    this.shelves = {};
    this.signs = {};
    this.shelfCount = { float: 0, sink: 0 };
    this.maps = [];
    this.mats = [];
    this.bobbing = new Set();
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
  }

  build() {
    this.sky = skyMap();
    this.maps.push(this.sky);
    this.scene.background = this.sky;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#fde68a', 2.45));
    const sun = new THREE.DirectionalLight('#fff6e0', 2.05);
    sun.position.set(-7, 14, 10);
    this.scene.add(sun);

    const ground = texture(1024, (c, size) => {
      c.fillStyle = '#fde68a';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 80; i++) {
        const x = (i * 271 + 59) % size, y = (i * 419 + 149) % size, r = 3 + i % 6;
        c.fillStyle = i % 2 ? '#fcd34d' : '#e7c873';
        c.beginPath();
        c.ellipse(x, y, r * 1.8, r, 0.2, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.maps.push(ground);
    const sandMat = new THREE.MeshStandardMaterial({ map: ground, roughness: 1 });
    this.mats.push(sandMat);
    this.scene.add(mesh(new THREE.CircleGeometry(40, 48), sandMat, { rx: -Math.PI / 2, shadow: false }));
    const seaMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    this.mats.push(seaMat);
    this.scene.add(mesh(new THREE.PlaneGeometry(120, 14), seaMat, { y: 0.02, z: -26, rx: -Math.PI / 2, shadow: false })); // the sea behind the beach

    this.buildPool();
    this.shelves.float = this.addShelf('float', -SHELF_X);
    this.shelves.sink = this.addShelf('sink', SHELF_X);

    this.portrait = portrait();
    const discMat = new THREE.MeshBasicMaterial({ map: this.portrait.texture });
    this.mats.push(discMat);
    this.window = new THREE.Group();
    this.window.add(mesh(new THREE.CircleGeometry(1.15, 48), discMat, { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.21, 0.11, 10, 48), mat('#fbbf24'), { shadow: false }));
    this.window.position.set(3.4, 10.7, -2);
    this.window.lookAt(this.view.pos);
    this.scene.add(this.window);

    this.onUpdate((dt, t) => {
      for (const thing of this.bobbing) {
        if (thing.parent) thing.position.y = thing.userData.restY + Math.sin(t * 2.1) * 0.05;
      }
    });

    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  /** The glass pool: a dark back wall, sand on the bottom, the front glass blue below its white surface line, a plank across. */
  buildPool() {
    const backMat = new THREE.MeshBasicMaterial({ color: '#0e7fae' });
    const rimMat = mat('#e0f2fe', { roughness: 0.3 });
    const plankMat = mat('#a16207', { roughness: 0.85 });
    this.mats.push(backMat);
    this.scene.add(mesh(new THREE.PlaneGeometry(POOL_X * 2, SURFACE), backMat, { y: SURFACE / 2, z: -POOL_Z, shadow: false }));
    this.bottom = bottomMap();
    this.maps.push(this.bottom);
    const bottomMat = new THREE.MeshStandardMaterial({ map: this.bottom, roughness: 1 });
    this.mats.push(bottomMat);
    this.scene.add(mesh(rbox(POOL_X * 2, BOTTOM, POOL_Z * 2, 0.04), bottomMat, { y: BOTTOM / 2, shadow: false }));
    const topMat = new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.55, depthWrite: false });
    this.mats.push(topMat);
    this.scene.add(mesh(new THREE.PlaneGeometry(POOL_X * 2, POOL_Z * 2), topMat, { y: SURFACE, rx: -Math.PI / 2, shadow: false }));

    this.waterFront = waterMap();
    this.maps.push(this.waterFront);
    const frontMat = new THREE.MeshBasicMaterial({ map: this.waterFront, transparent: true, depthWrite: false });
    this.mats.push(frontMat);
    const crest = (SURFACE - BOTTOM) * 24 / 232; // (the canvas's crests rise above the surface line)
    this.surface = mesh(new THREE.PlaneGeometry(POOL_X * 2, SURFACE - BOTTOM + crest), frontMat, { y: BOTTOM + (SURFACE - BOTTOM + crest) / 2, z: POOL_Z, shadow: false });
    this.surface.renderOrder = 2; // after the things inside, so they are seen through the water
    this.scene.add(this.surface);

    for (const x of [-POOL_X, POOL_X]) this.scene.add(mesh(rbox(0.22, SURFACE + 0.3, 0.22, 0.06), rimMat, { x, y: (SURFACE + 0.3) / 2, z: POOL_Z, shadow: false }));
    this.scene.add(mesh(rbox(POOL_X * 2 + 0.22, 0.2, 0.22, 0.06), rimMat, { y: 0.1, z: POOL_Z, shadow: false }));
    this.plank = new THREE.Group();
    this.plank.add(mesh(rbox(POOL_X * 2 + 0.6, 0.2, 1.2, 0.06), plankMat, { shadow: false }));
    for (const x of [-POOL_X, POOL_X]) this.plank.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, PLANK_Y, 8), plankMat, { x, y: -PLANK_Y / 2, shadow: false }));
    this.plank.position.set(0, PLANK_Y, WAIT_AT.z);
    this.scene.add(this.plank);
  }

  addShelf(side, x) {
    const shelf = makeShelf();
    const map = signMap(side);
    this.maps.push(map);
    const signMat = new THREE.MeshBasicMaterial({ map });
    this.mats.push(signMat);
    const sign = mesh(new THREE.PlaneGeometry(4.6, 3.45), signMat, { y: 4.85, z: 0.02, shadow: false });
    shelf.add(sign);
    this.signs[side] = sign;
    shelf.position.set(x, 0, 0.6);
    shelf.userData.choice = side;
    shelf.userData.tapHeight = 2.6;
    this.scene.add(shelf);
    return shelf;
  }

  bubble(big = '?') {
    ui.bubble({ big, pic: thingPicture(this.task?.id), onTap: () => this.replay(), passthrough: true });
  }

  /**
   * One question per step. drop: tap the thing (not scored: it can't be got wrong). sort: which shelf for what she saw.
   * guess: which shelf before it drops (a prediction, scored once). Each has its own item, so a slow drop is not her sort.
   */
  openQuestion(task, step) {
    const shelf = this.shelves[task.side];
    if (step === 'drop') {
      this.question('sorting', 'drop', {
        short: T.shallowsDrop,
        hint: () => { this.pulseUntil(this.thing, () => this.phase !== 'dropping'); return T.shallowsDrop(); },
        reveal: () => this.hint(this.thing, () => this.phase !== 'dropping'),
      }, { scored: false, options: 1 });
      return;
    }
    this.question('sorting', `${task.side}:${task.id}`, {
      short: T.shallowsAsk,
      hint: () => { hop(this.thing, 0.3); return T.lookCarefully(); }, // look at the thing again: where it is, or what it is
      reveal: () => this.hint(shelf, () => this.phase === 'solved' || this.phase === 'clearing'),
    }, { options: 2 });
  }

  tapShelves() {
    for (const side of ['float', 'sink']) this.tappable(this.shelves[side], () => this.tapShelf(side));
  }

  untapShelves() {
    for (const side of ['float', 'sink']) this.untap(this.shelves[side]);
  }

  tapShelf(side) {
    if (this.phase !== 'guessing' && this.phase !== 'sorting') return;
    this.poke();
    if (this.phase === 'guessing') this.phase = 'guessed';
    this.shelfResolve?.(side);
    this.shelfResolve = null;
  }

  tapDrop() {
    if (this.phase !== 'dropping') return;
    this.poke();
    this.phase = 'dropped';
    this.untap(this.thing);
    delete this.thing.userData.choice;
    this.correct('drop');
    this.dropResolve?.();
    this.dropResolve = null;
  }

  waitForShelf() {
    return new Promise((resolve) => { this.shelfResolve = resolve; });
  }

  splash() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, depthWrite: false });
    const geometry = new THREE.SphereGeometry(0.09, 6, 4);
    const drops = [];
    for (let i = 0; i < 12; i++) {
      const drop = new THREE.Mesh(geometry, material);
      drop.position.set(DROP_AT.x, SURFACE, DROP_AT.z);
      drop.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 1.6 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2);
      group.add(drop);
      drops.push(drop);
    }
    this.scene.add(group);
    animate(650, (t) => {
      const s = t * 0.65;
      for (const drop of drops) {
        drop.position.set(DROP_AT.x + drop.userData.v.x * s, SURFACE + drop.userData.v.y * s - 4.9 * s * s, DROP_AT.z + drop.userData.v.z * s);
      }
      material.opacity = 0.92 * (1 - t);
    }, ease.linear).then(() => {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    });
  }

  /** In it goes: a splash, then it rests at the surface line or sinks slowly to the sand. */
  async dropThing(task) {
    const to = DROP_AT.clone();
    const height = this.thing.userData.half ?? 0.5;
    to.y = task.side === 'float' ? SURFACE - height * 0.55 : BOTTOM + 0.02;
    const from = this.thing.position.clone();
    const entry = new THREE.Vector3(to.x, SURFACE - height * 0.3, to.z);
    await animate(380, (t) => {
      this.thing.position.lerpVectors(from, entry, t);
      this.thing.position.y += Math.sin(t * Math.PI) * 0.5;
    }, ease.in);
    if (!this.alive) return;
    sfx.bubble();
    this.splash();
    await animate(task.side === 'float' ? 500 : 1100, (t) => this.thing.position.lerpVectors(entry, to, t), task.side === 'float' ? ease.out : ease.inOut);
    if (!this.alive) return;
    this.thing.position.copy(to);
    if (task.side === 'float') {
      this.thing.userData.restY = to.y;
      this.bobbing.add(this.thing);
    }
  }

  async placeOnShelf(task) {
    const shelf = this.shelves[task.side];
    const i = this.shelfCount[task.side]++;
    const [x, y] = SLOTS[Math.min(i, SLOTS.length - 1)];
    const to = shelf.localToWorld(new THREE.Vector3(x, y, 0.35));
    const from = this.thing.position.clone();
    this.bobbing.delete(this.thing);
    const s0 = this.thing.scale.x, s1 = this.thing.userData.shelfScale;
    await animate(650, (t) => {
      this.thing.position.lerpVectors(from, to, t);
      this.thing.position.y += Math.sin(t * Math.PI) * 1.6;
      this.thing.scale.setScalar(s0 + (s1 - s0) * t);
    }, ease.inOut);
    if (!this.alive) return;
    shelf.attach(this.thing);
    this.thing.position.set(x, y, 0.35);
    this.thing.rotation.set(0, 0, 0);
    this.thing.scale.setScalar(s1);
    this.thing.userData.placed = true;
    sfx.pop();
  }

  /** Level 1: she drops it in and watches, then sorts what she saw. Only then is it said. */
  async watchRound(task) {
    this.phase = 'dropping';
    this.last = 'drop';
    this.thing.userData.choice = 'drop';
    this.tappable(this.thing, () => this.tapDrop());
    this.openQuestion(task, 'drop');
    this.bubble('💧');
    this.askAfter(this.talk, T.shallowsDrop());
    await new Promise((done) => { this.dropResolve = done; });
    if (!this.alive) return;
    const told = this.L.tell ? this.say(T.shallowsThing(task)) : null; // (a gentler run says it first)
    await this.dropThing(task);
    if (!this.alive) return;

    this.phase = 'sorting';
    this.last = task.side;
    this.openQuestion(task, 'sort');
    this.bubble();
    this.tapShelves();
    this.askAfter(told, T.shallowsAsk());
    for (;;) {
      const side = await this.waitForShelf();
      if (!this.alive) return;
      if (side === task.side) break;
      this.wrong(side, { obj: this.shelves[side] }); // "Nie, to nie ten." and the question again
    }
    this.untapShelves();
    this.phase = 'solved';
    this.correct(task.side);
    this.stopIdle();
    sfx.good();
    this.talk = this.say([this.praise(), ...T.shallowsThing(task)]);
    await this.placeOnShelf(task);
    if (!this.alive) return;
    this.success(this.shelves[task.side].position.clone().add(new THREE.Vector3(0, 3, 0)));
  }

  /** Levels 2 and 3: she guesses first. One guess, scored; then the water shows it either way. */
  async guessRound(task) {
    this.phase = 'guessing';
    this.last = task.side;
    this.openQuestion(task, 'guess');
    this.bubble();
    this.tapShelves();
    this.askAfter(this.talk, T.shallowsAsk());
    const guess = await this.waitForShelf();
    if (!this.alive) return;
    this.untapShelves();
    this.phase = 'revealed';
    const right = guess === task.side;
    if (right) this.correct(guess);
    else this.guessedWrong(guess);
    this.stopIdle();
    if (right) sfx.good();
    this.talk = this.say(right ? [this.praise(), ...T.shallowsThing(task), ...T.shallowsSurprise(task)] : [...T.shallowsLook(task), ...T.shallowsSurprise(task)]);
    await this.dropThing(task);
    if (!this.alive) return;
    await this.placeOnShelf(task);
    if (!this.alive || !right) return;
    this.success(this.shelves[task.side].position.clone().add(new THREE.Vector3(0, 3, 0)));
  }

  /**
   * A guess is one try: a wrong one is not tried again. It closes the question without a "no" (she is not punished for a
   * guess), and the run counts it as answered but not right first time.
   */
  guessedWrong(guess) {
    const ev = this.learn.wrong({ chosen: guess });
    this.learn.cancel();
    if (ev) this.answers.push({ ...ev, correct: true, firstTry: false });
  }

  async round(r) {
    this.plan ||= shallowsPlan(this.L);
    if (r === 0) {
      await this.say(T.shallowsStart());
      if (!this.alive) return;
    }
    const task = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r];
    this.task = task;
    this.phase = 'entering';
    this.thing = makeThing(task.id, this.hitMat);
    this.thing.position.copy(WAIT_AT);
    this.scene.add(this.thing);
    if (this.L.mode === 'watch') await this.watchRound(task);
    else await this.guessRound(task);
    if (!this.alive) return;
    this.phase = 'clearing';
    if (this.thing) this.untap(this.thing);
    this.untapShelves();
    this.bobbing.clear();
    this.thing = null;
    this.shelfResolve = null;
    this.dropResolve = null;
    this.last = null;
  }

  doneLine() { return T.shallowsDone(); }

  success(at) {
    super.success(null);
    if (at) sparkle(this, at, { count: 8 });
  }

  exit() {
    super.exit();
    if (this.thing) this.untap(this.thing);
    this.untapShelves();
    this.bobbing.clear();
    this.maps.forEach((map) => map.dispose());
    this.maps = [];
    this.mats.forEach((m) => m.dispose());
    this.mats = [];
    this.hitMat.dispose();
    this.portrait?.dispose();
    const roots = Object.values(this.shelves);
    if (this.thing && !this.thing.parent?.userData?.choice) roots.push(this.thing);
    for (const root of roots) if (root) disposeTree(root);
  }
}
