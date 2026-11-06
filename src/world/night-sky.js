import * as THREE from 'three';
import { starShape } from '../models.js';
import { T } from '../lang/pl.js';

// The Big Dipper's seven stars, in screen fractions (x right, y up), high in the top band.
const DIPPER = [[-0.12, 0.845], [0.11, 0.87], [0.35, 0.855], [0.53, 0.772], [0.46, 0.68], [0.23, 0.66], [0.13, 0.748]];
const DISTANCE = 100;
const MOON_RADIUS = 4.8;
const RENDER_ORDER = 50;

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

/** The picture plane of the live camera: right, up and the view direction as they are now. */
function planeOf(viewOrCamera, width, height, fov) {
  if (viewOrCamera.isCamera) {
    const c = viewOrCamera;
    return { pos: c.position.clone(), quat: c.quaternion.clone(), aspect: c.aspect || width / height, fov: c.fov || fov };
  }
  const dir = viewOrCamera.look.clone().sub(viewOrCamera.pos).normalize();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, dir.clone().negate()));
  return { pos: viewOrCamera.pos.clone(), quat, aspect: width / height, fov };
}

/** A soft Moon and the Wielki Wóz, drawn on the live camera's glass over everything else. */
export function makeNightSky(viewOrCamera, width = 1180, height = 820, fov = 42) {
  const plane = planeOf(viewOrCamera, width, height, fov);
  const group = new THREE.Group();
  group.position.copy(plane.pos);
  group.quaternion.copy(plane.quat);
  group.renderOrder = RENDER_ORDER;

  const halfH = DISTANCE * Math.tan(THREE.MathUtils.degToRad(plane.fov / 2));
  const halfW = halfH * plane.aspect;
  const at = (x, y) => new THREE.Vector3(x * halfW, y * halfH, -DISTANCE);

  const glass = (opts) => ({ transparent: true, depthTest: false, depthWrite: false, fog: false, ...opts });
  const setTop = (o) => { o.renderOrder = RENDER_ORDER; o.frustumCulled = false; return o; };

  const moonMat = new THREE.MeshBasicMaterial(glass({ color: '#fff6cf' }));
  const moon = setTop(new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, 32, 24), moonMat));
  moon.position.copy(at(0.76, 0.80));
  moon.userData.moon = true;
  group.add(moon);

  const glowMap = haloTexture();
  const glowMat = new THREE.SpriteMaterial(glass({ map: glowMap, color: '#fff3b8', opacity: 0.55, blending: THREE.AdditiveBlending }));
  const glow = setTop(new THREE.Sprite(glowMat));
  glow.position.copy(moon.position);
  glow.scale.setScalar(MOON_RADIUS * 5);
  group.add(glow);

  const starGeo = new THREE.ShapeGeometry(starShape(1.15, 0.5));
  const starMat = new THREE.MeshBasicMaterial(glass({ color: '#fff2a8', side: THREE.DoubleSide }));
  const stars = DIPPER.map(([x, y]) => {
    const s = setTop(new THREE.Mesh(starGeo, starMat));
    s.position.copy(at(x, y));
    s.userData.star = true;
    group.add(s);
    return s;
  });

  const lineGeo = new THREE.BufferGeometry().setFromPoints(DIPPER.map(([x, y]) => at(x, y)));
  const lineMat = new THREE.LineBasicMaterial(glass({ color: '#dcd2ff', opacity: 0.65 }));
  group.add(setTop(new THREE.Line(lineGeo, lineMat)));

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
