import * as THREE from 'three';
import { animate, ease, hop, wait } from '../engine.js';
import { mat, mesh } from '../models.js';
import { portrait } from '../world/portrait.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { reefPlan, reefChoices, placeAt } from '../levels/reef.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const SEEN_MS = 800; // the animal in its place, in view, before the next scene
const ANIMAL_SCALE = { crab: 1.85, starfish: 1.45, fish: 1.75, octopus: 1.75 };
const WAIT_AT = { x: 0, y: 4.7, z: 0.6 }; // the place round: the animal swims here first, above the scene
const RING = 1.2; // a place round's spot: a bright ring this wide (world units) round where the animal would sit

let factCursor = 0;

/** Small drawn pictures for the bubble, matching the animals in the scene. */
const ANIMAL_PICTURES = {
  crab: `<ellipse cx="50" cy="58" rx="23" ry="15" fill="#ef4444"/>
    <circle cx="24" cy="45" r="9" fill="#ef4444"/>
    <circle cx="76" cy="45" r="9" fill="#ef4444"/>
    <path d="M30 62 L20 73 M70 62 L80 73" stroke="#b91c1c" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <circle cx="41" cy="55" r="6" fill="#ffffff"/>
    <circle cx="59" cy="55" r="6" fill="#ffffff"/>
    <circle cx="42" cy="56" r="3" fill="#1f2937"/>
    <circle cx="58" cy="56" r="3" fill="#1f2937"/>
    <path d="M42 66 Q50 72 58 66" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
  starfish: `<path d="M50 18 L59 42 L84 42 L64 57 L72 82 L50 67 L28 82 L36 57 L16 42 L41 42 Z" fill="#fb7185" stroke="#e11d48" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="43" cy="49" r="4" fill="#1f2937"/>
    <circle cx="57" cy="49" r="4" fill="#1f2937"/>
    <path d="M43 59 Q50 64 57 59" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
  fish: `<ellipse cx="47" cy="53" rx="27" ry="17" fill="#60a5fa"/>
    <path d="M72 53 L92 37 L92 69 Z" fill="#fb923c"/>
    <ellipse cx="45" cy="37" rx="13" ry="6" fill="#fb923c"/>
    <circle cx="59" cy="49" r="6" fill="#ffffff"/>
    <circle cx="60" cy="50" r="3" fill="#1f2937"/>
    <path d="M36 60 Q45 66 54 60" stroke="#1e3a8a" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
  octopus: `<path d="M31 51 Q24 66 33 78 M40 55 Q36 71 45 81 M49 56 Q49 72 50 82 M58 55 Q62 71 55 81 M67 51 Q75 66 66 78" stroke="#a78bfa" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="50" cy="40" r="20" fill="#a78bfa"/>
    <circle cx="43" cy="37" r="5" fill="#ffffff"/>
    <circle cx="57" cy="37" r="5" fill="#ffffff"/>
    <circle cx="44" cy="38" r="2.5" fill="#1f2937"/>
    <circle cx="56" cy="38" r="2.5" fill="#1f2937"/>
    <path d="M43 46 Q50 52 57 46" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round" fill="none"/>`,
};

function animalPicture(kind) {
  return `<svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true">${ANIMAL_PICTURES[kind]}</svg>`;
}

/** A little bubble picture of the asked position, drawn as the scene is: the rock with its hollow, or the open shell. */
function positionPicture(word, on) {
  const base = on === 'shell'
    ? '<path d="M24 66 Q50 98 76 66 Z" fill="#f9a8d4" stroke="#ec4899" stroke-width="2"/><path d="M26 64 Q36 30 70 40" fill="none" stroke="#ec4899" stroke-width="5" stroke-linecap="round"/>'
    : '<path d="M18 86 L22 60 L30 56 L32 86 Z M66 86 L68 56 L76 60 L80 86 Z" fill="#94a3b8"/><rect x="26" y="66" width="44" height="20" fill="#334155"/><path d="M14 60 Q16 40 48 38 Q82 40 84 60 Z" fill="#94a3b8" stroke="#64748b" stroke-width="2"/>';
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>`;
  const animal = { na: dot(49, 30), pod: dot(49, 77), w: dot(50, 70), obok: dot(on === 'shell' ? 90 : 8, 80) }[word];
  return `<svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true">${base}${animal}</svg>`;
}

export class ReefMission extends Mission {
  constructor(game) {
    super(game, 'reef');
    this.view = { pos: new THREE.Vector3(0, 4.4, 18), look: new THREE.Vector3(0, 3.5, 0), minWidth: 19.6 }; // (side on, as if diving)
    this.post = { tilt: 0, ao: false };
    this.drift = 0;
    this.bubbleAt = 'left';
    this.phase = 'starting';
    this.plan = null;
    this.roundRoot = null;
    this.roundGeometries = new Set();
    this.roundMaterials = new Set();
    this.roundOffs = [];
    this.roundTappables = [];
    this.maps = [];
    this.choices = [];
    this.spots = [];
  }

  build() {
    this.waterMap = texture(512, (c, size) => {
      const g = c.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#a5f3fc');
      g.addColorStop(0.5, '#38bdf8');
      g.addColorStop(1, '#0e7490');
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
      c.fillStyle = 'rgba(255, 255, 255, 0.12)'; // light from the surface
      for (const [x, w] of [[60, 50], [190, 80], [330, 60], [440, 40]]) {
        c.beginPath();
        c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w * 2.2, size); c.lineTo(x + w * 1.2, size);
        c.fill();
      }
    });
    this.maps.push(this.waterMap);
    this.scene.background = this.waterMap;
    this.scene.add(new THREE.HemisphereLight('#f0fdff', '#4fb3c8', 2.5));
    const sun = new THREE.DirectionalLight('#fffbe8', 1.9);
    sun.position.set(-6, 16, 12);
    this.scene.add(sun);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.sandMap = texture(1024, (c, size) => {
      c.fillStyle = '#f6e2ad';
      c.fillRect(0, 0, size, size);
      for (let i = 0; i < 130; i++) {
        const x = (i * 277 + 61) % size, y = (i * 433 + 113) % size, r = 2 + (i % 4);
        c.fillStyle = i % 2 ? '#efd597' : '#fdf0cc';
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.maps.push(this.sandMap);
    const sand = new THREE.MeshStandardMaterial({ map: this.sandMap, roughness: 1 });
    this.world.add(mesh(new THREE.PlaneGeometry(80, 60), sand, { y: 0, z: -4, rx: -Math.PI / 2, shadow: false }));

    const grassMats = [mat('#34d399', { roughness: 1 }), mat('#16a34a', { roughness: 1 })];
    for (const [x, z, h] of [[-9.6, -1.5, 2.4], [-8.9, -2.6, 3.2], [-0.4, -2.2, 2.6], [0.5, -2.8, 3.4], [1.1, -1.8, 2.1], [9.3, -2.2, 2.9], [9.9, -1.2, 2.2]]) {
      this.world.add(mesh(new THREE.ConeGeometry(0.16, h, 5), grassMats[Math.round(h * 10) % 2], { x, y: h / 2, z, rz: (x % 2) * 0.05, shadow: false }));
    }
    this.world.add(this.rock());
    this.world.add(this.shell());

    this.spotMap = texture(128, (c, size) => {
      c.clearRect(0, 0, size, size);
      const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, 'rgba(255, 251, 214, 0.9)');
      g.addColorStop(0.6, 'rgba(253, 224, 71, 0.55)');
      g.addColorStop(1, 'rgba(250, 204, 21, 0)');
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
    });
    this.maps.push(this.spotMap);

    this.portrait = portrait();
    const face = new THREE.MeshBasicMaterial({ map: this.portrait.texture });
    this.window = new THREE.Group();
    this.window.add(mesh(new THREE.CircleGeometry(1.0, 48), face, { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.06, 0.09, 12, 48), mat('#f8e7b5', { metalness: 0.1, roughness: 0.45 }), { z: 0.01, shadow: false }));
    this.window.position.set(5.6, 6.6, -1);
    this.window.lookAt(this.view.pos);
    this.world.add(this.window);
    this.tappable(this.window, () => { sfx.bark(); hop(this.window, 0.18); });

    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  /** A big grey rock on two feet, with a dark hollow under its ledge: "pod kamieniem" is in there. */
  rock() {
    const group = new THREE.Group();
    const grey = mat('#8b95a1', { roughness: 1 });
    const geo = new THREE.DodecahedronGeometry(1, 1);
    group.add(mesh(new THREE.PlaneGeometry(3.1, 2.3), new THREE.MeshBasicMaterial({ color: '#1e293b' }), { y: 1.15, z: -0.5, shadow: false })); // the hollow
    for (const x of [-1.95, 1.95]) group.add(mesh(geo, grey, { x, y: 1.05, s: [0.8, 1.15, 1.0], shadow: false }));
    group.add(mesh(geo, grey, { y: 2.6, s: [2.75, 0.62, 1.15], shadow: false }));
    group.position.set(-3.3, 0, 0);
    return group;
  }

  /** A big pink shell lying open, its lid up: "w muszli" is inside. */
  shell() {
    const group = new THREE.Group();
    const pink = mat('#f9a8d4', { roughness: 0.5, side: THREE.DoubleSide });
    const rim = mat('#ec4899', { roughness: 0.5 });
    group.add(mesh(new THREE.SphereGeometry(1.55, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), pink, { y: 1.45, s: [1, 0.9, 0.75], shadow: false }));
    group.add(mesh(new THREE.TorusGeometry(1.55, 0.08, 8, 40), rim, { y: 1.45, rx: Math.PI / 2, s: [1, 0.75, 1], shadow: false }));
    const lid = new THREE.Group();
    lid.add(mesh(new THREE.SphereGeometry(1.55, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), pink, { z: 1.16, s: [1, 0.6, 0.75], shadow: false }));
    lid.position.set(0, 1.45, -1.16);
    lid.rotation.x = -1.15;
    group.add(lid);
    group.position.set(3.4, 0, 0.1);
    return group;
  }

  material(color, options = {}) {
    const material = mat(color, options);
    this.roundMaterials.add(material);
    return material;
  }

  geo(geometry) {
    this.roundGeometries.add(geometry);
    return geometry;
  }

  /** The animals look at her: big white eyes, so the one hiding under the rock still shows its eyes in the dark. */
  animal(kind) {
    const group = new THREE.Group();
    group.userData.kind = kind;
    const white = this.material('#ffffff', { roughness: 0.3 });
    const black = this.material('#111827', { roughness: 0.4 });
    const face = (y, z, apart = 0.15) => {
      for (const x of [-apart, apart]) {
        const eye = mesh(this.geo(new THREE.SphereGeometry(0.1, 12, 8)), white, { x, y, z, shadow: false });
        eye.add(mesh(this.geo(new THREE.SphereGeometry(0.055, 10, 6)), black, { z: 0.07, shadow: false }));
        eye.userData.eye = true;
        group.add(eye);
      }
      group.add(mesh(this.geo(new THREE.TorusGeometry(0.06, 0.014, 6, 10, Math.PI)), black, { y: y - 0.15, z: z + 0.02, rz: Math.PI, shadow: false }));
    };
    if (kind === 'crab') {
      const red = this.material('#ef4444', { roughness: 0.55 });
      const dark = this.material('#991b1b', { roughness: 0.7 });
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.34, 16, 12)), red, { y: 0.32, s: [1.25, 0.75, 0.9], shadow: false }));
      for (const side of [-1, 1]) {
        group.add(mesh(this.geo(new THREE.SphereGeometry(0.17, 10, 8)), red, { x: side * 0.52, y: 0.42, z: 0.12, s: [0.8, 0.6, 0.6], shadow: false }));
        for (let i = 0; i < 3; i++) group.add(mesh(this.geo(new THREE.CylinderGeometry(0.024, 0.024, 0.36, 6)), dark, {
          x: side * 0.38, y: 0.12, z: -0.14 + i * 0.14, rz: side * 1.1, shadow: false,
        }));
      }
      face(0.52, 0.24);
      return group;
    }
    if (kind === 'starfish') {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.24 : 0.6;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
      }
      shape.closePath();
      const star = this.geo(new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }));
      group.add(mesh(star, this.material('#fb7185', { roughness: 0.5 }), { y: 0.5, shadow: false })); // standing, facing her
      face(0.56, 0.2, 0.12);
      return group;
    }
    if (kind === 'fish') {
      const blue = this.material('#60a5fa', { roughness: 0.5 });
      const orange = this.material('#fb923c', { roughness: 0.55 });
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.34, 16, 12)), blue, { y: 0.4, s: [1.3, 0.85, 0.55], shadow: false }));
      group.add(mesh(this.geo(new THREE.ConeGeometry(0.24, 0.38, 8)), orange, { x: -0.55, y: 0.4, rz: Math.PI / 2, shadow: false }));
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.13, 10, 8)), orange, { x: 0.02, y: 0.68, z: 0.02, s: [1, 0.5, 0.35], shadow: false }));
      face(0.48, 0.2, 0.12);
      return group;
    }
    const purple = this.material('#a78bfa', { roughness: 0.55 });
    group.add(mesh(this.geo(new THREE.SphereGeometry(0.36, 16, 12)), purple, { y: 0.62, s: [1, 0.9, 0.9], shadow: false }));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      group.add(mesh(this.geo(new THREE.CylinderGeometry(0.04, 0.08, 0.42, 6)), purple, {
        x: Math.cos(a) * 0.24, y: 0.24, z: Math.sin(a) * 0.2, rz: Math.cos(a) * 0.65, rx: Math.sin(a) * 0.65, shadow: false,
      }));
    }
    face(0.68, 0.3);
    return group;
  }

  /** In the hollow under the rock the animal is in the dark: only its eyes keep their light. */
  shade(animal) {
    animal.traverse((o) => {
      if (!o.isMesh || o.userData.eye || o.parent?.userData.eye) return;
      o.material = o.material.clone();
      o.material.color.multiplyScalar(0.3);
      this.roundMaterials.add(o.material);
    });
  }

  seat(animal, place) {
    const at = placeAt(place);
    animal.position.set(at.x, at.y, at.z);
    animal.scale.setScalar(ANIMAL_SCALE[animal.userData.kind]);
    if (place.word === 'pod') this.shade(animal);
  }

  /** An animal she can tap where it sits, with a hit box over its place (for "pod", the mouth of the hollow). */
  makeChoice(place, kind) {
    const group = new THREE.Group();
    const at = placeAt(place);
    group.position.set(at.x, at.y, at.z);
    const animal = this.animal(kind);
    this.seat(animal, place);
    animal.position.set(0, 0, 0);
    group.add(animal);
    const hit = mesh(this.geo(new THREE.BoxGeometry(2.9, 2.2, 0.4)), this.material('#ffffff', { visible: false }), { y: 0.95, z: 0.4, shadow: false });
    group.add(hit);
    group.userData.hit = hit;
    group.userData.animal = animal;
    group.userData.choice = place.word;
    group.userData.tapHeight = 0.8;
    return group;
  }

  newRound(target) {
    this.phase = 'asking';
    this.last = target.word;
    this.item('R:' + target.word);
    const root = new THREE.Group();
    root.userData.dynamic = true;
    this.roundRoot = root;
    this.scene.add(root);
    return root;
  }

  /** One scene: the same animal in two or three places. "Który krab jest pod kamieniem?" She taps the one that is. */
  choiceRound(target) {
    return new Promise((resolve) => {
      const root = this.newRound(target);
      const places = reefChoices(target.place, this.L.words, this.L.choices);
      this.choices = places.map((place) => {
        const group = this.makeChoice(place, target.animal);
        root.add(group);
        this.tappable(group, () => this.tapChoice(group, target, resolve));
        this.roundTappables.push(group);
        return group;
      });
      const right = this.choices.find((group) => group.userData.choice === target.word);
      this.question('position', target.word, {
        short: () => T.reefAsk(target.animal, target.place.word, target.place.on),
        hint: (said = []) => { // each animal hops in turn: look at every one, no word said
          const asked = this.learn.current;
          this.say([...said, ...T.lookCarefully()]).then(() => this.pointAlong(this.choices.filter((c) => c.parent), (c) => { hop(c, 0.35); }))
            .then(() => { if (this.learn.current === asked) this.ask(T.reefAsk(target.animal, target.place.word, target.place.on)); });
          return Promise.resolve();
        },
        simplify: () => this.removeOption(this.lastWrong?.parent ? this.lastWrong : this.choices.find((group) => group !== right && group.parent)),
        reveal: () => this.hint(right, () => this.phase !== 'asking'),
      }, { options: this.choices.length });

      const bubble = { big: '?', pic: animalPicture(target.animal), onTap: () => this.replay(), passthrough: true };
      if (this.L.mode === 'see') Object.assign(bubble, { big: target.word, pic: positionPicture(target.word, target.place.on) });
      ui.bubble(bubble);
      this.askAfter(this.talk, T.reefAsk(target.animal, target.place.word, target.place.on));
    });
  }

  async tapChoice(group, target, resolve) {
    if (!this.alive || this.phase !== 'asking') return;
    this.poke();
    if (group.userData.choice !== target.word) {
      this.lastWrong = group;
      this.wrong(group.userData.choice, { obj: group });
      hop(group, 0.22);
      return;
    }
    this.phase = 'solved';
    this.correct(target.word);
    this.stopIdle();
    this.choices.forEach((choice) => this.untap(choice));
    this.choices.filter((c) => c !== group && c.parent).forEach((c) => this.shrinkAway(c, 500));
    sfx.good();
    const animal = group.userData.animal, s0 = animal.scale.x;
    await animate(420, (t) => animal.scale.setScalar(s0 * (1 + Math.sin(t * Math.PI) * 0.2)), ease.linear);
    if (!this.alive) return;
    this.success(group.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    this.talk = this.say([this.praise(), ...T.reefRight(target.animal, target.place.word, target.place.on)]);
    await wait(SEEN_MS);
    if (!this.alive) return;
    resolve();
  }

  /** A bright ring where the animal would sit: large and pulsing, so she can see every place she may pick. */
  makeSpot(place) {
    const at = placeAt(place);
    const group = new THREE.Group();
    group.position.set(at.x, at.y, at.z + 0.6);
    group.userData.choice = place.word;
    group.userData.spot = true;
    group.userData.tapHeight = 0.85;
    // (drawn over the rock and the sand: a ring is never half hidden)
    const glowMat = new THREE.MeshBasicMaterial({ map: this.spotMap, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#fde047', depthTest: false });
    this.roundMaterials.add(glowMat);
    this.roundMaterials.add(ringMat);
    const disc = mesh(this.geo(new THREE.CircleGeometry(RING * 1.25, 40)), glowMat, { y: 0.85, shadow: false });
    const ring = mesh(this.geo(new THREE.RingGeometry(RING * 0.86, RING, 48)), ringMat, { y: 0.85, z: 0.01, shadow: false });
    disc.renderOrder = ring.renderOrder = 3;
    group.add(disc, ring);
    group.add(mesh(this.geo(new THREE.BoxGeometry(RING * 2.3, RING * 2.1, 0.4)), this.material('#ffffff', { visible: false }), { y: 0.85, shadow: false }));
    group.userData.ring = ring;
    const off = this.onUpdate((dt, t) => {
      const k = 1 + Math.sin(t * 5 + at.x) * 0.07;
      disc.scale.setScalar(k);
      glowMat.opacity = 0.7 + Math.sin(t * 5 + at.x) * 0.2;
    });
    this.roundOffs.push(off);
    return group;
  }

  /** The top level: the animal waits above the scene, three rings mark places, and she sends it to one. */
  placeRound(target) {
    return new Promise((resolve) => {
      const root = this.newRound(target);
      this.animalObj = this.animal(target.animal);
      this.animalObj.position.set(WAIT_AT.x, WAIT_AT.y, WAIT_AT.z);
      this.animalObj.scale.setScalar(ANIMAL_SCALE[target.animal]);
      root.add(this.animalObj);

      this.spots = reefChoices(target.place, this.L.words, this.L.choices).map((place) => {
        const spot = this.makeSpot(place);
        root.add(spot);
        this.tappable(spot, () => this.tapSpot(spot, target, resolve));
        this.roundTappables.push(spot);
        return spot;
      });
      const right = this.spots.find((spot) => spot.userData.choice === target.word);

      this.question('position', target.word, {
        short: () => T.reefPlaceAsk(target.animal, target.place.word, target.place.on),
        hint: (said = []) => {
          const asked = this.learn.current;
          this.say([...said, ...T.reefPlaceLook()]).then(() => this.pointAlong(this.spots.filter((x) => x.parent), (x) => { hop(x, 0.25); }))
            .then(() => { if (this.learn.current === asked) this.ask(T.reefPlaceAsk(target.animal, target.place.word, target.place.on)); });
          return Promise.resolve();
        },
        simplify: () => this.removeOption(this.lastWrong?.parent ? this.lastWrong : this.spots.find((spot) => spot !== right && spot.parent)),
        reveal: () => this.hint(right, () => this.phase !== 'asking'),
      }, { options: this.spots.length });

      ui.bubble({ big: '?', pic: animalPicture(target.animal), onTap: () => this.replay(), passthrough: true });
      this.askAfter(this.talk, T.reefPlaceAsk(target.animal, target.place.word, target.place.on));
    });
  }

  async swim(place) {
    const animal = this.animalObj;
    const to = placeAt(place);
    const from = animal.position.clone();
    await animate(900, (t) => {
      animal.position.lerpVectors(from, new THREE.Vector3(to.x, to.y, to.z), t);
      animal.position.y += Math.sin(t * Math.PI) * 0.6;
    }, ease.inOut);
    animal.position.set(to.x, to.y, to.z);
    if (place.word === 'pod') this.shade(animal);
  }

  async tapSpot(spot, target, resolve) {
    if (!this.alive || this.phase !== 'asking') return;
    this.poke();
    if (spot.userData.choice !== target.word) {
      this.lastWrong = spot;
      this.wrong(spot.userData.choice, { obj: spot });
      hop(spot, 0.15);
      return;
    }
    this.phase = 'solved';
    this.correct(target.word);
    this.stopIdle();
    this.spots.forEach((choice) => { this.untap(choice); choice.visible = false; }); // (the place is chosen: the rings go)
    sfx.good();
    await this.swim(target.place);
    if (!this.alive) return;
    this.success(this.animalObj.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    this.talk = this.say([this.praise(), ...T.reefRight(target.animal, target.place.word, target.place.on)]);
    await wait(SEEN_MS);
    if (!this.alive) return;
    resolve();
  }

  async round(r) {
    this.plan ||= reefPlan(this.L);
    if (r === 0) {
      await this.say(T.reefStart(factCursor++));
      if (!this.alive) return;
    }
    const target = this.plan[r] || this.plan.at(-1);
    await (this.L.mode === 'place' ? this.placeRound(target) : this.choiceRound(target));
    if (!this.alive) return;
    this.phase = 'clearing';
    this.clearRound();
  }

  clearRound() {
    this.roundOffs.splice(0).forEach((off) => off());
    this.roundTappables.splice(0).forEach((obj) => this.untap(obj));
    if (this.roundRoot) {
      this.roundRoot.traverse((o) => {
        if (o.geometry) this.roundGeometries.add(o.geometry);
        for (const m of [o.material].flat()) if (m) this.roundMaterials.add(m);
      });
      this.roundRoot.removeFromParent();
      this.roundRoot = null;
    }
    this.roundGeometries.forEach((geometry) => geometry.dispose());
    this.roundGeometries.clear();
    this.roundMaterials.forEach((material) => material.dispose());
    this.roundMaterials.clear();
    this.choices = [];
    this.spots = [];
    this.animalObj = null;
    this.lastWrong = null;
    this.last = null;
    this.phase = 'clearing';
  }

  doneLine() { return T.reefDone(); }

  exit() {
    super.exit();
    this.clearRound();
    this.world?.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [o.material].flat()) if (m) m.dispose();
    });
    this.world?.removeFromParent();
    this.maps.forEach((map) => map.dispose());
    this.maps = [];
    this.portrait?.dispose?.();
  }
}
