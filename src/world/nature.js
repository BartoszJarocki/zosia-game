// Soft, toy-like nature: blobby trees that sway, waving grass, flowers, bushes, rocks,
// fluffy clouds, distant hills, butterflies and birds.
// Anything with userData.tick(dt, t) or userData.sway is animated automatically by the Stage.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- helpers ----------
export const windTime = { value: 0 };
function rng(seed) {
  seed = (Math.abs(Math.floor(seed * 1000)) % 2147483645) + 1; // any number → valid positive seed
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const mats = new Map();
function leafMat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.85 }));
  return mats.get(color);
}
/** Leaves that sway in the wind on the GPU: no per-tree work on the CPU, so all trees can be merged. */
function swayMat(color) {
  const k = 'sway' + color;
  if (!mats.has(k)) {
    const mt = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.85 });
    mt.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wpS = modelMatrix * vec4(position, 1.0);
        float lift = clamp(wpS.y - 0.8, 0.0, 4.0);
        float ph = wpS.x * 0.35 + wpS.z * 0.27;
        transformed.x += sin(uTime * 1.3 + ph) * 0.028 * lift;
        transformed.z += cos(uTime * 1.05 + ph) * 0.018 * lift;`);
    };
    mt.customProgramCacheKey = () => 'sway';
    mats.set(k, mt);
  }
  return mats.get(k);
}
const std = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  return mats.get(k);
};
function m(geo, material, x = 0, y = 0, z = 0, s = 1, shadow = true) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  Array.isArray(s) ? o.scale.set(...s) : o.scale.setScalar(s);
  o.castShadow = shadow; o.receiveShadow = shadow;
  return o;
}

/** Lumpy smooth ball, darker underneath and lighter on top (baked into vertex colours). */
const blobCache = new Map();
export function blobGeometry(seed = 1, { detail = 2, lump = 0.09, flatBottom = -0.35, dark = 0.68, light = 1.12 } = {}) {
  const key = [seed, detail, lump, flatBottom, dark, light].join();
  if (blobCache.has(key)) return blobCache.get(key);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const r = rng(seed * 9973 + 7);
  const waves = Array.from({ length: 6 }, () => ({ d: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), f: 2 + r() * 3, p: r() * 6.28 }));
  const pos = g.attributes.position, v = new THREE.Vector3();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let d = 1;
    for (const w of waves) d += (lump / 2) * Math.sin(v.dot(w.d) * w.f + w.p);
    v.multiplyScalar(d);
    if (v.y < flatBottom) v.y = flatBottom + (v.y - flatBottom) * 0.35;
    pos.setXYZ(i, v.x, v.y, v.z);
    const k = dark + (light - dark) * THREE.MathUtils.clamp((v.y + 1) / 2, 0, 1);
    colors.set([k, k, k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.userData.shared = true;
  blobCache.set(key, g);
  return g;
}

// ---------- trees ----------
const LEAVES = ['#4cc25a', '#3fae4f', '#62cf55', '#35a04a'];
const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 1.4, 9);
trunkGeo.translate(0, 0.7, 0);
trunkGeo.userData.shared = true;
let birchTex = null;
function birchMat() {
  if (!birchTex) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    const c = cv.getContext('2d');
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, 64, 256);
    c.fillStyle = '#3b3530';
    for (let i = 0; i < 22; i++) { c.fillRect(Math.random() * 64, Math.random() * 256, 8 + Math.random() * 18, 2 + Math.random() * 4); }
    birchTex = new THREE.CanvasTexture(cv); birchTex.colorSpace = THREE.SRGBColorSpace;
  }
  return std('#ffffff', { map: birchTex });
}

/** type: 'round' | 'pine' | 'birch' | 'apple' | 'random' */
export function makeTree({ type = 'random', scale = 1, seed = Math.floor(Math.random() * 1000) } = {}) {
  const r = rng(seed + 1);
  if (type === 'random') type = r() < 0.5 ? 'round' : r() < 0.45 ? 'pine' : r() < 0.6 ? 'birch' : 'apple';
  const t = new THREE.Group();
  const canopy = new THREE.Group();
  const leaf = swayMat(LEAVES[Math.floor(r() * LEAVES.length)]);
  if (type === 'pine') {
    t.add(m(trunkGeo, std('#7a4b2a'), 0, 0, 0, [0.9, 0.6, 0.9]));
    canopy.position.y = 0.7;
    const pm = swayMat('#2f8f4e');
    [[1.05, 1.2, 0.3], [0.82, 1.05, 1.0], [0.56, 0.9, 1.6]].forEach(([rad, h, y], i) => {
      const cone = new THREE.ConeGeometry(rad, h, 14, 3);
      const cols = new Float32Array(cone.attributes.position.count * 3);
      for (let k = 0; k < cone.attributes.position.count; k++) { const c = 0.72 + 0.4 * ((cone.attributes.position.getY(k) + h / 2) / h); cols.set([c, c, c], k * 3); }
      cone.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      canopy.add(m(cone, pm, 0, y + h / 2, 0));
    });
  } else {
    const birch = type === 'birch';
    t.add(m(trunkGeo, birch ? birchMat() : std('#8a5a33'), 0, 0, 0, birch ? [0.75, 1.25, 0.75] : 1));
    canopy.position.y = birch ? 1.75 : 1.35;
    const blobs = birch
      ? [[0.62, 0, 0.35, 0], [0.5, 0.35, 0, 0.15], [0.48, -0.32, 0.1, -0.1], [0.42, 0.05, 0.75, 0.05]]
      : [[0.95, 0, 0.35, 0], [0.7, 0.55, 0.05, 0.12], [0.66, -0.52, 0.12, -0.1], [0.55, 0.1, 0.95, -0.05]];
    blobs.forEach(([rad, x, y, z], i) => canopy.add(m(blobGeometry(seed % 5 + i), birch ? swayMat('#8fd65a') : leaf, x, y, z, rad * (0.9 + r() * 0.2))));
    if (type === 'apple') {
      const red = std('#e53935', { roughness: 0.35 });
      const ag = new THREE.SphereGeometry(0.09, 10, 8);
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, e = r() * 0.9 - 0.2;
        canopy.add(m(ag, red, Math.cos(a) * Math.cos(e) * 0.95, 0.35 + Math.sin(e) * 0.95, Math.sin(a) * Math.cos(e) * 0.95, 1, false));
      }
    }
  }
  t.add(canopy);
  t.scale.setScalar(scale * (0.9 + r() * 0.25));
  t.rotation.y = r() * 6.28;
  return t;
}

export function makeBush({ scale = 1, color = '#3fae4f', flowers = true, seed = Math.floor(Math.random() * 1000) } = {}) {
  const r = rng(seed + 3);
  const b = new THREE.Group();
  [[0.75, 0, 0.45, 0], [0.55, 0.55, 0.32, 0.1], [0.55, -0.55, 0.3, -0.1]].forEach(([rad, x, y, z], i) =>
    b.add(m(blobGeometry(seed % 5 + i + 11, { flatBottom: -0.5 }), leafMat(color), x, y, z, rad)));
  if (flowers) {
    const fc = ['#ffffff', '#f472b6', '#fde047', '#f87171'][Math.floor(r() * 4)];
    const fg = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 8; i++) {
      const a = r() * Math.PI * 2, e = r() * 1.1;
      b.add(m(fg, std(fc, { roughness: 0.5 }), Math.cos(a) * Math.cos(e) * 0.72, 0.45 + Math.sin(e) * 0.7, Math.sin(a) * Math.cos(e) * 0.72, 1, false));
    }
  }
  b.scale.setScalar(scale);
  return b;
}

export function makeRock({ scale = 1, seed = Math.floor(Math.random() * 1000) } = {}) {
  const g = blobGeometry(seed % 7 + 40, { detail: 2, lump: 0.28, flatBottom: -0.2, dark: 0.62, light: 1.0 });
  const rock = m(g, leafMat('#8f8a84'), 0, 0.15 * scale, 0, [scale, scale * 0.65, scale * 0.9]);
  rock.rotation.y = seed;
  return rock;
}

export function makeCloud({ scale = 1, seed = Math.floor(Math.random() * 1000) } = {}) {
  const r = rng(seed + 5);
  const c = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, emissive: '#dfefff', emissiveIntensity: 0.35 });
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.75 + (r() - 0.5) * 0.3;
    const rad = 0.75 + Math.sin((i / (n - 1)) * Math.PI) * 0.55 + r() * 0.2;
    c.add(m(blobGeometry(i % 5 + 20, { flatBottom: -0.1, lump: 0.05, dark: 0.82, light: 1.05 }), white, x, rad * 0.2, (r() - 0.5) * 0.5, rad, false));
  }
  c.scale.setScalar(scale);
  return c;
}

/** Big smooth hills on a ring (horizon). */
export function makeHills({ radius = 70, count = 12, color = '#5cbf5a', height = [6, 14], seed = 3, trees = true } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + r() * 0.3;
    const w = 14 + r() * 16, h = height[0] + r() * (height[1] - height[0]);
    const hill = m(blobGeometry(i % 5 + 30, { detail: 3, lump: 0.05, flatBottom: 0, dark: 0.8, light: 1.1 }), leafMat(i % 3 ? color : '#4fae55'),
      Math.cos(a) * radius, -h * 0.05, Math.sin(a) * radius, [w, h, w * 0.7], false);
    hill.lookAt(0, 0, 0);
    g.add(hill);
    if (trees) {
      for (let k = 0; k < 5; k++) {
        const t = makeTree({ type: r() < 0.5 ? 'pine' : 'round', scale: 1.6 + r(), seed: i * 10 + k });
        const aa = a + (r() - 0.5) * 0.1, rr = radius - w * 0.25 + (r() - 0.5) * 6;
        t.position.set(Math.cos(aa) * rr, 0, Math.sin(aa) * rr);
        t.traverse((o) => { o.castShadow = false; });
        g.add(t);
      }
    }
  }
  return g;
}

// ---------- grass that waves in the wind ----------
let bladeGeo = null;
function blade() {
  if (bladeGeo) return bladeGeo;
  const w = 0.05, h = 0.3;
  const verts = [-w, 0, 0, w, 0, 0, -w * 0.6, h * 0.5, 0, w * 0.6, h * 0.5, 0, 0, h, 0];
  const cols = [0.82, 0.82, 0.82, 0.82, 0.82, 0.82, 0.98, 0.98, 0.98, 0.98, 0.98, 0.98, 1.18, 1.18, 1.18];
  bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  bladeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(Array(5).fill([0, 1, 0]).flat(), 3));
  bladeGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  bladeGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  bladeGeo.userData.shared = true;
  return bladeGeo;
}
let grassMat = null;
function grassMaterial() {
  if (grassMat) return grassMat;
  grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hh = position.y / 0.3;
      vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sw = sin(uTime * 1.7 + wp.x * 0.45 + wp.z * 0.3) * 0.13 + sin(uTime * 3.3 + wp.x * 1.9) * 0.04;
      transformed.x += sw * hh * hh;
      transformed.z += sw * 0.4 * hh * hh;`);
  };
  return grassMat;
}

/** Scatter grass blades + flowers in a disc, keeping clear of busy spots. */
export function makeMeadowDetail({ radius = 20, avoid = 0, center = [0, 0], blades = 4000, flowers = 120, keepOut = [], reject = () => false, seed = 11 } = {}) {
  const r = rng(seed);
  const [cx, cz] = center;
  const ok = (x, z) => Math.hypot(x - cx, z - cz) > avoid && keepOut.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr) && !reject(x, z);
  const spot = () => {
    for (let i = 0; i < 12; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (ok(x, z)) return [x, z];
    }
    return null;
  };
  const g = new THREE.Group();
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  if (blades) {
    const grass = new THREE.InstancedMesh(blade(), grassMaterial(), blades);
    const greens = ['#5fc24f', '#4fb146', '#72cf58', '#56b84c'].map((c) => new THREE.Color(c));
    let n = 0;
    for (let i = 0; i < blades; i++) {
      const at = spot();
      if (!at) continue;
      p.set(at[0], 0, at[1]);
      e.set((r() - 0.5) * 0.3, r() * Math.PI, (r() - 0.5) * 0.3);
      q.setFromEuler(e);
      const k = 0.7 + r() * 0.8;
      s.set(k, k * (0.6 + r() * 0.6), k);
      M.compose(p, q, s);
      grass.setMatrixAt(n, M);
      grass.setColorAt(n, greens[n % greens.length]);
      n++;
    }
    grass.count = n;
    grass.frustumCulled = false;
    g.add(grass);
  }
  if (flowers) {
    const fs = new THREE.Shape();
    for (let i = 0; i <= 5; i++) {
      const a0 = (i / 5) * Math.PI * 2, a1 = ((i + 0.5) / 5) * Math.PI * 2, a2 = ((i + 1) / 5) * Math.PI * 2;
      if (i === 0) fs.moveTo(Math.cos(a0) * 0.03, Math.sin(a0) * 0.03);
      if (i < 5) fs.quadraticCurveTo(Math.cos(a1) * 0.2, Math.sin(a1) * 0.2, Math.cos(a2) * 0.03, Math.sin(a2) * 0.03);
    }
    const flat = new THREE.ShapeGeometry(fs, 3);
    flat.rotateX(-Math.PI / 2);
    const petals = [flat];
    const petalGeo = mergeGeometries(petals);
    const heads = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide }), flowers);
    const centers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4).scale(1, 0.6, 1), new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.5 }), flowers);
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#2f8f3a' }), flowers);
    const cols = ['#ffffff', '#fde047', '#f472b6', '#fb7185', '#c084fc', '#60a5fa', '#fb923c'].map((c) => new THREE.Color(c));
    let n = 0;
    for (let i = 0; i < flowers; i++) {
      const at = spot();
      if (!at) continue;
      const h = 0.22 + r() * 0.2;
      e.set((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4);
      q.setFromEuler(e);
      p.set(at[0], h, at[1]); s.setScalar(0.9 + r() * 0.5);
      M.compose(p, q, s);
      heads.setMatrixAt(n, M); centers.setMatrixAt(n, M);
      heads.setColorAt(n, cols[Math.floor(r() * cols.length)]);
      p.set(at[0], 0, at[1]); s.set(1, h, 1);
      M.compose(p, q.identity(), s);
      stems.setMatrixAt(n, M);
      n++;
    }
    heads.count = centers.count = stems.count = n;
    g.add(heads, centers, stems);
  }
  return g;
}

// ---------- critters ----------
export function makeButterfly({ center = [0, 0], radius = 4, height = 1.2, color = '#f472b6', seed = Math.random() * 100 } = {}) {
  const b = new THREE.Group();
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(0.12, 0.2, 0.32, 0.18, 0.28, 0.02);
  wingShape.bezierCurveTo(0.3, -0.12, 0.12, -0.16, 0, 0);
  const wg = new THREE.ShapeGeometry(wingShape);
  wg.rotateX(-Math.PI / 2);
  const wm = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 });
  const L = new THREE.Mesh(wg, wm), R = new THREE.Mesh(wg, wm);
  R.scale.x = -1;
  b.add(L, R, new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.12, 4, 6).rotateX(Math.PI / 2), std('#3b2a1a')));
  const [cx, cz] = center;
  b.userData.tick = (dt, t) => {
    const tt = t * 0.5 + seed;
    const x = cx + Math.sin(tt * 1.1) * radius, z = cz + Math.sin(tt * 0.7 + 1) * radius * 0.6;
    const nx = cx + Math.sin((tt + 0.05) * 1.1) * radius, nz = cz + Math.sin((tt + 0.05) * 0.7 + 1) * radius * 0.6;
    b.position.set(x, height + Math.sin(t * 3 + seed) * 0.3, z);
    b.rotation.y = Math.atan2(nx - x, nz - z);
    const f = Math.sin(t * 22 + seed) * 1.1;
    L.rotation.z = f; R.rotation.z = -f;
  };
  return b;
}

export function makeBird({ radius = 25, height = 16, speed = 0.12, seed = Math.random() * 10 } = {}) {
  const b = new THREE.Group();
  const wm = std('#334155');
  const wing = new THREE.BoxGeometry(0.9, 0.05, 0.25).translate(0.45, 0, 0);
  const L = new THREE.Mesh(wing, wm), R = new THREE.Mesh(wing, wm);
  R.rotation.y = Math.PI;
  b.add(L, R, new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6).scale(1, 0.8, 1.8), wm));
  b.userData.tick = (dt, t) => {
    const a = t * speed + seed;
    b.position.set(Math.cos(a) * radius, height + Math.sin(t * 0.7 + seed) * 1.5, Math.sin(a) * radius);
    b.rotation.y = -a;
    const f = Math.sin(t * 7 + seed) * 0.5;
    L.rotation.z = f; R.rotation.z = -f;
  };
  return b;
}

// ---------- soft contact shadow ----------
let blobTex = null;
export function contactShadow(radius = 1, opacity = 0.35) {
  if (!blobTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    blobTex = new THREE.CanvasTexture(cv);
  }
  const s = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, color: '#1b3a1b' }));
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.03;
  s.renderOrder = 1;
  s.userData.dynamic = true; // follows its owner
  return s;
}
