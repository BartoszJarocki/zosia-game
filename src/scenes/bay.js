import * as THREE from 'three';
import { animate, ease, hop, wait, camera, renderer } from '../engine.js';
import { mat, mesh, rbox, star } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { makeCloud, makeHills } from '../world/nature.js';
import { makeWater } from '../world/water.js';
import { say, sfx, hush, unlockAudio } from '../audio.js';
import { SEA_LINES, SEA_TO, SEA_PASS, SEA_INVITE, SEA_FACTS } from '../lang/pl.js';
import { PLACES, placesIn } from '../places.js';
import { mapDecision, suggestStop } from '../session/map.js';
import { spaceHud, boatHud } from '../ui.js';
import { AreaMap, fitView } from './area-map.js';
import { BAY_LAYOUT, SEA_ORDER, checkLayout } from '../levels/sea.js';
export { MOVES, nextState, flightStops } from './area-map.js';
export { BAY_LAYOUT as LAYOUT, SEA_ORDER as ROAD_ORDER, checkLayout } from '../levels/sea.js';

const TAU = Math.PI * 2;

function paint(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.sea = true;
  return t;
}

const face = (() => {
  const aim = new THREE.PerspectiveCamera();
  aim.position.set(0, 54, 38);
  aim.lookAt(0, 0, 0);
  return aim.quaternion.clone();
})();
const RIGHT = new THREE.Vector3(1, 0, 0).applyQuaternion(face);
const UP = new THREE.Vector3(0, 1, 0).applyQuaternion(face);
const FORWARD = new THREE.Vector3(0, 0, 1).applyQuaternion(face);
const FLAT_RIGHT = new THREE.Vector3(RIGHT.x, 0, RIGHT.z).normalize();
const FLAT_FORWARD = new THREE.Vector3(FORWARD.x, 0, FORWARD.z).normalize();
const PAD_VIEW = { pos: new THREE.Vector3(0, 7, 16), look: new THREE.Vector3(0, 1.8, -1.6), minWidth: 13 };
const VISIT_ANGLE = THREE.MathUtils.degToRad(30);
const WATER_Y = -0.3;
const LAUNCH = {
  island: { x: 0, z: -8, r: 5 },
  boat: { x: 2.3, z: 1.4, y: -0.55, scale: 1.6 },
};
const patch = (r, color) => {
  const m = mesh(new THREE.CircleGeometry(r, 36), mat(color, { roughness: 1 }), { y: 0.03, rx: -Math.PI / 2, shadow: false });
  m.userData.patch = true;
  return m;
};

function smoothWater(opts) {
  const water = makeWater(opts);
  water.material.normalScale.setScalar(0.12);
  water.material.clearcoatNormalScale.setScalar(0.08);
  water.material.roughness = 0.32;
  return water;
}

const boxPoints = (center, x, y, z = 0) => {
  const points = [];
  for (const dx of [-x, x]) for (const dy of [-y, y]) for (const dz of [-z, z]) points.push(new THREE.Vector3(dx, dy, dz).applyQuaternion(face).add(center));
  return points;
};
const discPoints = (kind) => {
  const { at, r } = BAY_LAYOUT[kind], edge = r + 0.18;
  return boxPoints(new THREE.Vector3(at[0], 0, at[2]), edge, 0.15, edge);
};
const starPosition = (kind) => new THREE.Vector3(BAY_LAYOUT[kind].at[0], BAY_LAYOUT[kind].height + 1.5, BAY_LAYOUT[kind].at[2]);
const parkedPosition = (kind) => {
  const { at, r } = BAY_LAYOUT[kind];
  return new THREE.Vector3(at[0], 1, at[2]).addScaledVector(FLAT_RIGHT, r + 2.2);
};

export function mapPoints(here = 'island', suggested = null) {
  const points = SEA_ORDER.flatMap((kind) => {
    const { at, r, height } = BAY_LAYOUT[kind];
    return [...discPoints(kind), ...boxPoints(new THREE.Vector3(at[0], height / 2, at[2]), r, height / 2, r)];
  });
  points.push(...boxPoints(parkedPosition(here), 1.4, 1.5, 1.7));
  if (suggested && PLACES[suggested]?.stop !== false) points.push(...boxPoints(starPosition(suggested), 1.1, 1.1, 0.2));
  return points;
}

export function mapView(width, height, here = 'island', suggested = null, fov = 42) {
  return fitView(mapPoints(here, suggested), width, height, face, FORWARD, fov);
}

function makeIsland(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#a5f3fc'));
  const base = new THREE.Group();
  base.add(mesh(new THREE.CylinderGeometry(r * 0.82, r, 0.55, 32), mat('#f4d88f', { roughness: 1 }), { y: 0.3, shadow: false }));
  base.add(mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.78, 0.5, 32), mat('#6fcf62', { roughness: 1 }), { y: 0.75, shadow: false }));
  g.add(base);
  const palm = new THREE.Group();
  palm.position.set(r * 0.05, 0.9, 0);
  palm.add(mesh(new THREE.CylinderGeometry(r * 0.055, r * 0.085, r * 0.9, 10), mat('#92400e', { roughness: 0.9 }), { y: r * 0.45, rz: 0.08, shadow: false }));
  const fronds = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const frond = mesh(new THREE.SphereGeometry(r * 0.3, 10, 8), mat('#22c55e', { roughness: 1 }), {
      x: Math.cos(a) * r * 0.32, y: r * 0.92, z: Math.sin(a) * r * 0.32, s: [1.5, 0.2, 0.55], ry: -a, rz: 0.16, shadow: false,
    });
    frond.userData.dynamic = true;
    palm.add(frond);
    fronds.push(frond);
  }
  g.add(palm);
  g.userData.fronds = fronds;
  return g;
}

function makeBuoy(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#a5f3fc'));
  const bob = new THREE.Group();
  bob.add(mesh(new THREE.CylinderGeometry(r * 0.72, r, r * 1.1, 18), mat('#ef4444'), { y: r * 0.55, shadow: false }));
  bob.add(mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, r * 0.2, 18), mat('#f8fafc'), { y: r * 0.6, shadow: false }));
  bob.add(mesh(new THREE.ConeGeometry(r * 0.72, r * 0.55, 18), mat('#ef4444'), { y: r * 1.35, shadow: false }));
  const bell = new THREE.Group();
  bell.position.y = r * 1.62;
  bell.add(mesh(new THREE.CylinderGeometry(r * 0.05, r * 0.05, r * 0.28, 8), mat('#fbbf24'), { y: r * 0.14, shadow: false }));
  bell.add(mesh(new THREE.SphereGeometry(r * 0.18, 14, 10), mat('#fbbf24', { metalness: 0.3, roughness: 0.35 }), { y: r * 0.3, s: [1, 0.85, 1], shadow: false }));
  bob.add(bell);
  g.add(bob);
  g.userData.bob = bob;
  g.userData.bell = bell;
  return g;
}

function makeShallows(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#fde68a'));
  const shimmer = mesh(new THREE.RingGeometry(r * 0.45, r * 0.96, 36),
    new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    { y: 0.08, rx: -Math.PI / 2, shadow: false });
  shimmer.userData.patch = true;
  g.add(shimmer);
  const ball = new THREE.Group();
  ball.position.set(-r * 0.52, r * 0.45, -r * 0.15);
  ball.add(mesh(new THREE.SphereGeometry(r * 0.45, 20, 14), mat('#f8fafc', { roughness: 0.5 }), { shadow: false }));
  for (const [i, color] of ['#ef4444', '#2563eb', '#f59e0b'].entries()) {
    ball.add(mesh(new THREE.TorusGeometry(r * 0.45, r * 0.05, 8, 24), mat(color),
      { rx: i === 1 ? Math.PI / 2 : 0, ry: i === 2 ? Math.PI / 2 : 0, shadow: false }));
  }
  g.add(ball);
  const duck = new THREE.Group();
  duck.position.set(r * 0.52, r * 0.16, r * 0.1);
  duck.rotation.y = -0.35;
  duck.add(mesh(new THREE.SphereGeometry(r * 0.36, 18, 12), mat('#facc15'), { y: r * 0.26, s: [1.3, 0.8, 1], shadow: false }));
  duck.add(mesh(new THREE.SphereGeometry(r * 0.24, 16, 12), mat('#facc15'), { y: r * 0.62, z: r * 0.24, shadow: false }));
  duck.add(mesh(new THREE.ConeGeometry(r * 0.1, r * 0.22, 10), mat('#f97316'), { y: r * 0.6, z: r * 0.5, rx: Math.PI / 2, shadow: false }));
  for (const x of [-r * 0.07, r * 0.07]) duck.add(mesh(new THREE.SphereGeometry(r * 0.025, 8, 6), mat('#0f172a'), { x, y: r * 0.68, z: r * 0.44, shadow: false }));
  g.add(duck);
  g.userData.shimmer = shimmer;
  g.userData.toys = [ball, duck];
  return g;
}

function makeSeal(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#7dd3fc'));
  const base = new THREE.Group();
  base.add(mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.98, r * 0.28, 28), mat('#44403c', { roughness: 1 }), { y: r * 0.16, shadow: false }));
  g.add(base);
  const grey = mat('#94a3b8', { roughness: 0.9 });
  const seal = new THREE.Group();
  seal.position.y = r * 0.3;
  seal.add(mesh(new THREE.SphereGeometry(r * 0.55, 20, 14), grey, { y: r * 0.16, s: [1.35, 0.62, 0.95], shadow: false }));
  seal.add(mesh(new THREE.SphereGeometry(r * 0.24, 18, 14), grey, { y: r * 0.44, z: r * 0.34, s: [1, 1.15, 1], shadow: false }));
  seal.add(mesh(new THREE.SphereGeometry(r * 0.14, 16, 12), grey, { y: r * 0.7, z: r * 0.46, shadow: false }));
  seal.add(mesh(new THREE.SphereGeometry(r * 0.045, 10, 8), mat('#334155'), { y: r * 0.67, z: r * 0.58, shadow: false }));
  for (const x of [-r * 0.06, r * 0.06]) seal.add(mesh(new THREE.SphereGeometry(r * 0.03, 8, 6), mat('#0f172a'), { x, y: r * 0.73, z: r * 0.56, shadow: false }));
  const flippers = [];
  for (const side of [-1, 1]) {
    const flip = new THREE.Group();
    flip.position.set(side * r * 0.48, r * 0.18, r * 0.16);
    flip.add(mesh(new THREE.SphereGeometry(r * 0.18, 12, 8), grey, { s: [1.4, 0.35, 0.8], shadow: false }));
    seal.add(flip);
    flippers.push(flip);
  }
  g.add(seal);
  g.userData.flippers = flippers;
  return g;
}

function makeLighthouse(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#bae6fd'));
  const base = new THREE.Group();
  base.add(mesh(new THREE.SphereGeometry(r * 0.85, 20, 14), mat('#a8a29e', { roughness: 0.95 }), { y: 0.12, s: [1.18, 0.55, 1], shadow: false }));
  base.add(mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.41, r * 1.95, 20), mat('#f8fafc', { roughness: 0.7 }), { y: r * 1.02, shadow: false }));
  g.add(base);
  const bands = new THREE.Group();
  for (const y of [0.5, 1.05, 1.6]) bands.add(mesh(new THREE.CylinderGeometry(r * (0.36 - y * 0.045), r * (0.4 - y * 0.045), r * 0.23, 20), mat('#ef4444'), { y: r * y, shadow: false }));
  g.add(bands);
  g.add(mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, r * 0.1, 20), mat('#475569'), { y: r * 2.05, shadow: false }));
  const lamp = mesh(new THREE.CylinderGeometry(r * 0.27, r * 0.27, r * 0.4, 18), new THREE.MeshStandardMaterial({ color: '#fff4c0', emissive: '#ffd84a', emissiveIntensity: 2.5, roughness: 0.4 }), { y: r * 2.3, shadow: false });
  g.add(lamp);
  g.add(mesh(new THREE.ConeGeometry(r * 0.36, r * 0.33, 18), mat('#ef4444'), { y: r * 2.65, shadow: false }));
  g.userData.lamp = lamp;
  return g;
}

function bird(scale = 1) {
  const g = new THREE.Group();
  const white = mat('#f8fafc', { roughness: 0.8 });
  g.add(mesh(new THREE.SphereGeometry(0.2, 14, 10), white, { s: [1, 0.8, 1.5], shadow: false }));
  for (const side of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.38, 12, 8), white, { x: side * 0.36, y: 0.03, s: [1.5, 0.16, 0.55], rz: side * 0.28, shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 8), mat('#f59e0b'), { y: -0.01, z: 0.3, rx: Math.PI / 2, shadow: false }));
  g.scale.setScalar(scale);
  return g;
}

function makeGulls(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#a5f3fc'));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.9, r * 0.28, 24), mat('#57534e', { roughness: 1 }), { y: r * 0.16, shadow: false }));
  const birds = [];
  const spots = [[-r * 0.42, r * 0.82, r * 0.05], [r * 0.4, r * 1.02, r * 0.25], [0, r * 1.18, -r * 0.12]];
  for (const [x, y, z] of spots) {
    const b = bird(r * 0.65);
    b.position.set(x, y, z);
    b.rotation.y = x * 0.4;
    g.add(b);
    birds.push(b);
  }
  g.userData.birds = birds;
  g.userData.birdHome = birds.map((b) => b.position.clone());
  return g;
}

function makeReef(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#67e8f9'));
  const coral = new THREE.Group();
  const colors = ['#fb7185', '#fb923c', '#f472b6'];
  for (const [i, color] of colors.entries()) {
    const x = (i - 1) * r * 0.58;
    const h = r * (0.55 + (i % 2) * 0.25);
    coral.add(mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.12, h, 8), mat(color), { x, y: h * 0.5, z: (i - 1) * r * 0.2, rz: (i - 1) * 0.25, shadow: false }));
    for (const side of [-1, 1]) coral.add(mesh(new THREE.CylinderGeometry(r * 0.05, r * 0.08, h * 0.6, 8), mat(color), { x: x + side * r * 0.24, y: h * 0.75, z: (i - 1) * r * 0.2, rz: side * 0.65, shadow: false }));
    coral.add(mesh(new THREE.SphereGeometry(r * 0.11, 10, 8), mat(color), { x, y: h, z: (i - 1) * r * 0.2, shadow: false }));
  }
  g.add(coral);
  const crab = new THREE.Group();
  crab.position.set(0, r * 0.18, r * 0.5);
  crab.add(mesh(new THREE.SphereGeometry(r * 0.24, 14, 10), mat('#ef4444'), { s: [1.25, 0.6, 1], shadow: false }));
  for (const side of [-1, 1]) {
    crab.add(mesh(new THREE.SphereGeometry(r * 0.12, 10, 8), mat('#ef4444'), { x: side * r * 0.32, y: r * 0.04, z: r * 0.16, s: [1.3, 0.8, 0.7], shadow: false }));
    crab.add(mesh(new THREE.SphereGeometry(r * 0.04, 8, 6), mat('#0f172a'), { x: side * r * 0.12, y: r * 0.13, z: r * 0.24, shadow: false }));
    for (let i = 0; i < 3; i++) crab.add(mesh(new THREE.CylinderGeometry(r * 0.02, r * 0.02, r * 0.26, 6), mat('#7f1d1d'), { x: side * r * 0.28, y: -r * 0.06, z: -r * 0.14 + i * r * 0.14, rz: side * 1.2, shadow: false }));
  }
  g.add(crab);
  const shell = star('#fb923c', r * 0.12, 0.05);
  shell.position.set(-r * 0.55, 0.12, -r * 0.4);
  shell.rotation.x = -Math.PI / 2;
  g.add(shell);
  g.userData.crab = crab;
  return g;
}

function makePort(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#7dd3fc'));
  const base = new THREE.Group();
  base.add(mesh(rbox(r * 2.05, r * 0.18, r * 0.42, 0.05), mat('#b45309', { roughness: 0.9 }), { y: r * 0.3, z: -r * 0.1, shadow: false }));
  for (const x of [-r * 0.8, 0, r * 0.8]) base.add(mesh(new THREE.CylinderGeometry(r * 0.05, r * 0.05, r * 0.5, 8), mat('#92400e'), { x, y: r * 0.04, z: -r * 0.1, shadow: false }));
  g.add(base);
  const boats = [];
  for (const [i, x] of [-r * 0.62, 0, r * 0.62].entries()) {
    const b = new THREE.Group();
    b.add(mesh(rbox(r * 0.42, r * 0.24, r * 0.62, 0.1), mat(['#ef4444', '#2563eb', '#f59e0b'][i]), { y: r * 0.36, shadow: false }));
    b.add(mesh(rbox(r * 0.22, r * 0.26, r * 0.3, 0.06), mat('#f8fafc'), { y: r * 0.58, z: -r * 0.08, shadow: false }));
    b.position.set(x, 0.1, r * 0.5);
    g.add(b);
    boats.push(b);
  }
  g.userData.boats = boats;
  return g;
}

const BUILD = {
  island: makeIsland, buoy: makeBuoy, shallows: makeShallows, seal: makeSeal,
  lighthouse: makeLighthouse, gulls: makeGulls, reef: makeReef, port: makePort,
};

function portraitTexture() {
  return paint(128, 128, (c, w, h) => {
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2f6db0'); bg.addColorStop(1, '#173c74');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f6c9a8'; c.beginPath(); c.arc(42, 68, 22, 0, TAU); c.fill();
    c.fillStyle = '#6b3a1e'; c.beginPath(); c.arc(42, 58, 23, Math.PI, TAU); c.fill();
    c.fillStyle = '#22c55e'; c.fillRect(58, 46, 12, 6);
    c.fillStyle = '#3b2414'; c.beginPath(); c.arc(34, 69, 3, 0, TAU); c.arc(50, 69, 3, 0, TAU); c.fill();
    c.fillStyle = '#cf8a45'; c.beginPath(); c.arc(88, 72, 20, 0, TAU); c.fill();
    c.fillStyle = '#5b3216'; c.beginPath(); c.moveTo(72, 58); c.lineTo(80, 42); c.lineTo(86, 58); c.fill();
    c.beginPath(); c.moveTo(90, 58); c.lineTo(101, 40); c.lineTo(106, 58); c.fill();
    c.fillStyle = '#1f55c9'; c.fillRect(72, 48, 32, 7);
    c.fillStyle = '#140c07'; c.beginPath(); c.arc(81, 72, 3, 0, TAU); c.arc(96, 72, 3, 0, TAU); c.fill();
  });
}

function makeCruiser() {
  const g = new THREE.Group();
  g.add(mesh(rbox(1.5, 0.62, 2.9, 0.24), mat('#1e4fbf', { roughness: 0.45 }), { y: 0.4, shadow: false }));
  g.add(mesh(rbox(1.3, 0.18, 2.5, 0.06), mat('#f8fafc', { roughness: 0.5 }), { y: 0.72, shadow: false }));
  g.add(mesh(rbox(1.05, 0.85, 1.0, 0.16), mat('#f8fafc', { roughness: 0.5 }), { y: 1.15, z: -0.4, shadow: false }));
  g.add(mesh(rbox(1.08, 0.16, 1.05, 0.05), mat('#ef4444'), { y: 1.6, z: -0.4, shadow: false }));
  const window = mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ color: '#8edbff' }), { y: 1.18, z: 0.115, shadow: false });
  g.add(window);
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 24), mat('#fbbf24', { metalness: 0.3 }), { y: 1.18, z: 0.13, shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(0.16, 0.35, 10), mat('#fbbf24'), { y: 1.85, z: -0.35, shadow: false }));
  g.add(mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20), mat('#f97316'), { x: 0.77, y: 0.55, z: 0.2, rz: Math.PI / 2, shadow: false }));
  g.userData.window = window;
  return g;
}

function lifeJacket(parent, radius, height, y) {
  const g = new THREE.Group();
  g.position.y = y;
  g.add(mesh(new THREE.CylinderGeometry(radius, radius * 1.06, height, 20, 1, true), mat('#f97316', { side: THREE.DoubleSide }), { shadow: false }));
  g.add(mesh(new THREE.TorusGeometry(radius * 0.96, 0.045, 8, 20), mat('#fde047'), { y: height * 0.34, rx: Math.PI / 2, shadow: false }));
  parent.add(g);
  return g;
}

const SEA = {
  kind: 'sea-map',
  area: 'sea',
  home: 'island',
  order: SEA_ORDER,
  layout: BAY_LAYOUT,
  lines: SEA_LINES,
  to: SEA_TO,
  pass: SEA_PASS,
  facts: SEA_FACTS,
  invite: SEA_INVITE,
  decide: mapDecision,
  suggest: (session, road, here, visited, games) => suggestStop(session, road, here, visited, games, 'island'),
};

export class Bay extends AreaMap {
  constructor(game, opts = {}) {
    super(game, SEA, opts);
  }

  addBackdrop() {
    this.scene.background = new THREE.Color('#8fdcff');
    this.scene.add(new THREE.HemisphereLight('#f2fbff', '#6fb7a3', 1.6));
    const sun = new THREE.DirectionalLight('#fff2cf', 2.1);
    sun.position.set(-12, 28, 18);
    this.scene.add(sun);
    const water = smoothWater({ repeat: 20, flow: [0.008, 0.005], scale: 0.42,
      stops: [[0, '#8ff7ee'], [0.4, '#5fe6f0'], [1, '#45d9e8']], radial: true });
    const sea = mesh(new THREE.PlaneGeometry(170, 150), water.material, { y: -0.35, z: -3, rx: -Math.PI / 2, shadow: false });
    sea.userData.tick = water.update;
    this.scene.add(sea);
    const hills = makeHills({ radius: 58, count: 7, height: [4, 9], color: '#5cbf5a', seed: 8, trees: false });
    hills.position.y = -1.6;
    this.scene.add(hills);
    for (let i = 0; i < 2; i++) {
      const cloud = makeCloud({ seed: i + 12, scale: 1.7 });
      cloud.position.set(i ? 15 : -12, 13 + i * 4, -8 - i * 6);
      this.scene.add(cloud);
    }
  }

  orient() { return { face: face.clone(), right: RIGHT.clone(), up: UP.clone() }; }

  makeRoad(curve) {
    const g = new THREE.Group();
    g.userData.bakeInside = true;
    const red = mat('#ef4444'), white = mat('#f8fafc');
    const len = curve.getLength();
    let i = 0;
    for (let d = 1.2; d < len; d += 3.1, i++) {
      const p = curve.getPointAt(d / len);
      if (SEA_ORDER.some((kind) => Math.hypot(p.x - BAY_LAYOUT[kind].at[0], p.z - BAY_LAYOUT[kind].at[2]) < BAY_LAYOUT[kind].r + 0.8)) continue;
      const color = i % 2 ? red : white;
      g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.55, 10), color, { x: p.x, y: 0.28, z: p.z, shadow: false }));
      g.add(mesh(new THREE.ConeGeometry(0.18, 0.3, 10), color, { x: p.x, y: 0.7, z: p.z, shadow: false }));
    }
    return g;
  }

  makeStop(kind) {
    const { at, r, height } = BAY_LAYOUT[kind];
    const g = BUILD[kind](r);
    g.position.set(at[0], 0, at[2]);
    g.userData.foot = r;
    g.userData.top = height;
    return g;
  }

  makeVehicle() {
    this.cruiser = makeCruiser();
    this.cruiser.userData.dynamic = true;
    this.vehicle = this.cruiser;
    this.scene.add(this.cruiser);
    this.crewTex = portraitTexture();
  }

  onVehicleReady() {
    this.cruiser.userData.window.material.map = this.crewTex;
    this.cruiser.userData.window.material.color.set('#ffffff');
    this.cruiser.userData.window.material.needsUpdate = true;
  }

  startLaunch() {
    this.map.visible = false;
    this.buildLaunch();
    this.prepareBoarding();
  }

  padView() { return PAD_VIEW; }

  viewFor(width, height, here, suggested) { return mapView(width, height, here, suggested, camera.fov); }

  parkedPosition(kind) { return parkedPosition(kind); }

  suggestionPosition(kind) { return starPosition(kind); }

  positionVehicle(index) {
    this.routeIndex = index;
    const t = Math.min(0.999, index / (this.order.length - 1));
    this.curve.getPoint(t, this.cruiser.position);
    this.cruiser.position.y += 1.05;
    const tangent = this.curve.getTangentAt(t);
    this.heading = Math.atan2(tangent.x, tangent.z);
  }

  rotateVehicle() { this.cruiser.rotation.set(0, this.heading || 0, 0); }

  parkVehicle() {
    const index = Math.max(0, this.order.indexOf(this.at));
    const t = Math.min(0.999, index / (this.order.length - 1));
    const tangent = this.curve.getTangentAt(t);
    this.vehicle.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
    this.vehicle.scale.setScalar(this.parkScale());
    this.stopFlight();
    this.vehicle.position.copy(this.parkedPosition(this.at));
  }

  parkScale() { return 1.25; }

  startFlight() {}
  stopFlight() {}

  shrinkVehicle(t) { this.vehicle.scale.setScalar(1.25 - t * 0.55); }

  resetVehicleLook() {
    this.cruiser.userData.window.material.map = this.crewTex;
    this.cruiser.userData.window.material.color.set('#ffffff');
  }

  hideOtherStops(kind) {
    this.road.visible = false;
    Object.entries(this.bodies).forEach(([k, g]) => { g.visible = k === kind; });
    this.cruiser.visible = false;
  }

  visitView(kind) {
    const { height, r } = BAY_LAYOUT[kind];
    const body = this.bodies[kind];
    const look = body.position.clone();
    look.y = Math.max(0.8, height * 0.45);
    const distance = Math.max(6.8, height * 2.7, r * 2.6);
    const side = FLAT_RIGHT.clone().multiplyScalar(0.82).addScaledVector(FLAT_FORWARD, 0.57).normalize();
    const pos = look.clone().addScaledVector(side, Math.cos(VISIT_ANGLE) * distance);
    pos.y += Math.sin(VISIT_ANGLE) * distance;
    return { pos, look, minWidth: Math.max(r * 2.4, height * 1.6) };
  }

  react() {
    const kind = this.visiting, body = this.bodies[kind], u = body.userData;
    if (kind === 'buoy') {
      sfx.ding();
      const start = u.bob.rotation.z, bell = u.bell.rotation.x;
      animate(900, (t) => {
        u.bob.rotation.z = start + Math.sin(t * Math.PI * 3) * 0.2 * (1 - t);
        u.bell.rotation.x = bell + Math.sin(t * Math.PI * 6) * 0.55 * (1 - t);
      });
    } else if (kind === 'shallows') {
      sfx.bubble();
      this.shimmerUntil = performance.now() + 1200;
      const start = u.toys.map((toy) => toy.rotation.y);
      animate(1000, (t) => {
        u.toys.forEach((toy, i) => { toy.rotation.y = start[i] + Math.sin(t * Math.PI * 3 + i) * 0.9 * (1 - t); });
      });
    } else if (kind === 'seal') {
      sfx.pop();
      hop(body, 0.18, 500);
      const start = u.flippers.map((f) => f.rotation.z);
      animate(900, (t) => {
        u.flippers.forEach((f, i) => { f.rotation.z = start[i] + Math.sin(t * Math.PI * 6 + i * Math.PI) * 0.6 * (1 - t); });
      });
    } else if (kind === 'lighthouse') {
      sfx.ding();
      const lamp = u.lamp.material, base = lamp.emissiveIntensity;
      animate(1600, (t) => { lamp.emissiveIntensity = Math.max(0, Math.sin(t * Math.PI * 4)) * 6 + base; });
      lamp.emissiveIntensity = base;
    } else if (kind === 'gulls') {
      sfx.whistle();
      const home = u.birdHome.map((p) => p.clone());
      animate(1800, (t) => {
        u.birds.forEach((b, i) => {
          const a = t * TAU;
          b.position.set(home[i].x + Math.cos(a + i * 1.7) * 2.4, home[i].y + Math.sin(a) * 1.5, home[i].z + Math.sin(a + i * 1.7) * 1.4);
          b.rotation.y = -a;
        });
      });
    } else if (kind === 'reef') {
      sfx.bubble();
      const start = u.crab.position.x;
      animate(1200, (t) => { u.crab.position.x = start + Math.sin(t * Math.PI * 4) * 0.75; });
    } else if (kind === 'port') {
      sfx.toot();
      this.portJoyUntil = performance.now() + 1400;
    } else if (kind === 'island') {
      sfx.pop();
      this.palmUntil = performance.now() + 1200;
    } else {
      hop(body, 0.2, 500);
    }
  }

  showHud() {
    spaceHud({ visiting: this.state === 'visiting', onHome: () => this.returnHome(), onBack: () => this.backToMap(), backIcon: '⛵' });
  }

  animateWorld(dt, t, now) {
    const buoy = this.bodies.buoy?.userData.bob;
    if (buoy) buoy.position.y = Math.sin(t * 2.2) * 0.09;
    const port = this.bodies.port?.userData;
    if (port) port.boats.forEach((b, i) => {
      const k = now < (this.portJoyUntil || 0) ? 0.18 : 0.04;
      b.rotation.z = Math.sin(t * 3 + i) * k;
      b.position.y = 0.1 + Math.sin(t * 2.4 + i) * k * 0.3;
    });
    const shimmer = this.bodies.shallows?.userData.shimmer;
    if (shimmer) shimmer.material.opacity = 0.28 + Math.sin(t * 2.4) * 0.07 + (now < (this.shimmerUntil || 0) ? Math.sin(t * 12) * 0.18 : 0);
    const fronds = this.bodies.island?.userData.fronds;
    if (fronds) {
      const k = now < (this.palmUntil || 0) ? 0.22 : 0.05;
      fronds.forEach((f, i) => { f.rotation.z = 0.16 + Math.sin(t * (k > 0.1 ? 8 : 1.3) + i) * k; });
    }
  }

  releaseWorld() {
    this.launchUi?.remove();
    this.crewTex?.dispose();
  }

  buildLaunch() {
    this.launchRoot = new THREE.Group();
    this.launchRoot.userData.bakeInside = true;
    this.scene.add(this.launchRoot);
    this.scene.background.set('#9fe8ff');
    const water = smoothWater({ repeat: 8, flow: [0.01, 0.006], scale: 0.45,
      stops: [[0, '#8ff7ee'], [0.5, '#5fe6f0'], [1, '#45d9e8']], radial: true });
    this.launchRoot.add(mesh(new THREE.PlaneGeometry(90, 70), water.material, { y: WATER_Y, rx: -Math.PI / 2, shadow: false }));
    const island = LAUNCH.island;
    this.launchRoot.add(mesh(new THREE.CylinderGeometry(island.r, island.r * 1.08, 0.7, 36), mat('#f4d88f', { roughness: 1 }), { y: WATER_Y + 0.05, z: island.z, shadow: false }));
    this.launchRoot.add(mesh(new THREE.CylinderGeometry(island.r * 0.72, island.r * 0.78, 0.5, 36), mat('#6fcf62', { roughness: 1 }), { y: WATER_Y + 0.2, z: island.z - 0.6, shadow: false }));
    this.launchRoot.add(mesh(rbox(2.0, 0.22, 7.6, 0.06), mat('#b45309', { roughness: 0.9 }), { y: WATER_Y + 0.44, z: -1.8, shadow: false }));
    for (const x of [-0.9, 0.9]) for (const z of [-4.4, -2.2, 0.2, 1.9]) {
      this.launchRoot.add(mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8), mat('#92400e'), { x, y: WATER_Y + 0.2, z, shadow: false }));
    }
    this.cruiser.position.set(LAUNCH.boat.x, LAUNCH.boat.y, LAUNCH.boat.z);
    this.cruiser.scale.setScalar(LAUNCH.boat.scale);
    this.cruiser.rotation.set(0, 0, 0);
    this.crew = new THREE.Group();
    this.crew.userData.dynamic = true;
    this.girl = makeGirl();
    this.pup = makePup();
    this.crew.add(this.girl, this.pup);
    this.girl.position.set(-1.2, 0.35, -6.2);
    this.pup.position.set(-2.5, 0.35, -6.0);
    lifeJacket(this.girl.userData.parts.body, 0.36, 0.48, 0.35);
    lifeJacket(this.pup, 0.55, 0.5, 0.62);
    this.launchRoot.add(this.crew);
    this.launchRoot.userData.water = WATER_Y;
    this.launchRoot.userData.island = { ...island };
    this.launchRoot.userData.pier = { x: 0, z: -1.8, length: 7.6, width: 2 };
    this.launchUi = boatHud();
  }

  async prepareBoarding() {
    await wait(800);
    if (!this.alive) return;
    await Promise.all([say(SEA_LINES.jackets), hop(this.girl, 0.3, 600), hop(this.pup, 0.3, 600)]);
    if (!this.alive) return;
    const from = [this.girl.position.clone(), this.pup.position.clone()];
    await Promise.all([say(SEA_LINES.board), animate(2200, (t) => {
      [this.girl, this.pup].forEach((who, i) => {
        who.position.lerpVectors(from[i], new THREE.Vector3(i ? LAUNCH.boat.x + 0.35 : LAUNCH.boat.x - 0.35, 1.35, LAUNCH.boat.z - 0.1), t);
        who.position.y += Math.sin(t * Math.PI) * 0.55;
        who.scale.setScalar(1 - t * 0.8);
        who.userData.idle(performance.now() / 1000);
      });
    })]);
    if (!this.alive) return;
    this.crew.visible = false;
    this.cruiser.userData.window.material.map = this.crewTex;
    this.cruiser.userData.window.material.color.set('#ffffff');
    this.cruiser.userData.window.material.needsUpdate = true;
    this.launchUi.start(() => {
      if (!this.alive || this.state !== 'launch') return;
      unlockAudio();
      this.inviteAt = null;
      this.launchUi.remove();
      this.castOff();
    });
    this.inviteAt = performance.now() + 10000;
    say(SEA_LINES.start);
  }

  async castOff() {
    say(SEA_LINES.cast);
    sfx.toot();
    const sky = new THREE.Color('#9fe8ff'), bay = new THREE.Color('#8fdcff');
    await animate(4200, (t) => {
      this.cruiser.position.z = LAUNCH.boat.z + t * 17;
      this.cruiser.position.y = LAUNCH.boat.y + t * 0.9 + Math.sin(t * Math.PI) * 1.4;
      this.view.look.lerpVectors(PAD_VIEW.look, new THREE.Vector3(0, 7, -9), t);
      this.view.pos.lerpVectors(PAD_VIEW.pos, new THREE.Vector3(0, 27, 12), t);
      this.scene.background.copy(sky).lerp(bay, t);
    }, ease.inOut);
    if (!this.alive) return;
    await wait(500);
    if (!this.alive) return;
    const { pawWipe } = await import('../fx/transition.js');
    await pawWipe(() => {
      if (!this.alive) return;
      this.launchRoot.visible = false;
      this.map.visible = true;
      this.parkVehicle();
      this.changeState('waiting');
      this.showHud();
      this.direct(SEA_LINES.map);
    });
  }
}
