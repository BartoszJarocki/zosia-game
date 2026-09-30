import * as THREE from 'three';
import { grassTexture } from './textures.js';

const groundCache = new Map();
/** Speckled grass ground material. */
export function groundMat(color = '#5dbb4f', repeat = 24) {
  const key = color + repeat;
  if (!groundCache.has(key)) groundCache.set(key, new THREE.MeshStandardMaterial({ map: grassTexture(color, repeat), roughness: 0.95 }));
  return groundCache.get(key);
}

/**
 * Instanced flowers + grass tufts in a ring (cheap: two draw calls).
 * `avoid` keeps a clear circle in the middle where the action happens.
 */
export function scatterFlowers(scene, { radius = 20, count = 100, avoid = 6, center = [0, 0], tufts = count * 3, keepOut = [], reject = () => false } = {}) {
  const [cx, cz] = center;
  const ok = (x, z) => Math.hypot(x - cx, z - cz) > avoid && keepOut.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr) && !reject(x, z);
  const spot = () => {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = avoid + Math.random() * (radius - avoid);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (ok(x, z)) return [x, z];
    }
    return null;
  };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const colors = ['#ffffff', '#fde047', '#f472b6', '#f87171', '#c084fc', '#60a5fa'].map((c) => new THREE.Color(c));

  // flower heads
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), count);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#2f8f3a' }), count);
  for (let i = 0; i < count; i++) {
    const at = spot() || [cx, cz - 100];
    const h = 0.2 + Math.random() * 0.15;
    p.set(at[0], h, at[1]); s.set(1, 0.6, 1);
    m.compose(p, q.identity(), s);
    heads.setMatrixAt(i, m);
    heads.setColorAt(i, colors[i % colors.length]);
    p.set(at[0], h / 2, at[1]); s.set(1, h / 0.3, 1);
    m.compose(p, q.identity(), s);
    stems.setMatrixAt(i, m);
  }
  heads.castShadow = true;
  scene.add(heads, stems);

  // grass tufts (three blades each via a squashed cone)
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.35, 4), new THREE.MeshStandardMaterial({ color: '#4ea843', roughness: 0.9 }), tufts);
  const e = new THREE.Euler();
  for (let i = 0; i < tufts; i++) {
    const at = spot() || [cx, cz - 100];
    p.set(at[0], 0.15, at[1]);
    e.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
    q.setFromEuler(e);
    s.set(1, 0.7 + Math.random() * 0.8, 0.35);
    m.compose(p, q, s);
    tuft.setMatrixAt(i, m);
  }
  scene.add(tuft);
}
