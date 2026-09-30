import * as THREE from 'three';
import { mat, mesh, sphere, cyl, rbox, star } from './models.js';
import { pupHeadTexture, furTexture, hairTexture } from './textures.js';
import { CONFIG } from './config.js';
import { flatten } from './fx/optimize.js';

const D2R = Math.PI / 180;
const Z = new THREE.Vector3(0, 0, 1);

// Physical materials (sheen = soft fuzzy rim, clearcoat = shiny eyes/nose).
const pcache = new Map();
function pmat(key, make) {
  if (!pcache.has(key)) pcache.set(key, make());
  return pcache.get(key);
}
const fur = (color, map) => pmat('fur' + color + (map ? map.uuid : ''), () =>
  new THREE.MeshPhysicalMaterial({ color: map ? '#ffffff' : color, map, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#fff1d6'), sheenRoughness: 0.45 }));
const gloss = (color) => pmat('gloss' + color, () =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
const cloth = (color) => pmat('cloth' + color, () =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5), sheenRoughness: 0.6 }));
const skinM = (color) => pmat('skin' + color, () =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color('#ffd9d0'), sheenRoughness: 0.5 }));

/** Place obj on an ellipsoid surface (radius R, scale s) at latitude/longitude, facing outward. */
function onSurface(obj, R, s, latDeg, lonDeg, lift = 0) {
  const lat = latDeg * D2R, lon = lonDeg * D2R;
  const p = new THREE.Vector3(Math.sin(lon) * Math.cos(lat) * R * s[0], Math.sin(lat) * R * s[1], Math.cos(lon) * Math.cos(lat) * R * s[2]);
  const n = new THREE.Vector3(p.x / (s[0] * s[0]), p.y / (s[1] * s[1]), p.z / (s[2] * s[2])).normalize();
  obj.position.copy(p).addScaledVector(n, lift);
  obj.quaternion.setFromUnitVectors(Z, n);
  return obj;
}

function tube(points, radius, material, segs = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 8, false), material);
  m.castShadow = true;
  return m;
}

/** Big cartoon eye built along +Z, so it can be placed on a face. */
function makeEye({ iris, size = 1, lashes = false, lashColor = '#2b1a10' }) {
  const e = new THREE.Group();
  const inner = new THREE.Group(); // this one blinks
  e.add(inner);
  inner.add(mesh(sphere(0.1 * size, 24), gloss('#ffffff'), { s: [1, 1.12, 0.45], shadow: false }));
  inner.add(mesh(sphere(0.074 * size, 24), gloss(iris), { z: 0.028 * size, s: [1, 1.08, 0.4], shadow: false }));
  inner.add(mesh(sphere(0.052 * size, 20), gloss(new THREE.Color(iris).lerp(new THREE.Color('#000'), 0.35).getStyle()), { z: 0.034 * size, s: [1, 1.08, 0.4], shadow: false }));
  inner.add(mesh(sphere(0.036 * size, 16), gloss('#0b0604'), { z: 0.045 * size, s: [1, 1.05, 0.4], shadow: false }));
  inner.add(mesh(sphere(0.022 * size, 10), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), { x: 0.026 * size, y: 0.034 * size, z: 0.062 * size, shadow: false }));
  inner.add(mesh(sphere(0.011 * size, 8), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), { x: -0.022 * size, y: -0.026 * size, z: 0.06 * size, shadow: false }));
  if (lashes) {
    const lm = mat(lashColor);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.098 * size, 0.012 * size, 6, 20, Math.PI * 0.9), lm);
    lid.rotation.z = Math.PI * 0.05;
    lid.position.z = 0.012 * size;
    inner.add(lid);
    e.userData.lashes = [];
    for (const a of [0.2, 0.45]) {
      const l = mesh(new THREE.ConeGeometry(0.012 * size, 0.05 * size, 6), lm, { shadow: false });
      const ang = a * Math.PI;
      l.position.set(Math.cos(ang) * 0.1 * size, Math.sin(ang) * 0.11 * size, 0.012 * size);
      l.rotation.z = ang - Math.PI / 2;
      inner.add(l);
      e.userData.lashes.push(l);
    }
  }
  e.userData.inner = inner;
  return e;
}

function blinker(eyes, who) {
  let next = 2 + Math.random() * 3, closeAt = -1;
  return (t) => {
    if (t > next) { closeAt = t; next = t + 2.5 + Math.random() * 3.5; }
    let k = closeAt > 0 && t - closeAt < 0.13 ? 0.08 : 1;
    if (isHappy(who)) k = Math.min(k, 0.42); // happy squint
    eyes.forEach((e) => (e.userData.inner.scale.y += (k - e.userData.inner.scale.y) * 0.5));
  };
}

const now = () => performance.now() / 1000;
const isHappy = (who) => now() < (who.userData.happyUntil || 0);
const _v = new THREE.Vector3();

/** Shared mood + gaze: setHappy(seconds), lookAt(worldPoint, seconds). Returns a per-frame head turner. */
function giveLife(who, head, headY) {
  who.userData.setHappy = (sec = 1.5) => { who.userData.happyUntil = now() + sec; };
  who.userData.lookAt = (p, sec = 1.6) => { who.userData.gaze = p.clone(); who.userData.gazeUntil = now() + sec; };
  let yaw = 0, pitch = 0;
  return (swayYaw = 0, swayPitch = 0) => {
    let ty = swayYaw, tp = swayPitch;
    if (who.userData.gaze && now() < who.userData.gazeUntil) {
      who.updateWorldMatrix(true, false);
      _v.copy(who.userData.gaze);
      who.worldToLocal(_v);
      ty = THREE.MathUtils.clamp(Math.atan2(_v.x, _v.z), -0.75, 0.75);
      tp = THREE.MathUtils.clamp(-Math.atan2(_v.y - headY, Math.hypot(_v.x, _v.z)) * 0.6, -0.3, 0.35);
    }
    yaw += (ty - yaw) * 0.12;
    pitch += (tp - pitch) * 0.12;
    head.rotation.y = yaw;
    head.rotation.x = pitch;
  };
}

// =====================================================================
//  CHASE: German Shepherd police pup
// =====================================================================
export function makePup() {
  const C = { tan: '#cf8a45', brown: '#5b3216', light: '#f2cf9c', cream: '#f7e2bf' };
  const pup = new THREE.Group();
  const tan = fur(C.tan, furTexture(C.tan));
  const brown = fur(C.brown, furTexture(C.brown));
  const cream = fur(C.cream, furTexture(C.cream));
  const blue = cloth('#1f55c9');
  const navy = cloth('#14307a');
  const gold = new THREE.MeshPhysicalMaterial({ color: '#fcd34d', metalness: 0.6, roughness: 0.3, clearcoat: 0.6 });
  const black = gloss('#140c07');

  // ---- body (sitting) ----
  pup.add(mesh(sphere(0.52, 32), tan, { y: 0.62, s: [1, 1.08, 0.92] }));
  pup.add(mesh(sphere(0.5, 32), brown, { y: 0.74, z: -0.2, s: [0.96, 0.86, 0.8] })); // back saddle
  pup.add(mesh(sphere(0.34, 24), cream, { y: 0.62, z: 0.3, s: [1, 1.25, 0.62] })); // chest
  // blue police vest
  const vestM = blue.clone();
  vestM.side = THREE.DoubleSide;
  pup.add(mesh(new THREE.CylinderGeometry(0.49, 0.57, 0.4, 32, 1, true), vestM, { y: 0.56 }));
  pup.add(mesh(new THREE.TorusGeometry(0.49, 0.03, 8, 32), cloth('#fcd34d'), { y: 0.76, rx: Math.PI / 2 })); // yellow trim
  const vestBadge = shieldBadge(gold, blue, 0.13);
  vestBadge.position.set(0.27, 0.58, 0.52);
  vestBadge.rotation.y = 0.4;
  pup.add(vestBadge);
  // collar + pup tag
  const collar = mesh(new THREE.TorusGeometry(0.33, 0.055, 12, 32), navy, { y: 1.04, z: 0.02, rx: Math.PI / 2 + 0.25 });
  pup.add(collar);
  const tag = shieldBadge(gold, blue, 0.14);
  tag.position.set(0, 0.95, 0.4);
  tag.rotation.x = -0.2;
  pup.add(tag);
  // pup pack
  const pack = new THREE.Group();
  pack.add(mesh(rbox(0.62, 0.46, 0.3, 0.1), blue));
  pack.add(mesh(rbox(0.5, 0.12, 0.32, 0.05), cloth('#fcd34d'), { y: 0.12 }));
  for (const x of [-0.18, 0.18]) pack.add(mesh(cyl(0.07, 0.07, 0.34, 16), navy, { x, y: -0.08, z: -0.1, rx: Math.PI / 2 }));
  pack.position.set(0, 0.98, -0.5);
  pack.rotation.x = 0.2;
  pup.add(pack);
  // front legs + paws
  for (const x of [-0.22, 0.22]) {
    pup.add(mesh(cyl(0.11, 0.13, 0.5, 16), tan, { x, y: 0.26, z: 0.34 }));
    pup.add(mesh(sphere(0.15, 16), cream, { x, y: 0.06, z: 0.42, s: [1, 0.6, 1.25] }));
  }
  // haunches + back feet
  for (const x of [-0.42, 0.42]) {
    pup.add(mesh(sphere(0.27, 20), tan, { x, y: 0.26, z: -0.02, s: [0.75, 0.85, 1.25] }));
    pup.add(mesh(sphere(0.15, 16), cream, { x: x * 1.05, y: 0.06, z: 0.2, s: [0.9, 0.55, 1.4] }));
  }
  // bushy tail
  const tailG = new THREE.Group();
  tailG.add(tube([[0, 0, 0], [0, 0.15, -0.2], [0, 0.4, -0.3], [0, 0.62, -0.22]], 0.085, brown));
  tailG.add(mesh(sphere(0.1, 12), brown, { y: 0.63, z: -0.21 }));
  tailG.position.set(0, 0.3, -0.45);
  pup.add(tailG);

  // ---- head ----
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0.04);
  pup.add(head);
  const HS = [1.06, 0.95, 0.95], HR = 0.55;
  head.add(mesh(sphere(HR, 48), fur('#ffffff', pupHeadTexture(C)), { s: HS }));
  // cheeks + muzzle
  for (const side of [-1, 1]) head.add(mesh(sphere(0.2, 20), tan, { x: side * 0.24, y: -0.2, z: 0.3, s: [1, 0.8, 0.8] }));
  head.add(mesh(sphere(0.27, 28), cream, { y: -0.2, z: 0.38, s: [1.1, 0.78, 1] }));
  for (const side of [-1, 1]) head.add(mesh(sphere(0.15, 20), cream, { x: side * 0.1, y: -0.23, z: 0.55, s: [1, 0.85, 0.9] }));
  head.add(mesh(sphere(0.12, 24), black, { y: -0.08, z: 0.66, s: [1.35, 0.9, 1] })); // nose
  // smile + tongue
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI), mat('#3a1d0c'));
  smile.position.set(0, -0.3, 0.62);
  smile.rotation.z = Math.PI;
  head.add(smile);
  head.add(mesh(sphere(0.07, 16), gloss('#f06b86'), { y: -0.38, z: 0.6, s: [1, 0.75, 0.45] }));
  // eyes
  const eyes = [];
  for (const side of [-1, 1]) {
    const e = makeEye({ iris: '#7a431a', size: 1.45 });
    onSurface(e, HR, HS, 6, side * 22, -0.035);
    head.add(e);
    eyes.push(e);
    // brow ridge (expression)
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 6, 16, Math.PI * 0.7), mat('#3a1d0c'));
    onSurface(brow, HR, HS, 22, side * 21, 0.0);
    brow.rotateZ(Math.PI * 0.15);
    head.add(brow);
  }
  // big upright pointy ears
  const earShape = new THREE.Shape();
  earShape.moveTo(-0.24, 0);
  earShape.quadraticCurveTo(-0.24, 0.42, 0.02, 0.66);
  earShape.quadraticCurveTo(0.22, 0.4, 0.24, 0);
  earShape.quadraticCurveTo(0, -0.05, -0.24, 0);
  const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, curveSegments: 16 });
  const innerGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 16 });
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.add(mesh(earGeo, brown));
    const inner = mesh(innerGeo, fur(C.light, furTexture(C.light)), { x: 0.0, y: 0.08, z: 0.07, s: [0.62, 0.72, 1] });
    ear.add(inner);
    ear.position.set(side * 0.34, 0.3, -0.08);
    ear.rotation.set(-0.15, side * -0.35, side * -0.42);
    head.add(ear);
    ears.push(ear);
  }
  // police cap with gold shield badge
  const cap = new THREE.Group();
  cap.position.set(0, 0.47, 0.02);
  cap.rotation.x = -0.18;
  cap.add(mesh(cyl(0.4, 0.31, 0.2, 36), blue, { y: 0.08 }));
  cap.add(mesh(sphere(0.43, 36), blue, { y: 0.19, s: [1, 0.3, 1] }));
  cap.add(mesh(cyl(0.315, 0.315, 0.09, 36), navy, { y: -0.02 }));
  const visor = mesh(sphere(0.34, 32), mat('#0b1a45', { roughness: 0.25 }), { y: -0.07, z: 0.16, s: [1, 0.12, 0.85], rx: 0.28 });
  cap.add(visor);
  const capBadge = shieldBadge(gold, blue, 0.14);
  capBadge.position.set(0, 0.1, 0.35);
  capBadge.rotation.x = 0.1;
  cap.add(capBadge);
  head.add(cap);

  const blink = blinker(eyes, pup);
  const turn = giveLife(pup, head, 1.5);
  const tongue = head.children.find((c) => c.material?.color?.getHexString?.() === 'f06b86');
  pup.userData.parts = { head, tail: tailG, ears };
  pup.userData.mergeOK = true; // only groups + the (unique) tongue are animated
  noTinyShadows(pup);
  pup.userData.idle = (t) => {
    const happy = isHappy(pup);
    tailG.rotation.z = Math.sin(t * (happy ? 18 : 9)) * (happy ? 0.7 : 0.45);
    head.rotation.z = Math.sin(t * (happy ? 6 : 1.3)) * (happy ? 0.12 : 0.06);
    turn(0, Math.sin(t * 0.9) * 0.04);
    ears.forEach((e, i) => {
      e.rotation.z = (i ? -1 : 1) * (happy ? 0.3 : 0.42) + Math.sin(t * 2.2 + i) * 0.04;
      e.rotation.x = happy ? -0.3 : -0.15;
    });
    if (tongue) tongue.scale.y = happy ? 0.75 * 1.5 : 0.75;
    blink(t);
  };
  return pup;
}

/** Gold police shield with a star (Chase's badge). */
function shieldBadge(gold, blue, size = 0.14) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.quadraticCurveTo(0.25, 0.44, 0.45, 0.5);
  s.lineTo(0.45, 0.05);
  s.quadraticCurveTo(0.42, -0.35, 0, -0.55);
  s.quadraticCurveTo(-0.42, -0.35, -0.45, 0.05);
  s.lineTo(-0.45, 0.5);
  s.quadraticCurveTo(-0.25, 0.44, 0, 0.5);
  const g = new THREE.Group();
  const shield = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  g.add(mesh(shield, gold, { shadow: false }));
  const inner = mesh(new THREE.ShapeGeometry(s), blue, { z: 0.18, s: [0.75, 0.75, 1], shadow: false });
  g.add(inner);
  const st = star('#fcd34d', 0.25, 0.06);
  st.position.z = 0.2;
  g.add(st);
  g.scale.setScalar(size);
  return g;
}

// =====================================================================
//  ZOSIA
// =====================================================================
export function makeGirl(look = CONFIG.avatar) {
  const g = new THREE.Group();
  const skin = skinM(look.skin);
  const hairMap = hairTexture(look.hair);
  const hair = pmat('hair' + look.hair, () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: hairMap, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#fff4c8'), sheenRoughness: 0.35 }));
  const hairStrand = pmat('strand' + look.hair, () => new THREE.MeshPhysicalMaterial({ color: look.hair, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color('#fff4c8') }));
  const shirt = cloth(look.shirt);
  const pants = cloth(look.pants);

  // ---- legs ----
  const legs = [];
  for (const x of [-0.12, 0.12]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.66, 0);
    leg.add(mesh(cyl(0.105, 0.085, 0.6, 16), pants, { y: -0.3 }));
    const shoe = new THREE.Group();
    shoe.add(mesh(sphere(0.12, 16), gloss(look.shoes), { z: 0.04, s: [0.95, 0.62, 1.45] }));
    shoe.add(mesh(cyl(0.12, 0.12, 0.04, 16), mat('#f472b6'), { y: -0.06, z: 0.04, s: [0.95, 1, 1.45] }));
    shoe.position.y = -0.6;
    leg.add(shoe);
    g.add(leg);
    legs.push(leg);
  }

  // ---- pink T-shirt (boxy, slightly flared) ----
  const body = new THREE.Group();
  body.position.y = 0.62;
  g.add(body);
  const profile = [[0, 0], [0.34, 0], [0.36, 0.04], [0.34, 0.2], [0.31, 0.42], [0.3, 0.56], [0.24, 0.66], [0.12, 0.7], [0, 0.7]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  body.add(mesh(new THREE.LatheGeometry(profile, 40), shirt));
  body.add(mesh(new THREE.TorusGeometry(0.115, 0.022, 8, 24), shirt, { y: 0.69, rx: Math.PI / 2 })); // neckline rib
  body.add(mesh(cyl(0.07, 0.08, 0.14, 16), skin, { y: 0.74 })); // neck
  // embroidered flowers with red leaves
  const spots = [[20, 0.5], [-35, 0.42], [5, 0.25], [-15, 0.12], [40, 0.18], [-50, 0.22], [60, 0.4], [-5, 0.52]];
  const flowers = new THREE.Group();
  body.add(flowers);
  for (const [lon, y] of spots) {
    const f = flower(0.04);
    const r = 0.34 - (y - 0.2) * 0.12;
    const a = lon * D2R;
    f.position.set(Math.sin(a) * (r + 0.005), y, Math.cos(a) * (r + 0.005));
    f.rotation.y = a;
    flowers.add(f);
  }
  flatten(flowers); // 8 embroidered flowers → 3 meshes
  // arms with rolled-up sleeves
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 0.58, 0);
    arm.add(mesh(sphere(0.12, 16), shirt, { y: -0.05, s: [1, 1.15, 1] }));
    arm.add(mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20), shirt, { y: -0.14, rx: Math.PI / 2 }));
    arm.add(mesh(cyl(0.062, 0.055, 0.36, 12), skin, { y: -0.3 }));
    arm.add(mesh(sphere(0.07, 14), skin, { y: -0.5, s: [0.9, 1.05, 0.75] }));
    arm.add(mesh(sphere(0.03, 8), skin, { x: side * -0.05, y: -0.47, z: 0.03 })); // thumb
    arm.rotation.z = side * 0.22;
    body.add(arm);
    arms.push(arm);
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 1.78;
  g.add(head);
  const HR = 0.45, HS = [1, 1.04, 0.96];
  head.add(mesh(sphere(HR, 48), skin, { s: HS }));
  // ears
  for (const side of [-1, 1]) head.add(onSurface(mesh(sphere(0.075, 12), skin, { s: [0.8, 1.1, 0.5] }), HR, HS, -6, side * 86, -0.01));
  // eyes (big brown, with lashes)
  const eyes = [];
  for (const side of [-1, 1]) {
    const e = makeEye({ iris: look.eyes, size: 1.0, lashes: true, lashColor: '#3b2414' });
    onSurface(e, HR, HS, -3, side * 21, -0.02);
    head.add(e);
    eyes.push(e);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 16, Math.PI * 0.75), mat('#b88a4a'));
    onSurface(brow, HR, HS, 15, side * 21, 0.004);
    brow.rotateZ(Math.PI * 0.12);
    head.add(brow);
  }
  eyes[0].scale.x = -1; // mirror so both sets of lashes point outward
  // cheeks, nose
  for (const side of [-1, 1]) {
    head.add(onSurface(mesh(sphere(0.08, 16), mat('#ff9e9e', { transparent: true, opacity: 0.45, depthWrite: false }), { s: [1, 0.7, 0.25], shadow: false }), HR, HS, -15, side * 40, 0));
  }
  head.add(onSurface(mesh(sphere(0.045, 16), skin, { s: [1, 0.85, 1] }), HR, HS, -12, 0, -0.012));
  // big toothy smile
  const mouth = new THREE.Group();
  const ms = new THREE.Shape();
  ms.moveTo(-0.11, 0.01);
  ms.quadraticCurveTo(0, -0.16, 0.11, 0.01);
  ms.quadraticCurveTo(0, 0.035, -0.11, 0.01);
  mouth.add(mesh(new THREE.ExtrudeGeometry(ms, { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), gloss('#8e2433'), { z: -0.02, shadow: false }));
  const ts = new THREE.Shape();
  ts.moveTo(-0.085, 0.004);
  ts.quadraticCurveTo(0, 0.022, 0.085, 0.004);
  ts.quadraticCurveTo(0.06, -0.04, 0, -0.042);
  ts.quadraticCurveTo(-0.06, -0.04, -0.085, 0.004);
  mouth.add(mesh(new THREE.ShapeGeometry(ts), gloss('#ffffff'), { z: 0.011, shadow: false }));
  mouth.add(mesh(sphere(0.045, 12), gloss('#e8707e'), { y: -0.075, z: 0.0, s: [1.2, 0.55, 0.3], shadow: false }));
  onSurface(mouth, HR, HS, -26, 0, 0.0);
  head.add(mouth);

  // ---- hair: pulled back, middle part, flyaways, two clips ----
  head.add(mesh(sphere(0.465, 48), hair, { y: 0.1, z: -0.1 }));
  for (const side of [-1, 1]) {
    head.add(mesh(sphere(0.3, 32), hair, { x: side * 0.19, y: 0.3, z: 0.12, s: [0.95, 0.5, 0.75], rz: side * -0.45 }));
    // wisps by the temples and ears
    head.add(tube([[side * 0.3, 0.26, 0.24], [side * 0.39, 0.1, 0.2], [side * 0.42, -0.08, 0.14], [side * 0.4, -0.22, 0.12]], 0.013, hairStrand));
    head.add(tube([[side * 0.34, 0.2, 0.18], [side * 0.43, 0.0, 0.08], [side * 0.44, -0.16, 0.02], [side * 0.41, -0.3, 0.05]], 0.011, hairStrand));
    head.add(tube([[side * 0.25, 0.34, 0.26], [side * 0.33, 0.2, 0.3], [side * 0.36, 0.06, 0.28]], 0.009, hairStrand));
  }
  // flyaways on top
  head.add(tube([[0.02, 0.54, 0.02], [0.08, 0.575, -0.06], [0.15, 0.55, -0.14]], 0.006, hairStrand));
  head.add(tube([[-0.12, 0.53, 0.04], [-0.18, 0.56, -0.04], [-0.23, 0.53, -0.12]], 0.005, hairStrand));
  // little ponytail
  const tail = new THREE.Group();
  tail.position.set(0, -0.02, -0.5);
  tail.add(mesh(new THREE.TorusGeometry(0.055, 0.025, 8, 16), cloth(look.tie), { rx: 0.3 }));
  tail.add(mesh(sphere(0.13, 20), hair, { y: -0.14, z: -0.05, s: [0.75, 1.4, 0.75], rx: 0.3 }));
  head.add(tail);
  // clips: green on her right, yellow-green on her left (like the photo)
  for (const side of [-1, 1]) {
    const clip = new THREE.Group();
    clip.add(mesh(rbox(0.23, 0.06, 0.05, 0.025), gloss(side < 0 ? look.clips : look.clips2)));
    clip.add(mesh(sphere(0.02, 8), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 }), { x: 0.06, y: 0.02, z: 0.025, shadow: false }));
    clip.position.set(side * 0.3, 0.3, 0.29);
    clip.rotation.set(-0.4, side * -0.6, side * 0.9);
    head.add(clip);
  }

  const blink = blinker(eyes, g);
  const turn = giveLife(g, head, 1.78);
  const rest = () => {
    legs.forEach((l) => (l.rotation.x = 0));
    arms.forEach((a) => (a.rotation.x = 0));
  };
  g.userData.parts = { head, arms, legs, body };
  g.userData.mergeOK = true;
  noTinyShadows(g);
  g.userData.idle = (t) => {
    rest();
    head.rotation.z = Math.sin(t * 1.6) * 0.05;
    turn(Math.sin(t * 0.7) * 0.08, 0);
    body.position.y = 0.62 + Math.sin(t * 3) * 0.006;
    arms[0].rotation.z = -0.22 - Math.sin(t * 2) * 0.05;
    arms[1].rotation.z = 0.22 + Math.sin(t * 2) * 0.05;
    blink(t);
  };
  g.userData.cheer = (t) => {
    rest();
    arms[0].rotation.z = -2.6 + Math.sin(t * 14) * 0.3;
    arms[1].rotation.z = 2.6 - Math.sin(t * 14) * 0.3;
    head.rotation.z = Math.sin(t * 7) * 0.1;
    turn(0, -0.1);
    g.userData.happyUntil = Math.max(g.userData.happyUntil || 0, now() + 0.2);
    blink(t);
  };
  g.userData.walk = (t) => {
    legs[0].rotation.x = Math.sin(t * 12) * 0.55;
    legs[1].rotation.x = -Math.sin(t * 12) * 0.55;
    arms[0].rotation.x = -Math.sin(t * 12) * 0.45;
    arms[1].rotation.x = Math.sin(t * 12) * 0.45;
    blink(t);
  };
  return g;
}

/** Eyes, lashes, badges… are too small to cast a visible shadow: skip them in the shadow pass. */
function noTinyShadows(root) {
  const s = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(s);
    if (o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z) < 0.12) o.castShadow = false;
  });
}

function flower(r) {
  const f = new THREE.Group();
  const petal = mat('#ffffff');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    f.add(mesh(sphere(r * 0.5, 8), petal, { x: Math.cos(a) * r * 0.65, y: Math.sin(a) * r * 0.65, s: [1, 1, 0.35], shadow: false }));
  }
  f.add(mesh(sphere(r * 0.32, 8), mat('#f59e0b'), { z: 0.008, s: [1, 1, 0.4], shadow: false }));
  for (const side of [-1, 1]) {
    f.add(mesh(sphere(r * 0.4, 8), mat('#c0392b'), { x: side * r * 0.9, y: -r * 1.05, s: [1.3, 0.6, 0.3], rz: side * 0.6, shadow: false }));
  }
  return f;
}
