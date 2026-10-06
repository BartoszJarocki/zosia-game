// What Adventure Bay remembers (adventure/world.js), drawn on the island:
// rescued kittens near Kitty Park, a bridge over the River, a train touring the island,
// balloons tied to the Lookout and the Lookout's party lights. New ones pop in with sparkles.
import * as THREE from 'three';
import { animate, ease, hop } from '../engine.js';
import { makeKitten, makeTrain, makeBalloon, mat, mesh, rbox } from '../models.js';
import { makeTree } from '../world/nature.js';
import { glyphTexture, labelTexture } from '../textures.js';
import { sparkle } from '../fx/particles.js';
import { flatten } from '../fx/optimize.js';
import { sfx } from '../audio.js';
import { CONFIG } from '../config.js';
import { rewardType } from '../adventure/world.js';
import { T } from '../lang/pl.js';

// spots around Kitty Park (-15, -3): off its pad and road, clear of trees and houses,
// and not straight behind Balloon Hill (-13.5, 8) as seen from the camera
const KITTEN_SPOTS = [[-18.6, -0.6], [-12.2, 0.1], [-20.2, -1.6], [-19.2, -4.2], [-16.4, -7.4], [-11.6, -5.8]];
const LOOKOUT = new THREE.Vector3(0, 0, -10.5);
const BALLOON_ANGLES = [0.75, -0.8, 1.45, -1.5, 2.1];
const BALLOON_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899'];
const TRACK_R = 25.2;

/**
 * Add everything the world state says is there. unseen: reward ids to reveal now.
 * Returns the lines to say about what's new (empty when nothing is).
 */
export function addWorld(hub, world, unseen = [], { places }) {
  const s = hub.scene;
  const newTypes = new Set(unseen.map(rewardType));
  const reveal = []; // [object, delay]
  const newKittens = unseen.filter((id) => rewardType(id) === 'kitten').length;
  const newBalloons = unseen.filter((id) => rewardType(id) === 'balloon').length;

  // --- rescued kittens: pottering about near the park, they meow when tapped ---
  const kittens = world.rescuedKittens ? makeKittens(s, world.rescuedKittens) : [];
  kittens.forEach((k, i) => {
    const [x, z] = KITTEN_SPOTS[i % KITTEN_SPOTS.length];
    k.position.set(x, 0.06, z);
    const phase = i * 1.7, home = new THREE.Vector3(x, 0.06, z);
    k.userData.tapHeight = 0.6;
    k.userData.tick = (dt, t) => {
      // wander a little, sit a little
      const walk = Math.max(0, Math.sin(t * 0.35 + phase));
      const a = t * 0.5 * walk + phase;
      k.position.x = home.x + Math.cos(a) * 0.6;
      k.position.z = home.z + Math.sin(a) * 0.45;
      if (walk > 0.05) k.rotation.y = -a; // facing the way it goes (roughly)
    };
    hub.tappable(k, () => { sfx.meow(); hop(k, 0.6); });
    if (i >= world.rescuedKittens - newKittens) reveal.push([k, 0]);
  });

  // --- the bridge over the River (part of the River's place, so it faces the camera with it) ---
  if (world.bridgeBuilt && places.stones) {
    const b = makeBridge();
    places.stones.add(b);
    if (newTypes.has('bridge')) { b.userData.dynamic = true; reveal.push([b, 0]); }
  }

  // --- the island train: rails round the beach, a little train with her name on it ---
  if (world.trainUnlocked) {
    s.add(makeTrack(TRACK_R));
    const letters = (CONFIG.childName || 'ABC').toUpperCase().slice(0, 3);
    const train = makeTrain(letters.length);
    [...letters].forEach((l, i) => {
      const blk = new THREE.Mesh(rbox(0.95, 0.95, 0.95, 0.1), new THREE.MeshStandardMaterial({ map: glyphTexture(l, { bg: ['#9333ea', '#db2777', '#0891b2'][i] }), roughness: 0.45 }));
      blk.position.copy(train.userData.slots[i]).add(new THREE.Vector3(0, -0.15, 0));
      train.add(blk);
    });
    train.scale.setScalar(0.75);
    // from this far, spinning wheels and smoke don't show: one rigid model, a few draw calls
    const puffs = []; train.traverse((o) => { if (o.isMesh && o.material.transparent) puffs.push(o); });
    puffs.forEach((p) => p.removeFromParent());
    train.userData = {};
    flatten(train);
    const big = new Set(['#dc2626', '#2563eb', '#16a34a', '#f59e0b']); // engine + wagons cast the shadow
    train.traverse((o) => { if (o.isMesh) o.castShadow = big.has('#' + o.material.color.getHexString()) && !o.material.map; });
    const speed = 2.4 / TRACK_R; // ~2.4 units a second: once round in a bit over a minute
    train.userData.tapHeight = 1;
    train.userData.tick = (dt, t) => {
      const a = 2.2 + t * speed;
      train.position.set(Math.cos(a) * TRACK_R, -0.03, Math.sin(a) * TRACK_R);
      train.rotation.y = -(a + Math.PI / 2); // engine (+X) along the track
    };
    s.add(train);
    hub.tappable(train, () => { sfx.toot(); hop(train, 0.4); });
    if (newTypes.has('train')) { reveal.push([train, 0]); setTimeout(() => sfx.toot(), 900); }
  }

  // --- balloons tied to the Lookout ---
  for (let i = 0; i < world.balloonsAtLookout; i++) {
    const a = BALLOON_ANGLES[i % BALLOON_ANGLES.length];
    const bl = makeBalloon(BALLOON_COLORS[i % BALLOON_COLORS.length]);
    bl.scale.setScalar(0.85);
    bl.userData = {};
    flatten(bl);
    bl.traverse((o) => { o.castShadow = false; });
    const base = LOOKOUT.clone().add(new THREE.Vector3(Math.sin(a) * 3.45, 2.3 + 2.4 + (i % 2) * 0.5, Math.cos(a) * 3.45));
    bl.position.copy(base);
    bl.userData.tick = (dt, t) => {
      bl.position.y = base.y + Math.sin(t * 1.3 + i) * 0.12;
      bl.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.08;
    };
    s.add(bl);
    if (i >= world.balloonsAtLookout - newBalloons) reveal.push([bl, 0]);
  }

  // --- party lights round the Lookout's decks ---
  if (world.lookoutLights) {
    const isNew = newTypes.has('lookout-lights');
    const lights = makeLookoutLights({ darkFor: isNew ? 1.6 + reveal.length * 0.65 : 0 }); // new: they switch on
    lights.position.copy(LOOKOUT);
    s.add(lights);
    if (isNew) setTimeout(() => hub.alive && sfx.ding(), (1.6 + reveal.length * 0.65) * 1000);
  }

  // new things pop in, one after another, with sparkles
  reveal.forEach(([obj], i) => {
    const s0 = obj.scale.clone();
    obj.scale.setScalar(0.001);
    setTimeout(() => {
      if (!hub.alive) return;
      sfx.pop();
      sparkle(hub, obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1, 0)), { count: 18, size: 0.25, speed: 2 });
      animate(700, (t) => obj.scale.copy(s0).multiplyScalar(Math.max(0.001, t)), ease.back);
    }, 900 + i * 650);
  });

  const lines = [];
  if (newKittens) lines.push(...T.worldKitten());
  if (newTypes.has('bridge')) lines.push(...T.worldBridge());
  if (newTypes.has('train')) lines.push(...T.worldTrain());
  if (newBalloons) lines.push(...T.worldBalloon());
  if (newTypes.has('lookout-lights')) lines.push(...T.worldLights());
  return lines;
}

// ---------- hub events (adventure/events.js): a story at a place, tap it to go there ----------
// a tree of its own for the lost kitten, where the island's random trees never grow (always in view)
// (front left, between Balloon Hill and the Name Train: in frame on any screen, off the roads)
const KITTEN_TREE = new THREE.Vector3(-9.8, 0, 11.2);
const BALLOON_HILL = new THREE.Vector3(-13.5, 0, 8);

/** Show an event on the island. Returns { nudge() } (a little sound when the hub reminds her). */
export function addEvent(hub, event) {
  const go = () => hub.go(event.mission);
  if (event.id === 'lost-kitten') return lostKitten(hub, go);
  if (event.id === 'balloons-escaping') return escapingBalloons(hub, go);
  if (event.id === 'lookout-alarm') return lookoutAlarm(hub, go);
  return { nudge() {} };
}

let alertTex = null;
/** A white speech bubble with a red "!" (drawn once). */
function alertTexture() {
  if (alertTex) return alertTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ef4444'; g.lineWidth = 14;
  g.beginPath(); g.arc(128, 116, 96, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(104, 206); g.lineTo(128, 246); g.lineTo(152, 206); g.closePath(); g.fillStyle = '#ef4444'; g.fill(); // the bubble's tail
  g.fillStyle = '#ef4444'; g.font = '700 150px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('!', 128, 124);
  alertTex = new THREE.CanvasTexture(c);
  alertTex.colorSpace = THREE.SRGBColorSpace;
  return alertTex;
}

/** "!" in a speech bubble, bobbing over something. */
function alertBubble(hub, at, go) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false }));
  sp.scale.setScalar(1.3);
  sp.renderOrder = 5;
  sp.userData.tapHeight = 0;
  sp.userData.tick = (dt, t) => { sp.position.set(at.x, at.y + Math.sin(t * 3) * 0.15, at.z); sp.scale.setScalar(1.3 + Math.max(0, Math.sin(t * 6)) * 0.12); };
  hub.scene.add(sp);
  hub.tappable(sp, go);
  return sp;
}

function lostKitten(hub, go) {
  const tree = makeTree({ type: 'round', scale: 1.05, seed: 77 });
  tree.position.copy(KITTEN_TREE);
  hub.scene.add(tree);
  const top = new THREE.Box3().setFromObject(tree).max.y;
  const perch = KITTEN_TREE.clone().setY(top - 0.35);
  const k = makeKitten();
  k.scale.setScalar(1.4);
  k.position.copy(perch);
  k.rotation.y = 0.4;
  k.userData.tapHeight = 0.6;
  k.userData.tick = (dt, t) => { k.userData.idle(t); k.rotation.z = Math.sin(t * 2.2) * 0.08; }; // a bit wobbly up there
  hub.scene.add(k);
  hub.tappable(k, go);
  alertBubble(hub, perch.clone().add(new THREE.Vector3(0, 2.1, 0)), go);
  setTimeout(() => hub.alive && sfx.meow(), 1200);
  return { nudge: () => sfx.meow() };
}

function escapingBalloons(hub, go) {
  const cols = ['#ef4444', '#3b82f6', '#f59e0b'];
  cols.forEach((c, i) => {
    const b = makeBalloon(c, labelTexture('ABC'[i]));
    b.scale.setScalar(0.8);
    b.userData.tapHeight = 0;
    const phase = i / cols.length;
    b.userData.tick = (dt, t) => {
      const k = (t / 9 + phase) % 1; // rise for 9 s, then a new one comes up
      const a = i * 2.1 + k * 3;
      b.position.set(BALLOON_HILL.x + Math.cos(a) * (1 + k * 1.5), 3 + k * 6.5, BALLOON_HILL.z + Math.sin(a) * (1 + k * 1.2));
      b.scale.setScalar(0.8 * Math.min(1, k * 8, (1 - k) * 6));
      b.rotation.z = Math.sin(t * 1.5 + i) * 0.15;
    };
    hub.scene.add(b);
    hub.tappable(b, go);
  });
  return { nudge: () => sfx.pop() };
}

function lookoutAlarm(hub, go) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 3, roughness: 0.3 });
  const beacon = mesh(new THREE.SphereGeometry(0.5, 16, 12), red, { y: 12.6, shadow: false });
  g.add(beacon);
  // a red band flashing round the top deck: easy to see from anywhere on the island
  g.add(mesh(new THREE.TorusGeometry(2.72, 0.16, 8, 48), red, { y: 9.9, rx: Math.PI / 2, shadow: false }));
  g.add(mesh(new THREE.TorusGeometry(3.3, 0.14, 8, 48), red, { y: 2.6, rx: Math.PI / 2, shadow: false }));
  g.position.set(0, 0, -10.5);
  g.userData.tapHeight = 9;
  g.userData.tick = (dt, t) => {
    const on = Math.sin(t * 9) > 0;
    red.emissiveIntensity = on ? 4.5 : 0.3;
    beacon.scale.setScalar(on ? 1.2 : 1);
  };
  hub.scene.add(g);
  hub.tappable(g, go);
  alertBubble(hub, new THREE.Vector3(4.4, 8.6, -9.4), go);
  setTimeout(() => hub.alive && sfx.siren(2), 900);
  return { nudge: () => sfx.siren(1) };
}

/**
 * n kittens drawn as instances: every kitten shares one mesh per colour (a handful of draw calls for all of
 * them). Returns an invisible tap box per kitten: move / scale / hop that, the kitten follows. Tails wag.
 */
function makeKittens(scene, n) {
  const tpl = makeKitten();
  const tail = tpl.children.find((c) => c.userData.keep);
  tail.removeFromParent();
  tail.updateMatrix();
  const tailBase = tail.matrix.clone();
  tpl.userData = {};
  flatten(tpl);
  const SCALE = new THREE.Matrix4().makeScale(1.25, 1.25, 1.25);
  const inst = (geo, material, shadow) => {
    const im = new THREE.InstancedMesh(geo, material, n);
    im.castShadow = shadow;
    im.frustumCulled = false;
    im.userData.dynamic = true;
    scene.add(im);
    return im;
  };
  const parts = tpl.children.filter((m) => m.isMesh).map((m) => inst(m.geometry, m.material, m.material.color.getHexString() === 'fb923c'));
  const tails = inst(tail.geometry, tail.material, false);
  const boxes = Array.from({ length: n }, () => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 1.1).translate(0, 0.55, 0), new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(b);
    return b;
  });
  const m = new THREE.Matrix4(), wag = new THREE.Matrix4();
  // after the boxes have moved this frame: copy their transforms into the instances
  const sync = new THREE.Object3D();
  sync.userData.tick = (dt, t) => {
    boxes.forEach((b, i) => {
      b.updateMatrixWorld();
      m.multiplyMatrices(b.matrixWorld, SCALE);
      parts.forEach((p) => p.setMatrixAt(i, m));
      wag.makeRotationZ(Math.sin(t * 5 + i) * 0.4).premultiply(tailBase);
      tails.setMatrixAt(i, wag.premultiply(m));
    });
    [...parts, tails].forEach((p) => { p.instanceMatrix.needsUpdate = true; });
  };
  scene.add(sync); // added last: ticks after the kittens' own movement
  return boxes;
}

/** A little arched wooden bridge with red rails, across the pond (local x, behind the stones). */
function makeBridge() {
  const g = new THREE.Group();
  const wood = mat('#b7793f', { roughness: 0.8 }), red = mat('#e23b3b', { roughness: 0.45 });
  const L = 7.6, N = 17, H = 0.75, z = -1.95;
  const yAt = (x) => 0.18 + Math.cos((x / L) * Math.PI) * H; // highest in the middle
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + (i + 0.5) * (L / N);
    const slope = Math.atan(-Math.sin((x / L) * Math.PI) * H * Math.PI / L);
    g.add(mesh(rbox(L / N - 0.04, 0.1, 1.1, 0.02), wood, { x, y: yAt(x), z, rz: slope }));
  }
  for (const side of [-0.52, 0.52]) {
    const pts = Array.from({ length: 12 }, (_, i) => { const x = -L / 2 + 0.2 + (i / 11) * (L - 0.4); return new THREE.Vector3(x, yAt(x) + 0.5, z + side); });
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.05, 6), red));
    for (let i = 0; i < 6; i++) { const x = -L / 2 + 0.3 + (i / 5) * (L - 0.6); g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), red, { x, y: yAt(x) + 0.25, z: z + side })); }
  }
  return g;
}

/** Rails round the beach: two thin rings and a lot of sleepers (all static: merged into a few meshes). */
function makeTrack(r) {
  const g = new THREE.Group();
  const steel = mat('#8b95a5', { metalness: 0.5, roughness: 0.4 }), wood = mat('#8a5a2b', { roughness: 0.9 });
  for (const rr of [r - 0.38, r + 0.38]) g.add(mesh(new THREE.RingGeometry(rr - 0.05, rr + 0.05, 160), steel, { y: 0.0, rx: -Math.PI / 2, shadow: false }));
  const n = 150;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(mesh(new THREE.BoxGeometry(1.0, 0.05, 0.22), wood, { x: Math.cos(a) * r, y: -0.03, z: Math.sin(a) * r, ry: -a, shadow: false }));
  }
  return g;
}

/** Bulbs round both decks, chasing colours. darkFor: seconds before they switch on. */
function makeLookoutLights({ darkFor = 0 } = {}) {
  const g = new THREE.Group();
  const cols = ['#ff4d4d', '#ffd23f', '#4dd2ff', '#7dff6a'];
  const mats = cols.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2, roughness: 0.3 }));
  const ring = (y, r, n) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), mats[i % mats.length], { x: Math.sin(a) * r, y, z: Math.cos(a) * r, shadow: false }));
    }
  };
  ring(9.72 * 0.95, 2.98 * 0.95, 24); // top deck rim
  ring(2.3 * 0.95, 3.4 * 0.95, 20);   // first floor balcony
  g.userData.bakeInside = true; // rigid: merged into one mesh per colour
  let dark = darkFor, on = darkFor > 0 ? 0 : 1;
  g.userData.tick = (dt, t) => {
    if (dark > 0) dark -= dt; else on = Math.min(1, on + dt * 1.5);
    mats.forEach((m, i) => (m.emissiveIntensity = on * (1.2 + 2.6 * Math.max(0, Math.sin(t * 3 - i * (Math.PI / 2))))));
  };
  return g;
}
