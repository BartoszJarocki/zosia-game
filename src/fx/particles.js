// Little bursts of joy: sparkles on correct answers, fireworks for celebrations, dust behind the truck.
// Colours are HDR (>1) so the bloom pass makes them glow.
import * as THREE from 'three';
import { starShape } from '../models.js';

const hdr = (hex, k = 2.4) => new THREE.Color(hex).multiplyScalar(k);
const GOLD = ['#ffd84a', '#fff1a8', '#ffb703'];
const RAINBOW = ['#ff5d73', '#ffd84a', '#5ce1e6', '#7cff6b', '#c77dff', '#ff9f1c'];

let starGeo = null;
const getStarGeo = () => (starGeo ||= new THREE.ShapeGeometry(starShape(1, 0.45)));
const matCache = new Map();
const glow = (hex, k) => {
  const key = hex + k;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color: hdr(hex, k * 1.6), side: THREE.DoubleSide }));
  return matCache.get(key);
};

/** Burst of spinning stars at a point. */
export function sparkle(stage, pos, { count = 18, colors = GOLD, size = 0.16, speed = 3, life = 0.95 } = {}) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(getStarGeo(), glow(colors[i % colors.length], 2.6));
    p.position.copy(pos);
    const a = Math.random() * Math.PI * 2, up = 0.35 + Math.random() * 0.9;
    p.userData.v = new THREE.Vector3(Math.cos(a) * (1 - up * 0.5), up, Math.sin(a) * (1 - up * 0.5)).multiplyScalar(speed * (0.6 + Math.random() * 0.6));
    p.userData.spin = (Math.random() - 0.5) * 12;
    p.scale.setScalar(size);
    stage.scene.add(p);
    parts.push(p);
  }
  let t = 0;
  const off = stage.onUpdate((dt) => {
    t += dt;
    const k = Math.max(0, 1 - t / life);
    for (const p of parts) {
      p.userData.v.y -= 5 * dt;
      p.position.addScaledVector(p.userData.v, dt);
      p.rotation.z += p.userData.spin * dt;
      p.lookAt(stage.cameraPosition);
      p.scale.setScalar(size * (0.3 + 0.7 * k) * (k > 0 ? 1 : 0.0001));
    }
    if (t >= life) { parts.forEach((p) => p.removeFromParent()); off(); }
  });
}

/** Fireworks over a point (celebrations). */
export function fireworks(stage, center, { bursts = 6, spread = 9, height = [6, 10] } = {}) {
  const sphere = new THREE.SphereGeometry(0.09, 6, 4);
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      if (!stage.alive) return;
      const n = 70;
      const color = RAINBOW[Math.floor(Math.random() * RAINBOW.length)];
      const mesh = new THREE.InstancedMesh(sphere, glow(color, 3), n);
      mesh.frustumCulled = false;
      const origin = new THREE.Vector3(center.x + (Math.random() - 0.5) * spread, height[0] + Math.random() * (height[1] - height[0]), center.z - 2 - Math.random() * 3);
      const vel = Array.from({ length: n }, () => new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 1.2));
      const pos = vel.map(() => origin.clone());
      stage.scene.add(mesh);
      stage.sfxPop?.();
      const M = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion();
      let t = 0;
      const off = stage.onUpdate((dt) => {
        t += dt;
        const k = Math.max(0.001, 1 - t / 1.6);
        for (let i = 0; i < n; i++) {
          vel[i].multiplyScalar(1 - 1.8 * dt);
          vel[i].y -= 1.4 * dt;
          pos[i].addScaledVector(vel[i], dt);
          s.setScalar(k * (0.8 + (i % 3) * 0.25));
          M.compose(pos[i], q, s);
          mesh.setMatrixAt(i, M);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (t > 1.6) { mesh.removeFromParent(); off(); }
      });
    }, b * 380 + Math.random() * 200);
  }
}

/** Soft dust puff (truck wheels, landings). */
const dustMat = new THREE.MeshStandardMaterial({ color: '#f5efe6', transparent: true, opacity: 0.7, roughness: 1, depthWrite: false });
export function dust(stage, pos, { count = 5, size = 0.35 } = {}) {
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const parts = [];
  const mat = dustMat.clone();
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.1, (Math.random() - 0.5) * 0.6));
    p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
    stage.scene.add(p);
    parts.push(p);
  }
  let t = 0;
  const off = stage.onUpdate((dt) => {
    t += dt;
    const k = t / 0.8;
    mat.opacity = 0.6 * Math.max(0, 1 - k);
    for (const p of parts) { p.position.addScaledVector(p.userData.v, dt); p.scale.setScalar(size * (0.5 + k)); }
    if (t > 0.8) { parts.forEach((p) => p.removeFromParent()); off(); }
  });
}
