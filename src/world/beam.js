import * as THREE from 'three';
import { T } from '../lang/pl.js';

// The island lighthouse, as it stands at the back right of the harbour (hub.js).
export const BEAM_AT = [18.5, 1.2, -21.5];
export const BEAM_LAMP_Y = 6.5;
export const BEAM_LENGTH = 38;
export const BEAM_SWING = 0.55;
export const BEAM_BASE_YAW = -0.9; // inland across the sea, towards the camera
export const BEAM_SWEEP_SECONDS = 5;

/** The lamp only lights if she has ever sailed out to the lighthouse. */
export const beamDue = (visited = {}) => !!visited.lighthouse;
export const lighthouseBeamLine = (visited = {}) => (beamDue(visited) ? T.lighthouseWhy() : []);

/** The last lines of the goodnight: the lamp line sits right before "Dobranoc". */
export const goodnightLines = (visited = {}, earlier = []) => [...earlier, ...lighthouseBeamLine(visited), ...T.goodnight()];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 1, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,225,1)');
  grad.addColorStop(0.35, 'rgba(255,242,150,0.85)');
  grad.addColorStop(1, 'rgba(255,220,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A wide, warm beam from the island lighthouse, sweeping the sea twice and then settling to a gentle glow.
 * Returns null when the lighthouse was never visited.
 */
export function makeLighthouseBeam(visited = {}, { at = BEAM_AT, instant = false } = {}) {
  if (!beamDue(visited)) return null;

  const group = new THREE.Group();
  group.position.set(at[0], at[1], at[2]);

  const beamGeo = new THREE.CylinderGeometry(5.4, 0.22, BEAM_LENGTH, 24, 1, true);
  beamGeo.translate(0, BEAM_LENGTH / 2, 0);
  beamGeo.rotateX(Math.PI / 2); // lies across the sea, wide end far from the lamp
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#ffe8a0', transparent: true, opacity: 0.2, depthWrite: false, fog: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;
  const pivot = new THREE.Group();
  pivot.position.y = BEAM_LAMP_Y;
  pivot.rotation.y = BEAM_BASE_YAW;
  pivot.add(beam);
  group.add(pivot);

  const glowMap = glowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowMap, color: '#fff3b0', transparent: true, opacity: 0.75,
    depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  });
  const lamp = new THREE.Sprite(glowMat);
  lamp.position.y = BEAM_LAMP_Y;
  lamp.scale.setScalar(5);
  group.add(lamp);

  const materials = [beamMat, glowMat];
  let age = instant ? BEAM_SWEEP_SECONDS : 0;
  group.userData.beam = beam;
  group.userData.lamp = lamp;
  group.userData.pivot = pivot;
  group.userData.materials = materials;
  group.userData.tick = (dt) => {
    age += dt;
    const k = Math.min(1, age / BEAM_SWEEP_SECONDS);
    pivot.rotation.y = BEAM_BASE_YAW + Math.sin(k * Math.PI * 2) * BEAM_SWING * (1 - 0.5 * k);
    beamMat.opacity = 0.2 - 0.14 * k;
    glowMat.opacity = 0.55 + 0.35 * (1 - k);
  };
  group.userData.remove = () => {
    group.removeFromParent();
    beamGeo.dispose();
    glowMap.dispose();
    for (const m of materials) m.dispose();
  };
  group.userData.tick(0);
  return group;
}
