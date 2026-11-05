import * as THREE from 'three';
import { starShape } from '../models.js';
import { T } from '../lang/pl.js';

// The Big Dipper's seven stars, in screen fractions (x right, y up).
const DIPPER = [[-0.55, 0.42], [-0.32, 0.47], [-0.08, 0.44], [0.10, 0.27], [0.03, 0.08], [-0.20, 0.04], [-0.30, 0.22]];

/** Chase says the night line only if she has ever been to the Moon or the stars. */
export const nightSkyLine = (visited = {}) => (visited.moon || visited.stars ? T.nightSky() : []);

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,220,0.85)');
  grad.addColorStop(0.35, 'rgba(255,246,200,0.35)');
  grad.addColorStop(1, 'rgba(255,246,200,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft Moon and the Wielki Wóz, built in the camera plane of the island's HOME_VIEW. */
export function makeNightSky(view, width = 1180, height = 820, fov = 42) {
  const dir = view.look.clone().sub(view.pos).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const group = new THREE.Group();
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, dir.clone().negate()));
  group.position.copy(view.pos).addScaledVector(dir, 100);

  const halfH = 100 * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const halfW = halfH * width / height;

  const moonMat = new THREE.MeshBasicMaterial({ color: '#fff6cf', transparent: true, depthWrite: false });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(3.6, 32, 24), moonMat);
  moon.position.set(0.62 * halfW, 0.66 * halfH, 0);
  moon.userData.moon = true;
  group.add(moon);

  const glowMap = haloTexture();
  const glowMat = new THREE.SpriteMaterial({ map: glowMap, color: '#fff3b8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat);
  glow.position.copy(moon.position);
  glow.scale.setScalar(14);
  group.add(glow);

  const starGeo = new THREE.ShapeGeometry(starShape(1.15, 0.5));
  const starMat = new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const stars = DIPPER.map(([x, y]) => {
    const s = new THREE.Mesh(starGeo, starMat);
    s.position.set(x * halfW, y * halfH, 0);
    s.userData.star = true;
    group.add(s);
    return s;
  });

  const lineGeo = new THREE.BufferGeometry().setFromPoints(DIPPER.map(([x, y]) => new THREE.Vector3(x * halfW, y * halfH, 0)));
  const lineMat = new THREE.LineBasicMaterial({ color: '#dcd2ff', transparent: true, opacity: 0.65, depthWrite: false });
  group.add(new THREE.Line(lineGeo, lineMat));

  const materials = [moonMat, glowMat, starMat, lineMat];
  group.userData.moon = moon;
  group.userData.stars = stars;
  group.userData.materials = materials;
  group.userData.remove = () => {
    group.removeFromParent();
    moon.geometry.dispose();
    starGeo.dispose();
    lineGeo.dispose();
    glowMap.dispose();
    for (const m of materials) m.dispose();
  };
  return group;
}
