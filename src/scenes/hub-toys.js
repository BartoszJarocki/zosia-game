// Things on the island that just do something when tapped, with no mission and no words: the boats toot, the
// lighthouse flashes, the windmill whirls, a kitten peeks out of a house door, the grass sparkles, the sea splashes.
// The ground and the sea also catch every tap that hits nothing else, so a place starts only from its own spot
// (the engine's fallback otherwise gives the nearest place any tap within 14 % of the screen).
import * as THREE from 'three';
import { animate, ease, camera } from '../engine.js';
import { makeKitten, mat, mesh, rbox } from '../models.js';
import { sparkle } from '../fx/particles.js';
import { sfx } from '../audio.js';

/** A tap that hit only the ground still reaches something small this close (a fraction of the screen). */
export const NEAR = 0.07;
const ISLAND_R = 24;

/**
 * Add the toys and the ground. { boats, lighthouse, windmill, houses } come from the hub.
 * Returns a cleanup function for the hub's exit().
 */
export function addToys(hub, { boats = [], lighthouse, windmill, houses = [] }) {
  boats.forEach((b) => toot(hub, b));
  if (lighthouse) beacon(hub, lighthouse);
  if (windmill) whirl(hub, windmill);
  houses.forEach((h, i) => peekaboo(hub, h, i));
  return ground(hub);
}

/** A boat: a toot, and it bobs up on a wave. (Its own tick sails it round the bay; the bob rides on top.) */
function toot(hub, boat) {
  const sail = boat.userData.tick;
  let lift = 0;
  boat.userData.tick = (dt, t) => { sail(dt, t); boat.position.y += lift; };
  boat.userData.tapHeight = 1;
  hub.tappable(boat, () => {
    sfx.toot();
    animate(900, (k) => { lift = Math.sin(k * Math.PI) * 1.4; }, ease.out);
  });
}

/** The lighthouse: its lamp flashes and the beam sweeps round fast for a moment. */
function beacon(hub, lh) {
  let lamp = null, pivot = null, beam = null;
  lh.traverse((o) => {
    if (o.userData.tick) pivot = o;
    if (o.material?.emissiveIntensity === 3.5) lamp = o;
  });
  beam = pivot?.children[0];
  if (!lamp || !pivot || !beam) return;
  lamp.material = lamp.material.clone(); // (the shared one lights other scenes too)
  const turn = pivot.userData.tick;
  let fast = 0;
  pivot.userData.tick = (dt, t) => { turn(dt, t); pivot.rotation.y += dt * fast; };
  lh.userData.tapHeight = 6;
  hub.tappable(lh, () => {
    sfx.ding();
    animate(2600, (k) => {
      const flash = Math.abs(Math.sin(k * Math.PI * 5)) * (1 - k);
      lamp.material.emissiveIntensity = 3.5 + flash * 14;
      beam.material.opacity = 0.18 + flash * 0.5;
      fast = 9 * (1 - k);
    }, ease.linear);
  });
}

/** Balloon Hill's windmill: a whoosh and the sails whirl. (A real thing: it wins over the place's tap zone.) */
function whirl(hub, w) {
  let sails = null;
  w.traverse((o) => { if (o.userData.tick) sails = o; });
  if (!sails) return;
  const turn = sails.userData.tick;
  let fast = 0;
  sails.userData.tick = (dt, t) => { turn(dt, t); sails.rotation.z -= dt * fast; };
  w.userData.tapHeight = 3;
  hub.tappable(w, () => {
    sfx.whoosh();
    animate(2200, (k) => { fast = 14 * (1 - k) * (1 - k); }, ease.linear);
  });
}

/** A house: its door swings open, a kitten peeks out and meows, then it pops back in and the door shuts. */
function peekaboo(hub, house, i) {
  const hinge = new THREE.Group();
  hinge.position.set(-0.3, 0, 1.12); // the door's left edge, just in front of the painted one (house-local)
  hinge.add(mesh(rbox(0.6, 1.0, 0.07, 0.04), mat('#8b4513'), { x: 0.3, y: 0.5 }));
  hinge.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), mat('#fbbf24', { metalness: 0.5 }), { x: 0.5, y: 0.5, z: 0.05, shadow: false }));
  hinge.userData.dynamic = true;
  house.add(hinge);
  let kitten = null, open = false;
  // the house itself stays merged scenery: an invisible box over it takes the tap
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.3), new THREE.MeshBasicMaterial({ visible: false }));
  box.position.y = 1.3;
  box.userData.tapHeight = 0;
  house.add(box);
  hub.tappable(box, async () => {
    if (open) return;
    open = true;
    if (!kitten) {
      kitten = makeKitten(['#9ca3af', '#f8fafc', '#fb923c', '#374151'][i % 4]);
      kitten.userData.tick = (dt, t) => kitten.userData.idle(t);
      kitten.userData.dynamic = true;
      house.add(kitten);
      hub.collect(kitten);
    }
    kitten.position.set(0, 0, 0.75);
    kitten.scale.setScalar(0.001);
    sfx.doors();
    await animate(350, (k) => { hinge.rotation.y = -1.7 * k; }, ease.out);
    setTimeout(() => hub.alive && sfx.meow(), 150);
    await animate(450, (k) => { kitten.position.z = 0.75 + 0.6 * k; kitten.scale.setScalar(Math.max(0.001, 0.75 * k)); }, ease.back);
    await animate(1600, () => {}, ease.linear);
    await animate(350, (k) => { kitten.position.z = 1.35 - 0.6 * k; kitten.scale.setScalar(Math.max(0.001, 0.75 * (1 - k))); }, ease.in);
    await animate(350, (k) => { hinge.rotation.y = -1.7 * (1 - k); }, ease.inOut);
    open = false;
  });
}

/**
 * The ground under everything (an invisible tap zone, so any place's own zone in front of it wins).
 * Its tap: something small near the finger gets it; otherwise the grass sparkles or the sea splashes.
 */
function ground(hub) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false }));
  plane.userData.zone = true;
  plane.userData.tapHeight = 0;
  hub.scene.add(plane);
  const at = { x: 0, y: 0 };
  const where = (e) => { at.x = e.clientX; at.y = e.clientY; };
  window.addEventListener('pointerdown', where, true); // (before the engine's own handler on the canvas)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), p = new THREE.Vector3();
  hub.tappable(plane, () => {
    const near = nearest(hub, at, Math.min(innerWidth, innerHeight) * NEAR, plane);
    if (near) return near.userData.onTap(near);
    ndc.set((at.x / innerWidth) * 2 - 1, -(at.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(plane)[0];
    if (hit) hub.groundToy(hit.point.clone(), Math.hypot(hit.point.x, hit.point.z) < ISLAND_R ? 'grass' : 'sea');
  });
  hub.groundToy = (point, what) => (what === 'grass' ? sparkleGrass(hub, point) : splash(hub, point));
  return () => window.removeEventListener('pointerdown', where, true);
}

/** The nearest real tappable (not a zone) within maxD screen pixels of the tap, or null. */
function nearest(hub, at, maxD, skip) {
  let best = maxD, target = null;
  const w = new THREE.Vector3();
  for (const o of hub.tappables) {
    if (o === skip || !o.visible || o.userData.zone) continue;
    o.getWorldPosition(w);
    w.y += (o.userData.tapHeight ?? 0.8) * o.scale.y;
    w.project(camera);
    const d = Math.hypot((w.x + 1) / 2 * innerWidth - at.x, (1 - w.y) / 2 * innerHeight - at.y);
    if (d < best && w.z < 1) { best = d; target = o; }
  }
  return target;
}

function sparkleGrass(hub, p) {
  sfx.pop();
  sparkle(hub, p.setY(0.4), { count: 12, size: 0.3, speed: 1.8 });
}

const rippleMat = () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false });
function splash(hub, p) {
  sfx.splash();
  const ring = mesh(new THREE.RingGeometry(0.8, 1.1, 32), rippleMat(), { rx: -Math.PI / 2, shadow: false });
  ring.position.set(p.x, -0.15, p.z);
  hub.scene.add(ring);
  sparkle(hub, p.setY(0.3), { count: 8, size: 0.35, speed: 2 });
  animate(1100, (k) => { ring.scale.setScalar(1 + k * 3); ring.material.opacity = 0.8 * (1 - k); }, ease.out).then(() => ring.removeFromParent());
}
