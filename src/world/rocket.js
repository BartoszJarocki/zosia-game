import * as THREE from 'three';
import { mat, mesh } from '../models.js';

export function makeRocket() {
  const g = new THREE.Group();
  g.userData.bakeInside = true;
  const white = mat('#f8fafc', { roughness: 0.35 });
  const red = mat('#ef4444', { roughness: 0.4 });
  const profile = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 28);
  g.add(mesh(profile([[0, -1], [0.42, -1], [0.55, -0.6], [0.6, -0.1], [0.57, 0.35], [0.5, 0.62]]), white));
  g.add(mesh(profile([[0.5, 0.6], [0.43, 0.88], [0.28, 1.14], [0.1, 1.32], [0, 1.36]]), red));
  g.add(mesh(new THREE.CylinderGeometry(0.47, 0.43, 0.18, 28), red, { y: -0.95 }));
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.lineTo(0.42, -0.32); fin.quadraticCurveTo(0.56, -0.7, 0.52, -1.05); fin.lineTo(0, -0.72); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  finGeo.translate(0, 0, -0.04);
  for (const ry of [0, Math.PI, Math.PI / 2]) {
    const f = new THREE.Group();
    f.rotation.y = ry;
    f.add(mesh(finGeo, red, { x: 0.48, y: -0.3 }));
    g.add(f);
  }
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.065, 12, 32), mat('#fbbf24', { metalness: 0.3 }), { y: 0.12, z: 0.585 }));
  const window = mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: '#8edbff' }), { y: 0.12, z: 0.59 });
  window.userData.dynamic = true;
  g.add(window);
  const flame = new THREE.Group();
  flame.userData.dynamic = true;
  for (const [color, r, h] of [['#ff9c38', 0.3, 0.9], ['#fff19a', 0.18, 0.65]]) {
    flame.add(mesh(new THREE.ConeGeometry(r, h, 18), new THREE.MeshBasicMaterial({ color }), { y: -1.05 - h / 2, rx: Math.PI, shadow: false }));
  }
  flame.visible = false;
  g.add(flame);
  g.userData.window = window;
  g.userData.flame = flame;
  return g;
}

export function makeLaunchPad({ rocket = true } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.3, 48), mat('#94a3b8'), { y: 0.18 }));
  g.add(mesh(new THREE.RingGeometry(2.1, 2.4, 48), mat('#fff1a8'), { y: 0.34, rx: -Math.PI / 2 }));
  if (rocket) {
    const ship = makeRocket();
    ship.scale.setScalar(1.8);
    ship.position.y = 2.8;
    g.add(ship);
    g.userData.rocket = ship;
  }
  return g;
}
