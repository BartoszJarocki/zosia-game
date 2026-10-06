// Buildings and props for Adventure Bay and the mission scenes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { star, pawBadge } from '../models.js';

const cache = new Map();
const std = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }));
  return cache.get(k);
};
const glass = () => std('#8fd8ff', { roughness: 0.05, metalness: 0.3, emissive: '#2a6fb0', emissiveIntensity: 0.25 });
function m(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s, shadow = true } = {}) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  if (s) Array.isArray(s) ? o.scale.set(...s) : o.scale.setScalar(s);
  o.castShadow = shadow; o.receiveShadow = shadow;
  return o;
}
const cyl = (a, b, h, n = 32) => new THREE.CylinderGeometry(a, b, h, n);
const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 3, r);
/** Triangular attic under a pitched roof. */
function gable(width, y0, height, depth, material) {
  const t = new THREE.Shape();
  t.moveTo(-width / 2, 0); t.lineTo(width / 2, 0); t.lineTo(0, height); t.lineTo(-width / 2, 0);
  const g = new THREE.ExtrudeGeometry(t, { depth, bevelEnabled: false });
  g.translate(0, y0, -depth / 2);
  return m(g, material);
}

// ---------- The Lookout ----------
/**
 * The Lookout. slide: 'spiral' (classic, ends on the base roof) or 'mission' (winds round the back,
 * keeps the front free for the glass elevator, and ends on the grass). The slide path is exposed
 * as g.slideCurve (local coordinates) so characters can ride it.
 */
export function makeLookout({ slide = 'spiral' } = {}) {
  const g = new THREE.Group();
  const white = std('#f3f6fb', { roughness: 0.45 });
  const grey = std('#cfd8e6', { roughness: 0.5 });
  const red = std('#e23b3b', { roughness: 0.4 });
  const blue = std('#1f55c9', { roughness: 0.4 });
  const yellow = std('#fcc419', { roughness: 0.35 });
  // base building
  g.add(m(cyl(3.1, 3.3, 2.2, 48), white, { y: 1.1 }));
  g.add(m(cyl(3.35, 3.35, 0.3, 48), red, { y: 2.3 }));
  g.add(m(cyl(3.0, 3.1, 0.5, 48), grey, { y: 2.65 }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    if (Math.abs(Math.sin(a / 2 - Math.PI / 2)) < 0.25) continue; // leave the front for the door
    const w = m(rbox(0.8, 0.8, 0.12, 0.08), glass(), { x: Math.sin(a) * 3.2, y: 1.3, z: Math.cos(a) * 3.2, ry: a });
    g.add(w);
  }
  g.add(m(rbox(1.8, 1.8, 0.3, 0.2), blue, { y: 0.9, z: 3.18 }));        // big door
  g.add(m(rbox(0.06, 1.7, 0.32, 0.02), std('#16338a'), { y: 0.9, z: 3.2 }));
  const doorPaw = pawBadge('#e23b3b'); doorPaw.position.set(0, 1.95, 3.3); doorPaw.scale.setScalar(0.6); g.add(doorPaw);
  // tower
  g.add(m(cyl(1.05, 1.3, 6.4, 40), white, { y: 5.9 }));
  g.add(m(rbox(0.55, 4.6, 0.3, 0.12), glass(), { y: 5.9, z: 1.15, rx: -0.035 }));    // window strip
  for (const y of [4.1, 7.6]) g.add(m(cyl(1.28, 1.28, 0.22, 40), red, { y: y - (y > 5 ? 0.25 : 0), s: [y > 5 ? 0.9 : 1, 1, y > 5 ? 0.9 : 1] }));
  const paw = pawBadge('#e23b3b'); paw.position.set(0, 8.4, 1.05); paw.scale.setScalar(1.3); g.add(paw);
  // observation pod
  g.add(m(cyl(2.6, 1.6, 0.9, 48), white, { y: 9.3 }));
  g.add(m(cyl(2.75, 2.75, 1.5, 48), glass(), { y: 10.45 }));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.add(m(rbox(0.14, 1.5, 0.14, 0.05), white, { x: Math.sin(a) * 2.76, y: 10.45, z: Math.cos(a) * 2.76 })); }
  g.add(m(cyl(2.95, 2.95, 0.28, 48), white, { y: 9.72 }));
  g.add(m(cyl(3.05, 2.95, 0.35, 48), white, { y: 11.3 }));
  // roof + periscope + antenna
  const roof = new THREE.SphereGeometry(3.05, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  g.add(m(roof, red, { y: 11.45, s: [1, 0.42, 1] }));
  g.add(m(cyl(0.35, 0.45, 0.6, 20), grey, { y: 12.9 }));
  g.add(m(cyl(0.06, 0.06, 1.6, 8), grey, { y: 13.9 }));
  const st = star('#fde047', 0.45, 0.14);
  st.material = std('#ffe066', { emissive: '#ffcc00', emissiveIntensity: 3.5, roughness: 0.3 });
  st.position.y = 14.9;
  st.userData.tick = (dt) => (st.rotation.y += dt * 1.5);
  g.add(st);
  const scope = new THREE.Group();
  scope.add(m(cyl(0.18, 0.18, 1.2, 12), blue, { y: 0.6 }));
  scope.add(m(cyl(0.2, 0.2, 0.7, 12), blue, { y: 1.2, z: 0.3, rx: Math.PI / 2 }));
  scope.add(m(cyl(0.22, 0.22, 0.05, 12), glass(), { y: 1.2, z: 0.66, rx: Math.PI / 2 }));
  scope.position.set(1.4, 12.2, 0.9);
  g.add(scope);
  // slide
  const pts = [];
  if (slide === 'mission') {
    // from the pod's right side, round the back, out over the left of the base and down to the grass
    const a0 = Math.PI / 2, a1 = Math.PI * 1.5 + 0.6;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = a0 + (a1 - a0) * t;
      pts.push(new THREE.Vector3(Math.sin(a) * 2.05, 9.2 - t * 5.7, Math.cos(a) * 2.05));
    }
    pts.push(new THREE.Vector3(-2.95, 3.15, 1.75), new THREE.Vector3(-3.8, 1.5, 2.25), new THREE.Vector3(-4.35, 0.5, 2.55), new THREE.Vector3(-4.9, 0.38, 2.75));
  } else {
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, a = t * Math.PI * 3.2 + 0.6;
      pts.push(new THREE.Vector3(Math.sin(a) * 2.0, 9.2 - t * 6.6, Math.cos(a) * 2.0));
    }
    pts.push(new THREE.Vector3(Math.sin(Math.PI * 3.2 + 0.6) * 3.2, 2.4, Math.cos(Math.PI * 3.2 + 0.6) * 3.2));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(m(new THREE.TubeGeometry(curve, 160, 0.28, 12, false), yellow));
  g.add(m(new THREE.TubeGeometry(curve, 160, 0.05, 6, false), std('#e8a70c'), { y: 0.25, shadow: false }));
  g.slideCurve = curve; // (not userData: the Lookout itself stays static scenery)
  return g;
}

// ---------- houses ----------
export function makeHouse(wall = '#fde68a', roof = '#ef4444', { chimney = true } = {}) {
  const h = new THREE.Group();
  const trim = std('#ffffff', { roughness: 0.5 });
  h.add(m(rbox(2.2, 1.8, 2, 0.1), std(wall), { y: 0.9 }));
  // pitched roof from two rounded slabs
  for (const side of [-1, 1]) h.add(m(rbox(1.5, 0.16, 2.4, 0.06), std(roof, { roughness: 0.55 }), { x: side * 0.6, y: 2.15, rz: side * -0.62 }));
  h.add(gable(2.1, 1.78, 0.75, 1.9, std(wall)));
  if (chimney) h.add(m(rbox(0.35, 0.8, 0.35, 0.05), std('#b45309'), { x: 0.6, y: 2.5, z: -0.4 }));
  // door + windows with frames + flower box
  h.add(m(rbox(0.6, 1.0, 0.1, 0.06), std('#8b4513'), { y: 0.5, z: 1.02 }));
  h.add(m(new THREE.SphereGeometry(0.04, 8, 6), std('#fbbf24', { metalness: 0.5 }), { x: 0.18, y: 0.5, z: 1.09, shadow: false }));
  for (const x of [-0.65, 0.65]) {
    h.add(m(rbox(0.56, 0.56, 0.08, 0.05), trim, { x, y: 1.15, z: 1.02 }));
    h.add(m(rbox(0.44, 0.44, 0.1, 0.04), glass(), { x, y: 1.15, z: 1.03 }));
    h.add(m(rbox(0.6, 0.14, 0.2, 0.04), std('#92400e'), { x, y: 0.82, z: 1.1 }));
    for (let i = 0; i < 3; i++) h.add(m(new THREE.SphereGeometry(0.07, 8, 6), std(['#f472b6', '#fde047', '#f87171'][i]), { x: x - 0.18 + i * 0.18, y: 0.93, z: 1.12, shadow: false }));
  }
  return h;
}

/** Chase's pup house: blue with a red roof and a big paw badge. */
export function makePupHouse() {
  const h = new THREE.Group();
  h.add(m(rbox(3, 2.2, 2.6, 0.18), std('#2f66d8'), { y: 1.1 }));
  for (const side of [-1, 1]) h.add(m(rbox(2.1, 0.22, 3.1, 0.1), std('#e23b3b'), { x: side * 0.82, y: 2.75, rz: side * -0.7 }));
  h.add(gable(2.9, 2.18, 1.1, 2.5, std('#2f66d8')));
  const door = new THREE.Shape();
  door.moveTo(-0.6, 0); door.lineTo(-0.6, 0.9); door.absarc(0, 0.9, 0.6, Math.PI, 0, true); door.lineTo(0.6, 0);
  h.add(m(new THREE.ShapeGeometry(door), std('#0e1f4d'), { y: 0.02, z: 1.31 }));
  const paw = pawBadge('#e23b3b'); paw.position.set(0, 2.55, 1.35); paw.scale.setScalar(0.75); h.add(paw);
  return h;
}

// ---------- small props ----------
export function makeFence(length = 6, color = '#ffffff') {
  const f = new THREE.Group();
  const w = std(color, { roughness: 0.6 });
  const n = Math.round(length / 0.45);
  const post = rbox(0.18, 0.9, 0.08, 0.04);
  for (let i = 0; i <= n; i++) {
    const p = m(post, w, { x: -length / 2 + (i * length) / n, y: 0.45 });
    f.add(p);
    f.add(m(new THREE.ConeGeometry(0.13, 0.16, 4), w, { x: p.position.x, y: 0.97, ry: Math.PI / 4, s: [1, 1, 0.45] }));
  }
  for (const y of [0.3, 0.68]) f.add(m(rbox(length + 0.1, 0.1, 0.06, 0.03), w, { y, z: -0.06 }));
  return f;
}

export function makeBench() {
  const b = new THREE.Group();
  const wood = std('#b7773f'), iron = std('#374151', { metalness: 0.4, roughness: 0.4 });
  for (let i = 0; i < 3; i++) b.add(m(rbox(1.8, 0.07, 0.16, 0.03), wood, { y: 0.48, z: -0.18 + i * 0.18 }));
  for (let i = 0; i < 2; i++) b.add(m(rbox(1.8, 0.14, 0.06, 0.03), wood, { y: 0.72 + i * 0.2, z: -0.3, rx: -0.15 }));
  for (const x of [-0.75, 0.75]) b.add(m(rbox(0.07, 0.5, 0.5, 0.02), iron, { x, y: 0.25 }));
  return b;
}

export function makeLamp() {
  const l = new THREE.Group();
  const iron = std('#1f2937', { metalness: 0.5, roughness: 0.35 });
  l.add(m(cyl(0.12, 0.16, 0.2, 12), iron, { y: 0.1 }));
  l.add(m(cyl(0.05, 0.06, 2.6, 10), iron, { y: 1.4 }));
  l.add(m(new THREE.SphereGeometry(0.22, 16, 12), std('#fff6d6', { emissive: '#ffe9a8', emissiveIntensity: 3 }), { y: 2.85 }));
  l.add(m(new THREE.ConeGeometry(0.28, 0.2, 12), iron, { y: 3.1 }));
  return l;
}

export function makeWindmill() {
  const w = new THREE.Group();
  w.add(m(cyl(0.7, 1.2, 4.2, 20), std('#f4ede1'), { y: 2.1 }));
  w.add(m(new THREE.ConeGeometry(0.95, 1.1, 20), std('#e23b3b'), { y: 4.75 }));
  w.add(m(rbox(0.6, 0.9, 0.1, 0.05), std('#8b4513'), { y: 0.45, z: 1.08 }));
  const hub = new THREE.Group();
  hub.position.set(0, 3.9, 0.95);
  hub.add(m(new THREE.SphereGeometry(0.2, 12, 10), std('#6b4423')));
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    arm.add(m(rbox(0.1, 2.2, 0.06, 0.03), std('#6b4423'), { y: 1.15 }));
    arm.add(m(rbox(0.55, 1.7, 0.03, 0.02), std('#fffaf0'), { x: 0.3, y: 1.35 }));
    hub.add(arm);
  }
  hub.userData.tick = (dt) => (hub.rotation.z -= dt * 0.8);
  w.add(hub);
  return w;
}

export function makeLighthouse() {
  const l = new THREE.Group();
  for (let i = 0; i < 5; i++) l.add(m(cyl(0.95 - i * 0.1, 1.05 - i * 0.1, 1.2, 24), std(i % 2 ? '#e23b3b' : '#ffffff'), { y: 0.6 + i * 1.2 }));
  l.add(m(cyl(0.7, 0.7, 0.9, 20), std('#fff4c0', { emissive: '#ffd84a', emissiveIntensity: 3.5 }), { y: 6.5 }));
  l.add(m(new THREE.ConeGeometry(0.85, 0.8, 20), std('#e23b3b'), { y: 7.35 }));
  const beam = m(new THREE.CylinderGeometry(0.05, 1.2, 9, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    { y: 6.5, rz: Math.PI / 2, shadow: false });
  beam.geometry.translate(0, 4.5, 0);
  const pivot = new THREE.Group();
  pivot.position.y = 0; pivot.add(beam);
  pivot.userData.tick = (dt) => (pivot.rotation.y += dt * 0.8);
  l.add(pivot);
  return l;
}

export function makeBoat(color = '#ef4444') {
  const b = new THREE.Group();
  const hull = new THREE.Shape();
  hull.moveTo(-1.3, 0.4); hull.quadraticCurveTo(-1.2, -0.35, 0, -0.4); hull.quadraticCurveTo(1.2, -0.35, 1.5, 0.45); hull.lineTo(-1.3, 0.4);
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 0.9, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08 });
  hg.translate(0, 0, -0.45);
  b.add(m(hg, std(color)));
  b.add(m(cyl(0.04, 0.04, 2.2, 8), std('#8b5a2b'), { y: 1.4 }));
  const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(0, 1.9); sail.lineTo(1.1, 0.05); sail.lineTo(0, 0);
  b.add(m(new THREE.ShapeGeometry(sail), std('#ffffff', { side: THREE.DoubleSide }), { x: 0.05, y: 0.45 }));
  return b;
}

export function makePlatform(length = 10) {
  const p = new THREE.Group();
  p.add(m(rbox(length, 0.5, 2.2, 0.08), std('#d6d3d1'), { y: 0.25 }));
  p.add(m(rbox(length, 0.06, 0.25, 0.02), std('#fcd34d'), { y: 0.52, z: 1.0 }));
  return p;
}

export function makeStationHouse() {
  const s = makeHouse('#fecaca', '#1f55c9', { chimney: false });
  const clock = new THREE.Group();
  clock.add(m(cyl(0.35, 0.35, 0.08, 24), std('#ffffff'), { rx: Math.PI / 2 }));
  clock.add(m(rbox(0.04, 0.24, 0.02, 0.01), std('#111827'), { y: 0.1, z: 0.05 }));
  clock.add(m(rbox(0.18, 0.04, 0.02, 0.01), std('#111827'), { x: 0.08, z: 0.05 }));
  clock.position.set(0, 1.9, 1.05);
  s.add(clock);
  return s;
}

export function makeLilyPad() {
  const g = new THREE.Group();
  const pad = new THREE.CircleGeometry(0.5, 20, 0.3, Math.PI * 1.8);
  g.add(m(pad, std('#3f9e3f', { side: THREE.DoubleSide }), { rx: -Math.PI / 2, y: 0.06, shadow: false }));
  if (Math.random() < 0.5) g.add(m(new THREE.SphereGeometry(0.12, 10, 8), std('#f9a8d4'), { y: 0.14, s: [1, 0.6, 1] }));
  return g;
}

export function makeReeds(n = 7) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const h = 1 + Math.random() * 0.9;
    const x = (Math.random() - 0.5) * 0.9, z = (Math.random() - 0.5) * 0.6;
    g.add(m(cyl(0.02, 0.03, h, 5), std('#4d7c0f'), { x, y: h / 2, z, rz: (Math.random() - 0.5) * 0.2 }));
    if (i % 2) g.add(m(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), std('#7c4a1e'), { x, y: h, z }));
  }
  return g;
}

export function makeHydrant() {
  const h = new THREE.Group();
  const red = std('#dc2626', { roughness: 0.4 });
  h.add(m(cyl(0.18, 0.22, 0.7, 14), red, { y: 0.35 }));
  h.add(m(new THREE.SphereGeometry(0.19, 14, 10), red, { y: 0.72, s: [1, 0.8, 1] }));
  h.add(m(cyl(0.08, 0.08, 0.5, 10), red, { y: 0.5, rz: Math.PI / 2 }));
  return h;
}
