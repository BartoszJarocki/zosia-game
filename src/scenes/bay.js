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
const PAD_VIEW = { pos: new THREE.Vector3(0, 7, 17), look: new THREE.Vector3(0, 2, 0), minWidth: 13 };
const patch = (r, color) => mesh(new THREE.CircleGeometry(r, 36), mat(color, { roughness: 1 }), { y: 0.03, rx: -Math.PI / 2, shadow: false });

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
  g.add(patch(r, '#f4d88f'));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.92, 0.5, 32), mat('#6fcf62', { roughness: 1 }), { y: 0.28, shadow: false }));
  g.add(mesh(new THREE.SphereGeometry(r * 0.52, 20, 14), mat('#f3f6fb'), { y: 0.75, s: [1, 0.6, 1], shadow: false }));
  g.add(mesh(rbox(1.1, 0.85, 0.95, 0.1), mat('#fef3c7'), { y: 1.2, shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(0.85, 0.7, 4), mat('#ef4444'), { y: 1.95, ry: Math.PI / 4, shadow: false }));
  g.add(mesh(rbox(0.35, 0.5, 0.08, 0.04), mat('#92400e'), { y: 1.0, z: 0.5, shadow: false }));
  return g;
}

function makeBuoy(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#a5f3fc'));
  const bob = new THREE.Group();
  bob.add(mesh(new THREE.CylinderGeometry(0.34, 0.45, 0.9, 14), mat('#ef4444'), { y: 0.55, shadow: false }));
  bob.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 14), mat('#f8fafc'), { y: 0.68, shadow: false }));
  bob.add(mesh(new THREE.ConeGeometry(0.34, 0.5, 14), mat('#ef4444'), { y: 1.2, shadow: false }));
  bob.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), mat('#fbbf24', { emissive: '#f59e0b', emissiveIntensity: 0.5 }), { y: 1.52, shadow: false }));
  g.add(bob);
  g.userData.bob = bob;
  return g;
}

function makeShallows(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#fde68a'));
  const shimmer = mesh(new THREE.RingGeometry(r * 0.5, r * 0.96, 36),
    new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    { y: 0.08, rx: -Math.PI / 2, shadow: false });
  g.add(shimmer);
  const shells = [];
  for (const [x, z, s] of [[-0.5, 0.2, 0.22], [0.3, -0.4, 0.18], [0.7, 0.5, 0.16]]) {
    const shell = mesh(new THREE.SphereGeometry(0.3, 12, 8), mat('#fff7ed'), { x, y: 0.11, z, s: [s / 0.3, 0.4, s / 0.3], shadow: false });
    shells.push(shell);
    g.add(shell);
  }
  g.userData.shimmer = shimmer;
  g.userData.shells = shells;
  return g;
}

function makeSeal(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#e0f2fe'));
  g.add(mesh(new THREE.SphereGeometry(1.35, 20, 14), mat('#cbd5e1', { roughness: 0.9 }), { y: 0.35, s: [1.1, 0.7, 0.85], shadow: false }));
  g.add(mesh(new THREE.SphereGeometry(0.55, 18, 14), mat('#94a3b8', { roughness: 0.85 }), { y: 0.68, z: 0.25, s: [1, 1.25, 1], shadow: false }));
  g.add(mesh(new THREE.SphereGeometry(0.34, 16, 12), mat('#94a3b8', { roughness: 0.85 }), { y: 1.18, z: 0.42, shadow: false }));
  g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('#334155'), { y: 1.14, z: 0.73, shadow: false }));
  for (const x of [-0.12, 0.12]) g.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), mat('#0f172a'), { x, y: 1.26, z: 0.7, shadow: false }));
  const flippers = [];
  for (const side of [-1, 1]) {
    const flip = new THREE.Group();
    flip.position.set(side * 0.55, 0.45, 0.25);
    flip.add(mesh(new THREE.SphereGeometry(0.24, 12, 8), mat('#94a3b8', { roughness: 0.85 }), { s: [1.4, 0.35, 0.8], shadow: false }));
    g.add(flip);
    flippers.push(flip);
  }
  g.userData.flippers = flippers;
  return g;
}

function makeLighthouse(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#cbd5e1'));
  g.add(mesh(new THREE.SphereGeometry(1.7, 18, 12), mat('#a8a29e', { roughness: 0.95 }), { y: 0.1, s: [1.1, 0.55, 1], shadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.9, 4.2, 20), mat('#f8fafc', { roughness: 0.7 }), { y: 2.2, shadow: false }));
  for (const y of [1.1, 2.3, 3.5]) g.add(mesh(new THREE.CylinderGeometry(0.78 - y * 0.05, 0.86 - y * 0.05, 0.5, 20), mat('#ef4444'), { y, shadow: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.18, 20), mat('#475569'), { y: 4.4, shadow: false }));
  const lamp = mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.85, 18), new THREE.MeshStandardMaterial({ color: '#fff4c0', emissive: '#ffd84a', emissiveIntensity: 2.5, roughness: 0.4 }), { y: 4.95, shadow: false });
  g.add(lamp);
  g.add(mesh(new THREE.ConeGeometry(0.78, 0.7, 18), mat('#ef4444'), { y: 5.7, shadow: false }));
  g.userData.lamp = lamp;
  return g;
}

function bird() {
  const g = new THREE.Group();
  const white = mat('#f8fafc', { roughness: 0.8 });
  g.add(mesh(new THREE.SphereGeometry(0.25, 14, 10), white, { s: [1, 0.8, 1.5], shadow: false }));
  for (const side of [-1, 1]) g.add(mesh(new THREE.SphereGeometry(0.3, 12, 8), white, { x: side * 0.32, y: 0.05, s: [1.3, 0.25, 0.7], rz: side * 0.2, shadow: false }));
  g.add(mesh(new THREE.ConeGeometry(0.08, 0.22, 8), mat('#f59e0b'), { y: -0.02, z: 0.38, rx: Math.PI / 2, shadow: false }));
  return g;
}

function makeGulls(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#cbd5e1'));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 10), mat('#92400e'), { y: 1.1, shadow: false }));
  const birds = [];
  for (const [x, y, z] of [[-0.4, 2.5, 0], [0.5, 2.85, 0.25]]) {
    const b = bird();
    b.position.set(x, y, z);
    b.rotation.y = x * 0.6;
    g.add(b);
    birds.push(b);
  }
  g.userData.birds = birds;
  g.userData.birdHome = birds.map((b) => b.position.clone());
  return g;
}

function makeReef(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#fde68a'));
  const water = mesh(new THREE.RingGeometry(0.3, r * 0.98, 36),
    new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }),
    { y: 0.12, rx: -Math.PI / 2, shadow: false });
  g.add(water);
  const crab = new THREE.Group();
  crab.position.set(0, 0.2, 0);
  crab.add(mesh(new THREE.SphereGeometry(0.35, 14, 10), mat('#ef4444'), { s: [1.25, 0.6, 1], shadow: false }));
  for (const side of [-1, 1]) {
    crab.add(mesh(new THREE.SphereGeometry(0.18, 10, 8), mat('#ef4444'), { x: side * 0.48, y: 0.06, z: 0.25, s: [1.3, 0.8, 0.7], shadow: false }));
    crab.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#0f172a'), { x: side * 0.18, y: 0.18, z: 0.38, shadow: false }));
    for (let i = 0; i < 3; i++) crab.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38, 6), mat('#7f1d1d'), { x: side * 0.4, y: -0.08, z: -0.2 + i * 0.2, rz: side * 1.2, shadow: false }));
  }
  g.add(crab);
  const shell = star('#fb923c', 0.28, 0.08);
  shell.position.set(-0.8, 0.15, -0.4);
  shell.rotation.x = -Math.PI / 2;
  g.add(shell);
  g.userData.crab = crab;
  return g;
}

function makePort(r) {
  const g = new THREE.Group();
  g.add(patch(r, '#a5f3fc'));
  g.add(mesh(rbox(2.6, 0.24, 1.0, 0.08), mat('#b45309', { roughness: 0.9 }), { y: 0.35, shadow: false }));
  for (const x of [-1.1, 0, 1.1]) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), mat('#92400e'), { x, y: 0.05, z: 0.35, shadow: false }));
  const boats = [];
  for (const [x, color] of [[-0.75, '#ef4444'], [0.85, '#2563eb']]) {
    const b = new THREE.Group();
    b.add(mesh(rbox(0.8, 0.36, 1.1, 0.16), mat(color), { y: 0.25, shadow: false }));
    b.add(mesh(rbox(0.45, 0.4, 0.45, 0.1), mat('#f8fafc'), { y: 0.58, z: -0.15, shadow: false }));
    b.position.set(x, 0.15, 0.65);
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
    const water = makeWater({ repeat: 20, flow: [0.008, 0.005], scale: 0.42,
      stops: [[0, '#7ff0e6'], [0.35, '#4fd8e8'], [1, '#2bb8d8']], radial: true });
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
    this.cruiser.visible = true;
  }

  visitView(kind) {
    const { height } = BAY_LAYOUT[kind];
    const body = this.bodies[kind];
    const look = body.position.clone();
    look.y = Math.max(0.8, height * 0.45);
    const distance = Math.max(9, height * 3.6, BAY_LAYOUT[kind].r * 4);
    return { pos: look.clone().addScaledVector(FORWARD, distance), look, minWidth: Math.max(BAY_LAYOUT[kind].r * 3, height * 1.5) };
  }

  react() {
    const kind = this.visiting, body = this.bodies[kind], u = body.userData;
    if (kind === 'buoy') {
      sfx.ding();
      const start = body.rotation.z;
      animate(900, (t) => { body.rotation.z = start + Math.sin(t * Math.PI * 3) * 0.18 * (1 - t); });
    } else if (kind === 'shallows') {
      sfx.bubble();
      this.shimmerUntil = performance.now() + 1200;
      const start = u.shells.map((s) => s.scale.clone());
      animate(1000, (t) => {
        u.shells.forEach((s, i) => s.scale.copy(start[i]).multiplyScalar(1 + Math.sin(t * Math.PI * 4 + i) * 0.35));
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
      b.position.y = 0.15 + Math.sin(t * 2.4 + i) * k * 0.3;
    });
    const shimmer = this.bodies.shallows?.userData.shimmer;
    if (shimmer) shimmer.material.opacity = 0.28 + Math.sin(t * 2.4) * 0.07 + (now < (this.shimmerUntil || 0) ? Math.sin(t * 12) * 0.18 : 0);
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
    const water = makeWater({ repeat: 8, flow: [0.01, 0.006], scale: 0.45,
      stops: [[0, '#6fe6e0'], [1, '#2bb8d8']], radial: true });
    this.launchRoot.add(mesh(new THREE.PlaneGeometry(80, 60), water.material, { y: -0.3, rx: -Math.PI / 2, shadow: false }));
    this.launchRoot.add(mesh(new THREE.CylinderGeometry(8, 9, 0.7, 36), mat('#f4d88f', { roughness: 1 }), { y: -0.25, z: -4, shadow: false }));
    this.launchRoot.add(mesh(new THREE.CylinderGeometry(7.2, 7.8, 0.4, 36), mat('#6fcf62', { roughness: 1 }), { y: 0.1, z: -4.2, shadow: false }));
    this.launchRoot.add(mesh(rbox(3.2, 0.24, 5.2, 0.08), mat('#b45309', { roughness: 0.9 }), { y: 0.32, z: 2.3, shadow: false }));
    for (const x of [-1.4, 0, 1.4]) this.launchRoot.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), mat('#92400e'), { x, y: 0.05, z: 4.3, shadow: false }));
    this.cruiser.position.set(0, 1.05, 0.6);
    this.cruiser.scale.setScalar(2.2);
    this.crew = new THREE.Group();
    this.crew.userData.dynamic = true;
    this.girl = makeGirl();
    this.pup = makePup();
    this.crew.add(this.girl, this.pup);
    this.girl.position.set(-2.1, 0.35, 2.7);
    this.pup.position.set(-3.4, 0.35, 2.5);
    lifeJacket(this.girl.userData.parts.body, 0.36, 0.48, 0.35);
    lifeJacket(this.pup, 0.55, 0.5, 0.62);
    this.launchRoot.add(this.crew);
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
        who.position.lerpVectors(from[i], new THREE.Vector3(i ? 0.3 : -0.3, 1.85, 0.8), t);
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
      this.cruiser.position.z = 0.6 + t * 17;
      this.cruiser.position.y = 1.05 + Math.sin(t * Math.PI) * 1.4;
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
