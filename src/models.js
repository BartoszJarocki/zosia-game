import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeTree as natureTree } from './world/nature.js';

// Upgraded scenery lives in world/; these keep older call sites working.
export { makeLookout, makeHouse } from './world/props.js';
export { makeCloud } from './world/nature.js';
export const makeTree = (scale = 1) => natureTree({ scale });

// ---------- helpers ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts }));
  return matCache.get(key);
}

function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

const sphere = (r, seg = 24) => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
const cyl = (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg);
const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 3, r);

export function starShape(outer = 1, inner = 0.45, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

export function star(color = '#fde047', size = 0.3, depth = 0.08) {
  const g = new THREE.ExtrudeGeometry(starShape(size, size * 0.45), { depth, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  g.center();
  return mesh(g, mat(color, { roughness: 0.35, metalness: 0.3 }));
}

// ---------- Police cruiser (open top, so riders are visible) ----------
export function makeTruck() {
  const t = new THREE.Group();
  const blue = mat('#1e4fbf', { roughness: 0.4 });
  const white = mat('#f8fafc', { roughness: 0.4 });
  const glass = mat('#bfe6ff', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 });
  const tire = mat('#222');
  const hub = mat('#cbd5e1', { metalness: 0.5, roughness: 0.3 });
  const seatM = mat('#334155');

  t.add(mesh(rbox(1.6, 0.55, 2.8, 0.18), blue, { y: 0.6 }));
  t.add(mesh(rbox(1.62, 0.18, 2.82, 0.08), white, { y: 0.62 }));
  t.add(mesh(rbox(1.6, 0.3, 0.9, 0.14), blue, { y: 0.95, z: 0.95 })); // hood
  // windshield frame + glass
  t.add(mesh(rbox(1.5, 0.06, 0.08, 0.02), blue, { y: 1.55, z: 0.45 }));
  for (const x of [-0.72, 0.72]) t.add(mesh(rbox(0.07, 0.5, 0.07, 0.02), blue, { x, y: 1.3, z: 0.45 }));
  t.add(mesh(rbox(1.4, 0.45, 0.03, 0.01), glass, { y: 1.3, z: 0.45, shadow: false }));
  // seats
  for (const x of [-0.38, 0.38]) {
    t.add(mesh(rbox(0.6, 0.15, 0.6, 0.06), seatM, { x, y: 0.9, z: -0.3 }));
    t.add(mesh(rbox(0.6, 0.55, 0.14, 0.06), seatM, { x, y: 1.15, z: -0.65 }));
  }
  // roll bar with light bar
  for (const x of [-0.72, 0.72]) t.add(mesh(cyl(0.05, 0.05, 1.0, 10), white, { x, y: 1.35, z: -0.95 }));
  t.add(mesh(cyl(0.05, 0.05, 1.5, 10), white, { y: 1.85, z: -0.95, rz: Math.PI / 2 }));
  const red = mesh(rbox(0.55, 0.16, 0.26, 0.06), mat('#ef4444', { emissive: '#ef4444', emissiveIntensity: 0.3 }), { x: -0.3, y: 1.98, z: -0.95 });
  const blu = mesh(rbox(0.55, 0.16, 0.26, 0.06), mat('#3b82f6', { emissive: '#3b82f6', emissiveIntensity: 0.3 }), { x: 0.3, y: 1.98, z: -0.95 });
  red.material = red.material.clone();
  blu.material = blu.material.clone();
  t.add(red, blu);
  // badge stars on the doors
  for (const side of [-1, 1]) {
    const s = star('#fde047', 0.2, 0.04);
    s.position.set(side * 0.82, 0.62, -0.1);
    s.rotation.y = side * Math.PI / 2;
    t.add(s);
  }
  // headlights + bumper
  for (const x of [-0.52, 0.52]) t.add(mesh(sphere(0.12), mat('#fffbe6', { emissive: '#fff3b0', emissiveIntensity: 0.6 }), { x, y: 0.72, z: 1.4 }));
  t.add(mesh(rbox(1.7, 0.18, 0.2, 0.08), mat('#94a3b8', { metalness: 0.4, roughness: 0.3 }), { y: 0.38, z: 1.45 }));
  // wheels
  const wheels = [];
  for (const x of [-0.8, 0.8]) for (const z of [-0.9, 0.9]) {
    const w = new THREE.Group();
    w.position.set(x, 0.34, z);
    w.add(mesh(cyl(0.34, 0.34, 0.28), tire, { rz: Math.PI / 2 }));
    w.add(mesh(cyl(0.16, 0.16, 0.3), hub, { rz: Math.PI / 2 }));
    t.add(w);
    wheels.push(w);
  }
  // rider seats (local positions)
  t.userData.mergeOK = true; // wheels/lights are animated as groups or own materials
  t.userData.seats = [new THREE.Vector3(-0.38, 0.45, -0.3), new THREE.Vector3(0.38, 0.55, -0.3)];
  let flashing = false;
  t.userData.setFlashing = (on) => (flashing = on);
  t.userData.update = (time, speed = 0) => {
    wheels.forEach((w) => (w.rotation.x += speed));
    const phase = flashing ? Math.floor(time * 6) % 2 : -1;
    red.material.emissiveIntensity = phase === 0 ? 2.5 : 0.3;
    blu.material.emissiveIntensity = phase === 1 ? 2.5 : 0.3;
  };
  return t;
}

/** Put the girl + pup in the cruiser seats. */
export function seatRiders(truck, girl, pup) {
  const [a, b] = truck.userData.seats;
  girl.position.copy(a); girl.scale.setScalar(0.62); girl.rotation.set(0, 0, 0);
  pup.position.copy(b); pup.scale.setScalar(0.6); pup.rotation.set(0, 0, 0);
  truck.add(girl, pup);
}

export function pawBadge(color = '#dc2626') {
  const p = new THREE.Group();
  p.add(mesh(cyl(0.55, 0.55, 0.1, 32), mat('#ffffff'), { rx: Math.PI / 2 }));
  const m = mat(color);
  p.add(mesh(sphere(0.2), m, { y: -0.1, z: 0.05, s: [1.1, 0.9, 0.3] }));
  for (const [x, y] of [[-0.24, 0.12], [-0.08, 0.26], [0.08, 0.26], [0.24, 0.12]]) p.add(mesh(sphere(0.08), m, { x, y, z: 0.05, s: [1, 1.2, 0.3] }));
  return p;
}

export function makeKitten() {
  const k = new THREE.Group();
  const orange = mat('#fb923c');
  const cream = mat('#fff1e0');
  const black = mat('#1d130b', { roughness: 0.3 });
  const white = mat('#ffffff');
  k.add(mesh(sphere(0.32), orange, { y: 0.3, s: [1, 0.9, 1.2] }));
  k.add(mesh(sphere(0.2), cream, { y: 0.28, z: 0.2, s: [1, 1, 0.8] }));
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.2);
  k.add(head);
  head.add(mesh(sphere(0.3), orange));
  head.add(mesh(sphere(0.14), cream, { y: -0.08, z: 0.2, s: [1.2, 0.8, 0.8] }));
  for (const side of [-1, 1]) {
    head.add(mesh(new THREE.ConeGeometry(0.11, 0.22, 4), orange, { x: side * 0.18, y: 0.27, rz: side * -0.3 }));
    head.add(mesh(sphere(0.07), white, { x: side * 0.11, y: 0.04, z: 0.25 }));
    head.add(mesh(sphere(0.045), black, { x: side * 0.11, y: 0.04, z: 0.3 }));
  }
  head.add(mesh(sphere(0.035), mat('#f472b6'), { y: -0.04, z: 0.31 }));
  const tail = mesh(cyl(0.04, 0.06, 0.6, 8), orange, { y: 0.5, z: -0.35, rx: -0.5 });
  tail.userData.keep = true;
  k.add(tail);
  k.userData.idle = (t) => { tail.rotation.z = Math.sin(t * 5) * 0.4; head.rotation.z = Math.sin(t * 3) * 0.12; };
  return k;
}

export function makeBone(scale = 1) {
  const b = new THREE.Group();
  const m = mat('#f5e6c8', { roughness: 0.6 });
  b.add(mesh(cyl(0.07, 0.07, 0.5, 12), m, { rz: Math.PI / 2 }));
  for (const x of [-0.27, 0.27]) for (const y of [-0.07, 0.07]) b.add(mesh(sphere(0.09, 12), m, { x, y }));
  b.scale.setScalar(scale);
  return b;
}

export function makeCone() {
  const c = new THREE.Group();
  const orange = mat('#f97316');
  c.add(mesh(rbox(1, 0.12, 1, 0.04), orange, { y: 0.06 }));
  c.add(mesh(new THREE.ConeGeometry(0.4, 1.4, 24), orange, { y: 0.8 }));
  c.add(mesh(cyl(0.24, 0.3, 0.2, 24), mat('#ffffff'), { y: 0.75 }));
  c.add(mesh(cyl(0.13, 0.18, 0.15, 24), mat('#ffffff'), { y: 1.15 }));
  return c;
}

export { mesh, sphere, cyl, rbox };

// ---------- Name Train ----------
/** Little engine pulling `cars` flat wagons along +X. userData.slots = local spots for letter blocks. */
export function makeTrain(cars) {
  const t = new THREE.Group();
  const red = mat('#dc2626', { roughness: 0.4 });
  const black = mat('#1f2937', { roughness: 0.5 });
  const gold = mat('#fbbf24', { roughness: 0.3, metalness: 0.4 });
  const wheel = (x, z, r = 0.28) => {
    const w = mesh(cyl(r, r, 0.14, 20), black, { x, y: r, z, rx: Math.PI / 2, shadow: false });
    w.add(mesh(cyl(r * 0.45, r * 0.45, 0.16, 12), gold, { shadow: false }));
    return w;
  };
  const wheels = [];
  // engine at the front (+X)
  const engine = new THREE.Group();
  engine.add(mesh(rbox(1.7, 0.35, 1.1, 0.08), black, { y: 0.5 }));
  engine.add(mesh(cyl(0.42, 0.42, 1.1, 24), red, { x: 0.25, y: 1.0, rz: Math.PI / 2 }));
  engine.add(mesh(cyl(0.44, 0.44, 0.08, 24), gold, { x: 0.8, y: 1.0, rz: Math.PI / 2 }));
  engine.add(mesh(rbox(0.8, 1.0, 1.1, 0.1), red, { x: -0.45, y: 1.2 }));
  engine.add(mesh(rbox(0.95, 0.12, 1.25, 0.05), black, { x: -0.45, y: 1.76 }));
  engine.add(mesh(rbox(0.5, 0.4, 0.05, 0.04), mat('#bae6fd'), { x: -0.45, y: 1.35, z: 0.56 }));
  engine.add(mesh(cyl(0.12, 0.18, 0.5, 16), black, { x: 0.5, y: 1.6 }));
  engine.add(mesh(new THREE.ConeGeometry(0.4, 0.4, 4), mat('#fbbf24'), { x: 1.0, y: 0.45, rz: -Math.PI / 2, s: [1, 1, 1.6] }));
  for (const x of [-0.5, 0.45]) for (const z of [-0.55, 0.55]) { const w = wheel(x, z); engine.add(w); wheels.push(w); }
  t.add(engine);
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const p = mesh(sphere(0.15 + i * 0.05, 10), mat('#ffffff', { transparent: true, opacity: 0.8 }), { x: 0.5, y: 2 + i * 0.4, shadow: false });
    p.material = p.material.clone();
    engine.add(p);
    smoke.push(p);
  }
  // wagons behind (-X)
  const colors = ['#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#db2777', '#0891b2', '#ef4444'];
  const slots = [];
  for (let i = 0; i < cars; i++) {
    const x = -1.9 - i * 1.65;
    const car = new THREE.Group();
    car.position.x = x;
    car.add(mesh(rbox(1.45, 0.3, 1.1, 0.08), mat(colors[i % colors.length]), { y: 0.55 }));
    car.add(mesh(rbox(1.45, 0.1, 1.1, 0.04), mat('#fef3c7'), { y: 0.72 }));
    for (const wx of [-0.45, 0.45]) for (const z of [-0.55, 0.55]) { const w = wheel(wx, z, 0.22); car.add(w); wheels.push(w); }
    car.add(mesh(cyl(0.05, 0.05, 0.25, 8), black, { x: 0.8, y: 0.5, rz: Math.PI / 2 })); // coupling
    t.add(car);
    slots.push(new THREE.Vector3(x, 1.35, 0));
  }
  t.userData.slots = slots;
  t.userData.mergeOK = true;
  t.userData.update = (time, speed) => {
    wheels.forEach((w) => (w.rotation.y -= speed));
    smoke.forEach((p, i) => {
      const k = (time * 0.6 + i / smoke.length) % 1;
      p.position.set(0.5 - k * 0.8, 2 + k * 1.6, 0);
      p.scale.setScalar(0.6 + k * 1.4);
      p.material.opacity = 0.8 * (1 - k);
    });
  };
  return t;
}

// ---------- Balloon ----------
export function makeBalloon(color, labelTex) {
  const b = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.3 });
  const body = mesh(sphere(0.75, 32), skin, { s: [1, 1.18, 1] });
  b.add(body);
  b.add(mesh(new THREE.ConeGeometry(0.12, 0.18, 12), skin, { y: -0.92, rx: Math.PI }));
  b.add(mesh(cyl(0.012, 0.012, 1.8, 4), mat('#e5e7eb'), { y: -1.9, shadow: false }));
  if (labelTex) {
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false }));
    label.position.set(0, 0.05, 0.78);
    label.renderOrder = 2;
    b.add(label);
  }
  body.userData.keep = true; // animated on its own
  b.userData.body = body;
  b.userData.color = color;
  return b;
}

// ---------- Stepping stone ----------
export function makeStone(topTex) {
  const rock = mat('#9ca3af', { roughness: 0.9 });
  const top = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.7 });
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.4, 28), [rock, top, rock]);
  s.castShadow = s.receiveShadow = true;
  s.userData.top = top;
  return s;
}
