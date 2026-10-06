// Micro-play rewards in the hub (adventure/micro.js decides which): a few seconds of pure play after a
// mission. Something sparkles (a soft glowing ring under it, little bursts) and does something fun when tapped.
// No speech, nothing to get wrong; the hub works as usual meanwhile, and the invitation simply fades.
import * as THREE from 'three';
import { animate, ease, hop } from '../engine.js';
import { mesh } from '../models.js';
import { sparkle } from '../fx/particles.js';
import { sfx } from '../audio.js';
import { MICRO_MS } from '../adventure/micro.js';

/**
 * Start one. objs: { truck, pup, girl, kittens: [box…], train } from the hub.
 * Returns { type, active(), onTruck(), onPup(), onKitten(k), onTrain() } — the hub routes taps through it.
 */
export function runMicroReward(hub, type, objs) {
  const until = performance.now() + MICRO_MS;
  const active = () => performance.now() < until && hub.alive;
  const r = { type, active };
  const cue = (obj, size, opts) => invite(hub, obj, size, active, opts);

  if (type === 'HONK') {
    cue(objs.truck, 3.4, { pulse: 0.05 });
    r.onTruck = () => { sfx.honk(); hop(objs.truck, 0.25, 380); };
  } else if (type === 'SIREN') {
    cue(objs.truck, 3.4, { pulse: 0.05 });
    r.onTruck = () => {
      sfx.siren(2);
      objs.truck.userData.setFlashing(true);
      clearTimeout(r.lightsOff);
      r.lightsOff = setTimeout(() => !hub.busy && objs.truck.userData.setFlashing(false), 2600);
    };
  } else if (type === 'BUBBLES') {
    bubbles(hub, active);
  } else if (type === 'CHASE_DANCE') {
    cue(objs.pup, 0, { pulse: 0.14 }); // (sitting in the cruiser: no ground ring, he pulses instead)
    r.onPup = () => dance(objs.pup);
  } else if (type === 'PET_KITTEN' && objs.kittens?.length) {
    const spot = new THREE.Vector3(-2.7, 0.06, 1.8); // beside the cruiser, on the kittens' side
    const k = objs.kittens.reduce((a, b) => (a.position.distanceTo(spot) <= b.position.distanceTo(spot) ? a : b));
    k.userData.visit = spot; // the nearest kitten comes over
    setTimeout(() => { if (k.userData.visit) k.userData.visit = null; }, MICRO_MS);
    cue(k, 1);
    r.onKitten = (box) => { if (box !== k) return; objs.pup.userData.setHappy(2); setTimeout(() => sfx.bark(), 350); }; // Chase likes it too
  } else if (type === 'TRAIN_WHISTLE' && objs.train) {
    cue(objs.train, 2.2);
    r.onTrain = () => {
      sfx.whistle();
      const at = objs.train.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.2, 0));
      sparkle(hub, at, { count: 14, size: 0.3, speed: 1.5 });
      return true; // (instead of the usual toot)
    };
  }
  return r;
}

/**
 * "Tap me": a glowing ring on the ground around obj (size = radius, 0 for none), little sparkle bursts above it,
 * and optionally a gentle pulse of obj itself (for things off the ground, like Chase in the cruiser).
 */
function invite(hub, obj, size, active, { pulse = 0 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: '#ffe970', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = size ? mesh(new THREE.RingGeometry(size * 0.8, size, 48), mat, { rx: -Math.PI / 2, shadow: false }) : null;
  if (ring) { ring.renderOrder = 3; hub.scene.add(ring); }
  const p = new THREE.Vector3(), s0 = obj.scale.clone();
  let next = 0, fade = 1;
  const off = hub.onUpdate((dt, t) => {
    obj.getWorldPosition(p);
    if (!active()) fade = Math.max(0, fade - dt * 1.5);
    if (ring) {
      ring.position.set(p.x, 0.12, p.z);
      mat.opacity = fade * (0.6 + Math.sin(t * 5) * 0.35);
      ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
    }
    if (pulse && !obj.userData.hopping && !obj.userData.dancing) obj.scale.copy(s0).multiplyScalar(1 + fade * Math.max(0, Math.sin(t * 6)) * pulse);
    if (fade === 1 && t > next) { next = t + 0.8; sparkle(hub, p.clone().add(new THREE.Vector3(0, Math.max(1.2, size * 0.8), 0)), { count: 9, size: 0.24, speed: 1.5 }); }
    if (fade === 0) { off(); ring?.removeFromParent(); if (pulse) obj.scale.copy(s0); }
  });
}

/** Chase dances: a spin, a bounce, a wag, a little tune. */
function dance(pup) {
  if (pup.userData.dancing) return;
  pup.userData.dancing = true;
  sfx.jingle();
  pup.userData.setHappy(3);
  const y0 = pup.position.y, r0 = pup.rotation.y;
  animate(1500, (t) => {
    pup.rotation.y = r0 + t * Math.PI * 2;
    pup.position.y = y0 + Math.abs(Math.sin(t * Math.PI * 3)) * 0.35;
  }, ease.inOut).then(() => { pup.rotation.y = r0; pup.position.y = y0; pup.userData.dancing = false; sfx.bark(); });
}

/** Bubbles float up around the heroes; tap to pop. New ones keep coming while the invitation lasts. */
function bubbles(hub, active) {
  const mat = new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#4fb4ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.62, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const geo = new THREE.SphereGeometry(0.5, 20, 14), glintGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const live = new Set();
  let next = 0;
  const off = hub.onUpdate((dt, t) => {
    if (active() && live.size < 8 && t > next) {
      next = t + 0.6;
      const b = new THREE.Mesh(geo, mat);
      b.add(new THREE.Mesh(glintGeo, glint).translateX(-0.2).translateY(0.22).translateZ(0.3)); // a shiny spot
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3;
      b.position.set(Math.cos(a) * r, 1, 2 + Math.sin(a) * r * 0.6);
      b.userData.tapHeight = 0;
      b.userData.v = 0.7 + Math.random() * 0.4;
      b.userData.phase = Math.random() * 6;
      b.scale.setScalar(0.8 + Math.random() * 0.5);
      hub.scene.add(b);
      hub.tappable(b, () => {
        sfx.bubble();
        sparkle(hub, b.position.clone(), { count: 8, size: 0.15, speed: 1.6 });
        hub.untap(b); b.removeFromParent(); live.delete(b);
      });
      live.add(b);
    }
    for (const b of live) {
      b.position.y += b.userData.v * dt;
      b.position.x += Math.sin(t * 1.5 + b.userData.phase) * dt * 0.4;
      if (b.position.y > 9) { hub.untap(b); b.removeFromParent(); live.delete(b); }
    }
    if (!active() && live.size === 0) off();
  });
}
