import * as THREE from 'three';
import { Stage, animate, ease, addSkyAndLights, hop, wait } from '../engine.js';
import { makeTruck, seatRiders, makeKitten, makeBone, makeCone, makeBalloon, makeStone, makeTrain, star, mat, mesh, rbox } from '../models.js';
import { makePup, makeGirl } from '../characters.js';
import { makeTree, makeBush, makeRock, makeCloud, makeHills, makeMeadowDetail, makeButterfly, makeBird, contactShadow } from '../world/nature.js';
import { makeLookout, makeHouse, makePupHouse, makeLighthouse, makeBoat, makeWindmill, makeFence } from '../world/props.js';
import { makeWater, makeShoreFoam } from '../world/water.js';
import { dust, sparkle } from '../fx/particles.js';
import { glyphTexture, labelTexture, discTexture } from '../textures.js';
import { groundMat } from '../scenery.js';
import { CONFIG } from '../config.js';
import { levelFor, getWorld } from '../progress.js';
import { maxLevel } from '../levels/data.js';
import { detail } from './mission.js';
import { say, sfx, hush } from '../audio.js';
import { pick } from '../util.js';
import { T, HOME_TASKS } from '../lang/pl.js';
import { getSession, startSession, dev } from '../session/session.js';
import { nextStep, suggestNext, callFinale, ending, sayGoodbye } from '../session/director.js';
import { homeTaskKind } from '../session/home-task.js';
import { confetti } from '../ui.js';
import { takeUnseen } from '../adventure/rewards.js';
import { addWorld, addEvent, KITTEN_LAWN } from './hub-world.js';
import { runMicroReward } from './hub-micro.js';
import { addToys } from './hub-toys.js';
import { pickMicroReward, microDue } from '../adventure/micro.js';
import { pickEvent } from '../adventure/events.js';

const START = new THREE.Vector3(0, 0, 0);
const HOME_VIEW = { pos: new THREE.Vector3(0, 27, 31), look: new THREE.Vector3(0, 2.2, 1.2) };
const portrait = () => innerHeight > innerWidth;

// Letter games on the left, number games on the right.
const PLACES = {
  letters: { at: [-15, -3] },
  balloons: { at: [-13.5, 8] },
  name: { at: [-5.5, 14.5] },
  cones: { at: [5.5, 14.5] },
  stones: { at: [13.5, 8] },
  counting: { at: [15, -3] },
  // the Lookout itself: drive round the sandy circle and up to its door
  // behind, either side of the Lookout (roads curve back to them)
  delivery: { at: [-9.5, -8.5], via: [[-2.6, -1.8], [-5, -4.6]] },
  picnic: { at: [9.5, -8.5], via: [[2.6, -1.8], [5, -4.6]] },
  lookout: { at: [0, -10.5], marker: [2.9, 7.9, -5.9], hit: [3.8, 14],
    drive: [[0, 0], [1.7, 1.1], [2.0, -1.6], [0.5, -3.7], [0, -6.1]], road: [[0, -2.6], [0, -6.4]] },
};

// the island's houses: [x, z, wall, roof] (Pup Delivery's parcels end up at their doors)
const HOUSES = [[-20, 2.5, '#fbcfe8', '#16a34a'], [20, 2.5, '#fed7aa', '#2563eb'], [-11, -14, '#bbf7d0', '#f97316'], [11, -14, '#fecaca', '#0891b2']];

export class Hub extends Stage {
  constructor(game, { greet = false, silent = false } = {}) {
    super();
    this.game = game;
    this.greet = greet;
    this.silent = silent; // behind the start screen: slow orbit, no talking
    // portrait: frame closer (the sides of the beach go, every place stays in view)
    this.view = { pos: HOME_VIEW.pos.clone(), look: HOME_VIEW.look.clone(), get minWidth() { return portrait() ? 36.5 : 40; } };
    this.post = { tilt: 0.75, focus: 0.4, band: 0.34 }; // sharp where the places are, dreamy sea on top
    this.drift = 0.25;
  }

  enter() {
    const s = this.scene;
    addSkyAndLights(s, { shadowSize: 27, sunPos: [16, 28, 18], fogNear: 90, fogFar: 260 });

    // sea: turquoise shallows fading to deep blue, sun glints, shore foam
    const water = makeWater({ repeat: 46, radial: true, flow: [0.006, 0.004], scale: 0.5,
      stops: [[0, '#7ff0e6'], [0.12, '#62e2e4'], [0.17, '#33c1ec'], [0.35, '#1f8fdf'], [1, '#1a5fbf']] });
    const sea = mesh(new THREE.CircleGeometry(230, 96), water.material, { y: -0.3, rx: -Math.PI / 2, shadow: false });
    sea.receiveShadow = true;
    sea.userData.tick = water.update;
    s.add(sea);
    const foam = makeShoreFoam(27.1, 1.6);
    foam.mesh.position.y = -0.25;
    foam.mesh.userData.tick = foam.update;
    s.add(foam.mesh);
    s.add(mesh(new THREE.CylinderGeometry(26.4, 27.4, 1, 128), mat('#f4d88f', { roughness: 1 }), { y: -0.55 }));
    s.add(mesh(new THREE.CylinderGeometry(24, 24.8, 1, 128), groundMat('#5dbb4f', 34), { y: -0.44 }));

    // the mainland across the bay + lighthouse + boats (the lighthouse and the back of the bay are in view: toys)
    s.add(makeHills({ radius: 105, count: 16, height: [9, 22], color: '#58b957', seed: 7, trees: detail() > 0.5 }));
    const rock = makeRock({ scale: 4, seed: 3 });
    rock.position.set(-22, -1, -27);
    s.add(rock);
    const lh = makeLighthouse();
    lh.position.set(-22, 1.2, -27);
    lh.scale.setScalar(1.3);
    s.add(lh);
    const boats = [['#ef4444', 36, 0.03], ['#f59e0b', 41, -0.022], ['#8b5cf6', 47, 0.017]].map(([c, r, sp], i) => {
      const b = makeBoat(c);
      b.scale.setScalar(1.4);
      const a0 = i * 2.1;
      b.userData.mergeOK = true;
      b.userData.tick = (dt, t) => {
        const a = a0 + t * sp;
        b.position.set(Math.cos(a) * r, -0.35 + Math.sin(t * 1.4 + i) * 0.12, Math.sin(a) * r);
        b.rotation.y = -a + (sp > 0 ? 0 : Math.PI);
        b.rotation.z = Math.sin(t * 1.1 + i) * 0.05;
      };
      s.add(b);
      return b;
    });

    // Lookout
    const lookout = makeLookout();
    lookout.traverse((o) => { if (o.material?.color?.getHexString() === '8fd8ff') this.glass = o.material; }); // its windows light up at dusk (found now: the static scenery is merged after enter)
    lookout.position.set(0, 0, -10.5);
    lookout.scale.setScalar(0.95);
    s.add(lookout);

    // roads to every place
    s.add(mesh(new THREE.CircleGeometry(3.4, 48), mat('#e8d5a3', { roughness: 1 }), { y: 0.09, rx: -Math.PI / 2 }));
    s.add(mesh(new THREE.RingGeometry(3.4, 3.75, 48), mat('#c9b27a', { roughness: 1 }), { y: 0.085, rx: -Math.PI / 2, shadow: false }));
    for (const kind of Object.keys(PLACES)) {
      const p = PLACES[kind];
      p.pos = new THREE.Vector3(p.at[0], 0, p.at[1]);
      if (p.drive) {
        p.curve = new THREE.CatmullRomCurve3(p.drive.map(([x, z]) => new THREE.Vector3(x, 0, z)));
        s.add(makeRoad(new THREE.CatmullRomCurve3(p.road.map(([x, z]) => new THREE.Vector3(x, 0, z)))));
        continue;
      }
      const park = p.pos.clone().add(START.clone().sub(p.pos).setLength(4.2));
      if (p.via) { // places behind: straight out the back of the roundabout
        p.curve = new THREE.CatmullRomCurve3([START.clone(), ...p.via.map(([x, z]) => new THREE.Vector3(x, 0, z)), park]);
        s.add(makeRoad(p.curve));
        continue;
      }
      const p1 = new THREE.Vector3(0, 0, 2.8);
      const mid = p1.clone().lerp(park, 0.5).add(new THREE.Vector3(0, 0, 1.5));
      p.curve = new THREE.CatmullRomCurve3([START.clone(), p1, mid, park]);
      s.add(makeRoad(p.curve));
    }
    const roadPts = Object.values(PLACES).flatMap((p) => p.curve.getSpacedPoints(24));
    const nearRoad = (x, z) => roadPts.some((q) => Math.hypot(q.x - x, q.z - z) < 2.6);

    // places
    const builders = { letters: makeLetterPark, balloons: makeBalloonHill, name: makeNameTrain, cones: makeConeRoad, stones: makeRiver, counting: makeTreatHouse, delivery: makePostOffice, picnic: makePicnic };
    this.placeGroups = {};
    for (const kind of Object.keys(PLACES)) this.addPlace(kind, (this.placeGroups[kind] = builders[kind]?.())); // (the Lookout is already standing)
    const houses = HOUSES.map(([x, z, w, r]) => {
      const h = makeHouse(w, r);
      h.position.set(x, 0, z);
      h.scale.setScalar(1.15);
      h.lookAt(new THREE.Vector3(x * 0.4, 0, 40));
      s.add(h);
      return h;
    });
    this.dropToys = addToys(this, { boats, lighthouse: lh, windmill: this.placeGroups.balloons?.windmill, houses });
    // what she has done shows on the island (new things are revealed, but not behind the start screen)
    ({ lines: this.worldLines, objs: this.worldObjs } = addWorld(this, getWorld(), this.silent ? [] : takeUnseen(), { places: this.placeGroups, houses }));

    // trees, bushes, grass — kept off the roads, places, houses and the kittens' lawn; the same every visit
    const keepOut = [[0, -10.5, 5], [0, 0, 4], KITTEN_LAWN, ...HOUSES.map(([x, z]) => [x, z, 2]), ...Object.values(PLACES).map((p) => [p.at[0], p.at[1], 4])];
    const clear = (x, z, pad = 1) => keepOut.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + pad) && !nearRoad(x, z);
    const rnd = seeded(20261028);
    let seed = 1;
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2, r = 5 + Math.sqrt(rnd()) * 18;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z, 1.2) || (z > 9 && Math.abs(x) < 17) || (z > 4 && Math.abs(x) > 17)) continue;
      if (i % 4 === 0) { const b = makeBush({ seed: seed++, scale: 0.8 + rnd() * 0.4 }); b.position.set(x, 0, z); s.add(b); continue; }
      const t = makeTree({ scale: 0.95 + rnd() * 0.6, seed: seed++ });
      t.position.set(x, 0, z);
      s.add(t);
    }
    const k = detail();
    s.add(makeMeadowDetail({ radius: 23.6, blades: Math.round(9000 * k), flowers: Math.round(260 * k) + 60, keepOut: keepOut.map(([x, z, r]) => [x, z, r - 0.5]), reject: nearRoad, seed: 5 }));
    for (let i = 0; i < 4; i++) s.add(makeButterfly({ center: [(i - 1.5) * 8, 4 + (i % 2) * 6], radius: 4, height: 1.4, color: ['#f472b6', '#fbbf24', '#60a5fa', '#a78bfa'][i] }));
    for (let i = 0; i < 4; i++) s.add(makeBird({ radius: 34 + i * 5, height: 20 + i * 2, speed: 0.08 + i * 0.01, seed: i * 1.7 }));
    for (let i = 0; i < 8; i++) {
      const c = makeCloud({ scale: 2.4 + rnd() * 1.8, seed: i * 13 });
      c.position.set(-90 + i * 26, 26 + rnd() * 10, -70 - rnd() * 30);
      c.userData.tick = (dt) => { c.position.x += dt * 0.6; if (c.position.x > 110) c.position.x = -110; };
      c.userData.mergeOK = true;
      s.add(c);
    }

    // the cruiser with our heroes inside
    const truck = (this.truck = makeTruck());
    truck.position.copy(START);
    truck.scale.setScalar(1.9);
    s.add(truck);
    const sh = contactShadow(2.6, 0.4);
    s.add(sh);
    this.onUpdate(() => sh.position.set(truck.position.x, 0.12, truck.position.z));
    const girl = (this.girl = makeGirl());
    const pup = (this.pup = makePup());
    seatRiders(truck, girl, pup);
    this.cheerUntil = 0;
    this.speed = 0;
    this.eyes = new Map([pup, girl].map((who) => { const e = []; who.traverse((o) => o.userData.inner && e.push(o.userData.inner)); return [who, e]; }));
    this.drowsy = 0; // 0 awake … 1 asleep (the end of a session)
    this.yawnAt = -10;
    this.onUpdate((dt, t) => {
      truck.userData.update(t, this.speed);
      pup.userData.idle(t);
      t < this.cheerUntil ? girl.userData.cheer(t) : girl.userData.idle(t);
      if (this.drowsy || t - this.yawnAt < 2) this.nod(t);
    });
    this.tappable(girl, () => this.tapGirl());
    this.tappable(pup, () => this.tapPup());
    this.tappable(truck, () => this.tapTruck()); // honk! (or a micro reward's siren)
    truck.userData.tapHeight = 1;
    girl.userData.tapHeight = 1.7;
    pup.userData.tapHeight = 1.6;

    if (this.silent) {
      // attract mode behind the start button: slow orbit
      this.busy = true;
      this.onUpdate((dt, t) => {
        const a = t * 0.05;
        this.view.pos.set(Math.sin(a) * 36, 22, Math.cos(a) * 36 + 3.5);
      });
      return;
    }
    if (this.greet) {
      // swoop in from high above the bay
      const from = new THREE.Vector3(-30, 48, 60), to = HOME_VIEW.pos.clone();
      this.view.pos.copy(from);
      this.busy = true;
      animate(2800, (t) => this.view.pos.lerpVectors(from, to, t), ease.inOut).then(() => { this.busy = false; });
    }
    // session director: gently suggest where to go next (every place can still be tapped)
    const session = (this.session = getSession());
    const step = nextStep(session);
    const end = ending(session);
    const finished = session.completed.length > (session.rewardedUpTo || 0); // (not just back from the home button)
    // a few seconds of pure play after each finished mission (not after the finale or the goodnight: their own moment)
    const microType = microDue({ completed: session.completed.length, rewardedUpTo: session.rewardedUpTo || 0, finaleJustDone: !!end })
      && (dev.micro || pickMicroReward({ world: getWorld(), recent: session.microRecent || [] }));
    session.rewardedUpTo = session.completed.length;
    const forced = step === 'mission' && (dev.suggestOnce || dev.suggest);
    dev.suggestOnce = null;
    this.suggested = forced || suggestNext(session, Object.keys(PLACES));
    if (this.suggested) this.highlight(this.suggested);
    // …told as a little story when there is one ("Ojej! Kotek potrzebuje pomocy!")
    const event = pickEvent({ step, suggested: this.suggested });
    session.pendingEvent = event?.id || null;
    const shown = event && addEvent(this, event);
    const invite = (event && T[event.line]()) || (step === 'finale' ? T.finaleCall() : this.suggested ? [...T.suggest(this.suggested), ...T.tapStar()] : []);
    if (end === 'goodnight') { sayGoodbye(session); this.goodnight(this.worldLines); return; }
    let line = [];
    if (end === 'thanks') {
      // the finale is done: thank her once, a little mission for home, then it's free play (no more nudging)
      sayGoodbye(session);
      line = [...T.sessionDone(), ...T.homeTask(homeTaskKind(session.completed, HOME_TASKS)), ...T.playOn()];
      confetti(90);
      this.cheerUntil = performance.now() / 1000 + 3;
    } else if (end === 'asleep') {
      this.sleep({ now: true });
      line = T.asleep();
    } else if (step === 'finale') {
      callFinale(session);
      line = invite;
    } else if (step === 'mission') {
      line = [...(this.greet ? T.greet() : finished ? [pick(T.hubAgain())] : T.hubBack()), ...invite]; // no "Brawo!" after a quit
    } else if (finished) line = [pick(T.hubAgain())]; // free play: one gentle line after each mission
    line = [...this.worldLines, ...line]; // "Zobacz! …" first
    const talk = line.length ? say(line) : Promise.resolve();
    if (this.suggested) hop(pup, 0.4);
    // the micro reward waits until the hub has finished talking
    talk.then(() => {
      if (!microType || !this.alive || this.busy || this.night) return;
      (session.microRecent ||= []).push(microType);
      this.micro = runMicroReward(this, microType, { truck, pup, girl, ...this.worldObjs });
    });
    // a nudge when she goes quiet, at most twice per visit (never endless): the invitation again, never old news
    if (step !== 'mission' && step !== 'finale') return;
    let nudges = 0;
    this.idleTimer = setInterval(() => {
      if (!this.alive || this.busy) return;
      if (++nudges > 2) { clearInterval(this.idleTimer); return; }
      shown?.nudge();
      say(invite);
    }, 25000);
  }

  /** The suggested place: its star is well over twice the size, glows, pulses and sparkles, and Chase keeps looking at it. */
  highlight(kind) {
    const m = this.markers?.[kind];
    if (!m) return;
    m.big.position.y = 0.9; // (clear of the level stars under it)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#ffd23f', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 0.9;
    m.marker.add(halo);
    const at = new THREE.Vector3();
    let next = 0.6;
    this.onUpdate((dt, t) => {
      m.big.scale.setScalar(2.4 + Math.sin(t * 4) * 0.2);
      halo.scale.setScalar(5.2 + Math.sin(t * 4) * 0.5);
      halo.material.opacity = this.asleep ? 0 : 0.75;
      if (t < next || this.busy) return;
      next = t + 2.4;
      m.marker.getWorldPosition(at);
      sparkle(this, at, { count: 10, size: 0.26, speed: 1.6 });
      this.pup.userData.lookAt(at, 2.6);
    });
  }

  exit() {
    this.dropToys?.();
    clearInterval(this.idleTimer);
    clearTimeout(this.holdTimer);
    this.night?.restore(); // (the windows' glass is shared with every scene)
  }

  addPlace(kind, group) {
    const p = PLACES[kind];
    if (group) {
      group.position.copy(p.pos);
      group.lookAt(new THREE.Vector3(p.pos.x * 0.4, 0, 40)); // face the camera
      this.scene.add(group);
    }
    const [mx, my, mz] = p.marker || [p.pos.x, 5.4, p.pos.z];
    // bouncing glowing star says "tap me!", with this mission's level stars under it
    const marker = new THREE.Group();
    marker.position.set(mx, my, mz);
    const big = star('#fde047', 0.95, 0.28);
    big.material = (this.starMat ||= new THREE.MeshStandardMaterial({ color: '#ffe066', emissive: '#ffcc00', emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.2 }));
    big.userData.dynamic = true; // grows when the place is suggested
    marker.add(big);
    (this.markers ||= {})[kind] = { marker, big };
    const level = levelFor(kind);
    const total = maxLevel(kind);
    for (let i = 0; i < total; i++) {
      const lit = i < level;
      const st = star(lit ? '#fde047' : '#cbd5e1', 0.32, 0.1);
      if (lit) st.material = mat('#ffe066', { emissive: '#ffb800', emissiveIntensity: 2.2, roughness: 0.3 });
      st.position.set((i - (total - 1) / 2) * 0.8, -1.35, 0);
      marker.add(st);
    }
    this.scene.add(marker);
    this.onUpdate((dt, t) => {
      if (!this.asleep) { // (they rest while the island sleeps)
        big.rotation.y = Math.sin(t * 2 + p.pos.x) * 0.6;
        marker.position.y = my + Math.sin(t * 3 + p.pos.x) * 0.3;
      }
      marker.scale.setScalar(portrait() ? 1.35 : 1);
      marker.lookAt(this.cameraPosition.x, marker.position.y, this.cameraPosition.z);
    });
    // invisible tap zone, so the landmark itself stays plain scenery (and can be merged into a few meshes)
    const [hr, hh] = p.hit || [3.0, 3.2]; // about the place itself (its star is tappable too)
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(hr, hr, hh, 16), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(p.pos.x, hh / 2, p.pos.z);
    hit.userData.tapHeight = 0;
    hit.userData.zone = true; // invisible: anything real behind it gets the tap first
    this.scene.add(hit);
    marker.userData.tapHeight = 0;
    this.tappable(hit, () => this.tapPlace(kind));
    this.tappable(marker, () => this.tapPlace(kind));
  }

  tapPlace(kind) { return this.asleep ? this.sleepyTap(kind) : this.go(kind); }

  tapGirl() {
    if (this.night) return this.asleep && this.shush(T.goodnight());
    sfx.pop();
    this.cheerUntil = performance.now() / 1000 + 1.5;
    this.girl.userData.setHappy(1.5);
    hop(this.girl, 0.4);
    say(pick(T.tapGirl()));
  }

  tapTruck() {
    if (this.night) return this.asleep && this.shush(T.asleep()); // (no honking at bedtime)
    if (this.busy) return;
    if (this.micro?.active() && this.micro.onTruck) return this.micro.onTruck();
    sfx.honk();
    hop(this.truck, 0.2, 360);
  }

  tapPup() {
    if (this.night) return this.asleep && this.shush(T.asleep());
    if (this.micro?.active() && this.micro.onPup) return this.micro.onPup();
    sfx.bark();
    this.pup.userData.setHappy(1.5);
    hop(this.pup, 0.5);
    say(pick(T.tapPup()));
  }

  async go(kind) {
    if (this.busy) return;
    this.busy = true;
    const p = PLACES[kind];
    hush();
    sfx.siren(3);
    this.truck.userData.setFlashing(true);
    this.cheerUntil = performance.now() / 1000 + 3;
    this.pup.userData.setHappy(3);
    this.girl.userData.lookAt(p.pos.clone().add(new THREE.Vector3(0, 1, 0)), 3);
    this.pup.userData.lookAt(p.pos.clone().add(new THREE.Vector3(0, 1, 0)), 3);
    say(T.go(kind));
    await this.drive(p);
    await wait(200);
    if (this.alive) this.game.startMission(kind);
  }

  /** The cruiser drives a place's road; the camera follows and leans in (lift: look that much higher at the end). */
  async drive(p, { ms = 2600, lean = 0.45, lift = 0 } = {}) {
    const tan = new THREE.Vector3();
    const look0 = this.view.look.clone(), pos0 = this.view.pos.clone();
    this.speed = 0.35;
    let puff = 0;
    await animate(ms, (t) => {
      p.curve.getPointAt(t, this.truck.position);
      p.curve.getTangentAt(Math.min(t, 0.999), tan);
      this.truck.rotation.y = Math.atan2(tan.x, tan.z);
      // camera follows the cruiser and leans in
      this.view.look.lerpVectors(look0, this.truck.position, Math.min(1, t * 1.4));
      this.view.look.y += lift * t;
      this.view.pos.copy(this.view.look).add(pos0.clone().sub(look0).multiplyScalar(1 - lean * t));
      if (++puff % 7 === 0 && t < 0.9) dust(this, this.truck.position.clone().sub(tan.clone().multiplyScalar(2)), { count: 2, size: 0.45 });
    }, ease.inOut);
    this.speed = 0;
  }

  // ---------- the end of a session ----------
  /**
   * Wound down early: the sun sets while the cruiser drives home to the Lookout; there Chase yawns, gives a
   * little mission for home and says goodnight; then the camera pulls back over the sleeping island.
   */
  async goodnight(first) {
    this.busy = true;
    const task = T.homeTask(homeTaskKind(this.session.completed, HOME_TASKS));
    const talk = say([...first, ...T.restTime()]);
    this.dusk(6000);
    animate(6000, (k) => (this.drowsy = k * 0.4), ease.inOut);
    await wait(1500);
    if (!this.alive) return;
    await this.drive(PLACES.lookout, { ms: 3600, lean: 0.4, lift: 3.5 });
    const r0 = this.truck.rotation.y;
    await animate(1400, (k) => { this.truck.rotation.y = r0 * (1 - k); }, ease.inOut); // turns round at the door: goodnight, everyone
    await talk;
    if (!this.alive) return;
    this.yawnAt = performance.now() / 1000;
    await wait(900);
    await say([...task, ...T.goodnight()]);
    if (!this.alive) return;
    const look0 = this.view.look.clone(), pos0 = this.view.pos.clone();
    animate(1800, (k) => (this.drowsy = 0.4 + k * 0.6), ease.inOut);
    await animate(2800, (k) => { this.view.look.lerpVectors(look0, HOME_VIEW.look, k); this.view.pos.lerpVectors(pos0, HOME_VIEW.pos, k); }, ease.inOut);
    this.sleep();
    this.busy = false;
  }

  /** Evening light: a dusky sky, a low warm sun, lit windows. Over ms (0 = at once). */
  dusk(ms) {
    const s = this.scene;
    const sky = s.children.find((o) => o.material?.uniforms?.top)?.material.uniforms;
    const hemi = s.children.find((o) => o.isHemisphereLight);
    const [sun, rim] = s.children.filter((o) => o.isDirectionalLight);
    const glass = this.glass;
    const from = { top: sky.top.value.clone(), horizon: sky.horizon.value.clone(), sun: sun.color.clone(), sunI: sun.intensity, hemiI: hemi.intensity, rimI: rim.intensity, env: s.environmentIntensity, glow: glass.emissive.clone(), glowI: glass.emissiveIntensity };
    const to = { top: new THREE.Color('#29306e'), horizon: new THREE.Color('#ffab7a'), sun: new THREE.Color('#ff9d5c'), glow: new THREE.Color('#ffc65c') };
    const set = (k) => {
      sky.top.value.lerpColors(from.top, to.top, k);
      sky.horizon.value.lerpColors(from.horizon, to.horizon, k);
      s.background.copy(sky.horizon.value);
      s.fog?.color.copy(sky.horizon.value);
      sun.color.lerpColors(from.sun, to.sun, k);
      sun.intensity = from.sunI * (1 - 0.55 * k);
      hemi.intensity = from.hemiI * (1 - 0.55 * k);
      rim.intensity = from.rimI * (1 - 0.5 * k);
      s.environmentIntensity = from.env * (1 - 0.5 * k);
      glass.emissive.lerpColors(from.glow, to.glow, k);
      glass.emissiveIntensity = from.glowI + (1.4 - from.glowI) * k;
      this.starMat.emissiveIntensity = 2.6 - 1.9 * k;
    };
    this.night = { restore: () => { glass.emissive.copy(from.glow); glass.emissiveIntensity = from.glowI; } };
    if (!ms) return set(1);
    return animate(ms, set, ease.inOut);
  }

  /** Heads droop and eyes close as they get sleepy; a yawn tips the head back. (After their idle pose, every frame.) */
  nod(t) {
    const yawn = Math.max(0, Math.sin(Math.min(1, (t - this.yawnAt) / 2) * Math.PI));
    for (const who of [this.pup, this.girl]) {
      who.userData.parts.head.rotation.x += this.drowsy * 0.35 - yawn * 0.6;
      for (const e of this.eyes.get(who)) e.scale.y = Math.min(e.scale.y, 1 - this.drowsy * 0.9 + yawn * 0.4);
    }
  }

  /** The island sleeps: stars rest, little z's float over Chase, and places answer "Czejs śpi… Do jutra!". */
  sleep({ now = false } = {}) {
    if (now) { // back on an island that is already asleep
      this.dusk(0);
      this.drowsy = 1;
      PLACES.lookout.curve.getPointAt(1, this.truck.position);
      this.truck.rotation.y = 0;
    }
    this.asleep = true;
    this.micro = null;
    clearInterval(this.idleTimer);
    const head = new THREE.Vector3();
    let next = 0;
    this.onUpdate((dt, t) => {
      if (t < next) return;
      next = t + 1.5;
      this.pup.userData.parts.head.getWorldPosition(head);
      const z = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture(), transparent: true, depthTest: false }));
      z.renderOrder = 6;
      this.scene.add(z);
      const x0 = head.x + 0.4, y0 = head.y + 0.9, z0 = head.z;
      animate(2600, (k) => {
        z.position.set(x0 + Math.sin(k * 6) * 0.3 + k * 0.8, y0 + k * 2.6, z0);
        z.scale.setScalar(0.8 + k * 0.9);
        z.material.opacity = Math.min(1, k * 5) * (1 - k);
      }, ease.out).then(() => z.removeFromParent());
    });
  }

  /** A tap while the island sleeps: "Czejs śpi… Do jutra!" Holding a place for 1.5 s (a grown-up) still starts it. */
  sleepyTap(kind) {
    if (getSession() !== this.session) return this.game.hub({ greet: true }); // a long break: it's a new day
    clearTimeout(this.holdTimer);
    const up = () => clearTimeout(this.holdTimer);
    window.addEventListener('pointerup', up, { once: true });
    this.holdTimer = setTimeout(() => { window.removeEventListener('pointerup', up); this.wake(kind); }, 1500);
    this.shush(T.asleep());
  }

  /** A sleepy answer, at most once every few seconds. */
  shush(line) {
    const now = performance.now();
    if (now - (this.shushedAt || 0) < 3000) return;
    this.shushedAt = now;
    say(line);
  }

  /** A grown-up wants one more: a fresh session, straight into the mission. */
  wake(kind) {
    startSession();
    hush();
    this.game.startMission(kind);
  }
}

/** The same island every visit: a small seeded random (mulberry32). */
function seeded(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let haloTex = null;
/** A soft round glow (drawn once). */
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

let zTex = null;
/** A soft white "z" with a blue edge (drawn once). */
function zTexture() {
  if (zTex) return zTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '700 110px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 14; g.strokeStyle = '#1e3a8a'; g.strokeText('z', 64, 60);
  g.fillStyle = '#ffffff'; g.fillText('z', 64, 60);
  zTex = new THREE.CanvasTexture(c);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}

// ---------- road ribbon ----------
function makeRoad(curve, width = 2.2) {
  const pts = curve.getSpacedPoints(60);
  const pos = [], idx = [];
  const tan = new THREE.Vector3();
  pts.forEach((p, i) => {
    curve.getTangentAt(i / (pts.length - 1), tan);
    const nx = tan.z, nz = -tan.x;
    pos.push(p.x + nx * width / 2, 0.08, p.z + nz * width / 2, p.x - nx * width / 2, 0.08, p.z - nz * width / 2);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat('#e8d5a3', { side: THREE.DoubleSide, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

// ---------- place landmarks ----------
/** Strip animation data so a decorative model can be merged into the static scenery. */
function plain(root) { root.traverse((o) => { o.userData = {}; }); }
function glyphBlock(text, bg, size = 1.3) {
  const m = new THREE.MeshStandardMaterial({ map: glyphTexture(text, { bg }), roughness: 0.45 });
  const b = new THREE.Mesh(rbox(size, size, size, 0.12), m);
  b.castShadow = b.receiveShadow = true;
  return b;
}
const pad = (r = 3, color = '#86efac') => mesh(new THREE.CylinderGeometry(r, r, 0.12, 48), mat(color, { roughness: 0.9 }), { y: 0.06 });

function makeLetterPark() {
  const g = new THREE.Group();
  g.add(pad(3.2, '#9be7a8'));
  const a = glyphBlock('A', '#ef4444'); a.position.set(-0.75, 0.65, 0);
  const b = glyphBlock('B', '#2563eb'); b.position.set(0.75, 0.65, 0);
  const c = glyphBlock('C', '#16a34a'); c.position.set(0, 1.95, 0); c.rotation.y = 0.2;
  g.add(a, b, c);
  const k = makeKitten();
  k.position.set(0, 2.6, 0);
  k.scale.setScalar(0.9);
  k.userData.tick = (dt, t) => k.userData.idle(t);
  g.add(k);
  const f = makeFence(5.5);
  f.position.set(0, 0, -2.4);
  f.scale.setScalar(0.7);
  g.add(f);
  return g;
}

function makeBalloonHill() {
  const g = new THREE.Group();
  g.add(pad(3.2, '#a7f3d0'));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.2, 10), mat('#92400e'), { y: 0.6 }));
  const cols = ['#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899'];
  ['A', 'B', 'C', 'D', 'E'].forEach((l, i) => {
    const bl = makeBalloon(cols[i], labelTexture(l));
    const a = (i - 2) * 0.45;
    bl.position.set(Math.sin(a) * 1.3, 3.2 + Math.cos(a) * 0.6 - Math.abs(i - 2) * 0.2, (i % 2) * 0.3);
    bl.rotation.z = -a * 0.5;
    bl.scale.setScalar(0.75);
    plain(bl);
    g.add(bl);
  });
  const w = makeWindmill();
  w.position.set(-2.4, 0, -1.8);
  w.scale.setScalar(0.55);
  g.add(w);
  g.windmill = w; // (a toy: tapping it whirls the sails; not userData, so the hill stays plain scenery)
  return g;
}

function makeNameTrain() {
  const g = new THREE.Group();
  const letters = (CONFIG.childName || 'ABC').toUpperCase().slice(0, 3);
  const t = makeTrain(letters.length);
  t.scale.setScalar(0.8);
  t.rotation.y = Math.PI; // engine on the left so the name reads left-to-right
  t.position.x = -1.8;
  g.add(t);
  [...letters].forEach((l, i) => {
    const b = glyphBlock(l, ['#9333ea', '#db2777', '#0891b2'][i], 0.95);
    const slot = t.userData.slots[i];
    b.position.set(-1.8 - slot.x * 0.8, slot.y * 0.8 + 0.05, 0);
    g.add(b);
  });
  plain(t); // a parked train is just scenery here
  return g;
}

function makePostOffice() {
  const g = new THREE.Group();
  g.add(pad(3.2, '#fde68a'));
  const h = makeHouse('#fef3c7', '#dc2626', { chimney: false });
  h.position.set(0, 0, -0.9);
  g.add(h);
  // a red mailbox and a couple of parcels
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), mat('#6b7280'), { x: 1.7, y: 0.5, z: 0.6 }));
  g.add(mesh(rbox(0.8, 0.7, 0.6, 0.1), mat('#dc2626'), { x: 1.7, y: 1.25, z: 0.6 }));
  for (const [x, z, s] of [[-1.5, 0.9, 0.7], [-0.8, 1.4, 0.55]]) g.add(mesh(rbox(s, s * 0.8, s * 0.8, 0.05), mat('#c08a4a', { roughness: 0.85 }), { x, y: s * 0.4, z }));
  return g;
}

function makePicnic() {
  const g = new THREE.Group();
  g.add(pad(3.2, '#bbf7d0'));
  // a checked blanket, a basket, a few bones
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x2 = c.getContext('2d');
  x2.fillStyle = '#fff'; x2.fillRect(0, 0, 64, 64);
  x2.fillStyle = '#ef4444';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) x2.fillRect(x * 16, y * 16, 16, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), { y: 0.13, rx: -Math.PI / 2, shadow: false }));
  g.add(mesh(rbox(1.1, 0.65, 0.75, 0.1), mat('#b45309', { roughness: 0.8 }), { x: 0.9, y: 0.45, z: -0.4 }));
  g.add(mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 16, Math.PI), mat('#92400e'), { x: 0.9, y: 0.78, z: -0.4 }));
  for (const [x, z] of [[-0.8, 0.3], [-0.2, 0.6], [-0.6, -0.4]]) { const b = makeBone(1.2); b.position.set(x, 0.2, z); b.rotation.y = x * 2; g.add(b); }
  return g;
}

function makeTreatHouse() {
  const g = new THREE.Group();
  const h = makePupHouse();
  h.scale.setScalar(0.85);
  g.add(h);
  const bone = makeBone(2.6);
  bone.position.set(0, 3.9, 0.3);
  bone.userData.tick = (dt, t) => { bone.rotation.z = Math.sin(t * 1.5) * 0.15; bone.position.y = 3.9 + Math.sin(t * 2) * 0.12; };
  g.add(bone);
  g.add(mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.35, 24), mat('#ef4444'), { x: 1.9, y: 0.18, z: 1.6 }));
  for (let i = 0; i < 3; i++) { const b = makeBone(0.8); b.position.set(1.7 + i * 0.2, 0.42, 1.6); b.rotation.y = i; g.add(b); }
  return g;
}

function makeConeRoad() {
  const g = new THREE.Group();
  ['1', '2', '3'].forEach((n, i) => {
    const c = makeCone();
    c.position.set((i - 1) * 1.6, 0, 0);
    g.add(c);
    const sign = glyphBlock(n, ['#ef4444', '#16a34a', '#9333ea'][i], 0.9);
    sign.scale.z = 0.15;
    sign.position.set((i - 1) * 1.6, 2.0, 0);
    g.add(sign);
  });
  return g;
}

function makeRiver() {
  const g = new THREE.Group();
  const water = makeWater({ repeat: 2, flow: [0.05, 0.01], scale: 0.6, stops: [[0, '#4cc9ef'], [1, '#1d8fd6']] });
  const pond = mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.12, 48), water.material, { y: 0.07 });
  pond.userData.tick = water.update;
  g.add(pond);
  [[-1.4, 0.6], [0, -0.3], [1.4, 0.5]].forEach(([x, z], i) => {
    const s = makeStone(discTexture(String(i + 1), ['#ef4444', '#16a34a', '#2563eb'][i]));
    s.position.set(x, 0.22, z);
    s.rotation.y = Math.PI / 2;
    s.scale.setScalar(0.8);
    g.add(s);
  });
  return g;
}
