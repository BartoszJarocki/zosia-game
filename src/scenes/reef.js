import * as THREE from 'three';
import { animate, ease, hop, camera } from '../engine.js';
import { mat, mesh } from '../models.js';
import { portrait } from '../world/portrait.js';
import { texture } from '../textures.js';
import { sfx } from '../audio.js';
import { T } from '../lang/pl.js';
import { reefPlan, reefChoices, reefSpots, placeKey, placeAt } from '../levels/reef.js';
import * as ui from '../ui.js';
import { Mission } from './mission.js';

const MINI_WIDTH = 3.6, MINI_GAP = 0.3;
const MINI_AT = {
  'na:rock': { x: -0.85, y: 1.7, z: 0.05 },
  'na:shell': { x: 0.9, y: 0.86, z: 0.15 },
  'pod:rock': { x: -0.85, y: 0.18, z: 0.35 },
  'w:shell': { x: 0.9, y: 0.2, z: 0.15 },
  'obok:rock': { x: -0.15, y: 0.18, z: 0.3 },
  'obok:shell': { x: 1.55, y: 0.18, z: 0.35 },
};
const ANIMAL_EMOJI = { crab: '🦀', starfish: '🌟', fish: '🐟', octopus: '🐙' };

let factCursor = 0;

/** A little bubble picture of the asked position: the animal, a rock or shell, and where they are. */
function positionPicture(word, on) {
  const base = on === 'shell'
    ? '<path d="M28 62 C28 45 72 45 72 62 C72 78 60 85 50 85 C40 85 28 78 28 62 Z" fill="#f9a8d4" stroke="#ec4899" stroke-width="2"/>'
    : '<ellipse cx="50" cy="64" rx="22" ry="14" fill="#94a3b8" stroke="#64748b" stroke-width="2"/>';
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#fbbf24" stroke="#f59e0b" stroke-width="2"/>`;
  const animal = { na: dot(50, 42), pod: dot(50, 82), w: dot(50, 66), obok: dot(76, 70) }[word];
  return `<svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true">${base}${animal}</svg>`;
}

export class ReefMission extends Mission {
  constructor(game) {
    super(game, 'reef');
    this.view = { pos: new THREE.Vector3(0, 9.5, 18), look: new THREE.Vector3(0, 0.8, 0), minWidth: 18 };
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
    this.scene.background = new THREE.Color('#8fe6e0');
    this.scene.add(new THREE.HemisphereLight('#f7ffff', '#87dcc8', 2.4));
    const sun = new THREE.DirectionalLight('#fff6d8', 2.1);
    sun.position.set(-8, 16, 12);
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
    this.world.add(mesh(new THREE.CircleGeometry(32, 64), sand, { y: -0.06, rx: -Math.PI / 2, shadow: false }));

    this.rippleMap = texture(512, (c, size) => {
      c.clearRect(0, 0, size, size);
      c.strokeStyle = 'rgba(255, 252, 216, 0.55)';
      c.lineWidth = 8;
      c.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const y = 20 + i * 36;
        c.beginPath();
        c.moveTo(-20, y);
        for (let x = -20; x <= size + 20; x += 42) c.quadraticCurveTo(x + 21, y + (i % 2 ? 13 : -13), x + 42, y);
        c.stroke();
      }
    });
    this.maps.push(this.rippleMap);
    this.rippleMap.wrapS = this.rippleMap.wrapT = THREE.RepeatWrapping;
    this.rippleMap.repeat.set(2, 2);
    const rippleMat = new THREE.MeshBasicMaterial({ map: this.rippleMap, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    this.world.add(mesh(new THREE.PlaneGeometry(30, 30), rippleMat, { y: 0.01, rx: -Math.PI / 2, shadow: false }));
    this.onUpdate((dt) => { this.rippleMap.offset.x = (this.rippleMap.offset.x + dt * 0.004) % 1; });

    const grassGeo = new THREE.ConeGeometry(0.11, 1.2, 5);
    const grassMats = [mat('#34d399', { roughness: 1 }), mat('#16a34a', { roughness: 1 })];
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, r = 5.8 + (i % 4) * 0.7;
      this.world.add(mesh(grassGeo, grassMats[i % 2], {
        x: Math.cos(a) * r, y: 0.58, z: Math.sin(a) * r * 0.62, rz: (i % 5 - 2) * 0.08, shadow: false,
      }));
    }

    this.frame = new THREE.Group();
    this.frame.add(mesh(new THREE.TorusGeometry(1, 0.05, 12, 64), mat('#e8fffa', { metalness: 0.1, roughness: 0.45 }), { shadow: false }));
    this.frame.add(mesh(new THREE.TorusGeometry(0.945, 0.012, 8, 64), mat('#76d9c9', { roughness: 0.5 }), { z: 0.01, shadow: false }));
    this.world.add(this.frame);

    this.portrait = portrait();
    const face = new THREE.MeshBasicMaterial({ map: this.portrait.texture });
    this.window = new THREE.Group();
    this.window.add(mesh(new THREE.CircleGeometry(1.0, 48), face, { shadow: false }));
    this.window.add(mesh(new THREE.TorusGeometry(1.06, 0.09, 12, 48), mat('#f8e7b5', { metalness: 0.1, roughness: 0.45 }), { z: 0.01, shadow: false }));
    this.window.position.set(6.4, 7, 8);
    this.world.add(this.window);
    this.tappable(this.window, () => { sfx.bark(); hop(this.window, 0.18); });

    this.onUpdate(() => this.layoutFrame());
    this.scene.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
  }

  layoutFrame() {
    const look = this.view.look;
    const dir = camera.position.clone().sub(look);
    const distance = Math.max(6, Math.min(12, dir.length() * 0.58));
    dir.normalize();
    this.frame.position.copy(look).addScaledVector(dir, distance);
    const half = distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, camera.aspect);
    this.frame.scale.setScalar(half * 0.94);
    this.frame.lookAt(camera.position);
    this.window.lookAt(camera.position);
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

  rock(scale = 1) {
    const group = new THREE.Group();
    group.add(mesh(this.geo(new THREE.DodecahedronGeometry(1, 1)), this.material('#8b95a1', { roughness: 1 }), {
      y: 1.05 * scale, s: [1.05 * scale, 0.62 * scale, 0.9 * scale], shadow: false,
    }));
    group.add(mesh(this.geo(new THREE.SphereGeometry(0.16 * scale, 8, 6)), this.material('#68737f', { roughness: 1 }), {
      x: -0.48 * scale, y: 0.12 * scale, z: 0.3 * scale, s: [1.2, 0.6, 1], shadow: false,
    }));
    return group;
  }

  shell(scale = 1) {
    const group = new THREE.Group();
    const pink = this.material('#f9a8d4', { roughness: 0.5, side: THREE.DoubleSide });
    group.add(mesh(this.geo(new THREE.SphereGeometry(0.85 * scale, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), pink, {
      y: 0.72 * scale, shadow: false,
    }));
    group.add(mesh(this.geo(new THREE.TorusGeometry(0.85 * scale, 0.06 * scale, 8, 32)), this.material('#fbcfe8', { roughness: 0.5 }), {
      y: 0.72 * scale, rx: Math.PI / 2, shadow: false,
    }));
    return group;
  }

  animal(kind) {
    const group = new THREE.Group();
    const black = this.material('#1f2937', { roughness: 0.6 });
    const face = (y, z) => {
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.055, 8, 6)), black, { x: -0.12, y, z, shadow: false }));
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.055, 8, 6)), black, { x: 0.12, y, z, shadow: false }));
      group.add(mesh(this.geo(new THREE.TorusGeometry(0.055, 0.012, 6, 10, Math.PI)), black, { y: y - 0.09, z: z + 0.02, rz: Math.PI, shadow: false }));
    };
    if (kind === 'crab') {
      const red = this.material('#ef4444', { roughness: 0.55 });
      const dark = this.material('#991b1b', { roughness: 0.7 });
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.34, 16, 12)), red, { y: 0.32, s: [1.2, 0.72, 0.95], shadow: false }));
      for (const side of [-1, 1]) {
        group.add(mesh(this.geo(new THREE.SphereGeometry(0.16, 10, 8)), red, { x: side * 0.42, y: 0.3, z: 0.2, s: [0.75, 0.55, 0.55], shadow: false }));
        for (let i = 0; i < 3; i++) group.add(mesh(this.geo(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 6)), dark, {
          x: side * 0.4, y: 0.15, z: -0.16 + i * 0.16, rz: side * 1.1, shadow: false,
        }));
      }
      face(0.5, 0.28);
      return group;
    }
    if (kind === 'starfish') {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.22 : 0.58;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
      }
      shape.closePath();
      const star = this.geo(new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1 }));
      group.add(mesh(star, this.material('#fb7185', { roughness: 0.5 }), { rx: -Math.PI / 2, y: 0.08, shadow: false }));
      face(0.22, 0.12);
      return group;
    }
    if (kind === 'fish') {
      const blue = this.material('#60a5fa', { roughness: 0.5 });
      const orange = this.material('#fb923c', { roughness: 0.55 });
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.34, 16, 12)), blue, { y: 0.36, s: [1.2, 0.68, 0.52], shadow: false }));
      group.add(mesh(this.geo(new THREE.ConeGeometry(0.2, 0.35, 8)), orange, { x: -0.47, y: 0.36, rz: Math.PI / 2, shadow: false }));
      group.add(mesh(this.geo(new THREE.SphereGeometry(0.12, 10, 8)), orange, { x: 0.05, y: 0.55, z: 0.02, s: [1, 0.5, 0.4], shadow: false }));
      face(0.45, 0.27);
      return group;
    }
    const purple = this.material('#a78bfa', { roughness: 0.55 });
    group.add(mesh(this.geo(new THREE.SphereGeometry(0.34, 16, 12)), purple, { y: 0.55, s: [1, 0.88, 0.9], shadow: false }));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      group.add(mesh(this.geo(new THREE.CylinderGeometry(0.035, 0.075, 0.4, 6)), purple, {
        x: Math.cos(a) * 0.22, y: 0.23, z: Math.sin(a) * 0.2, rz: Math.cos(a) * 0.65, rx: Math.sin(a) * 0.65, shadow: false,
      }));
    }
    face(0.6, 0.3);
    return group;
  }

  seat(animal, place, mini) {
    const at = mini ? MINI_AT[placeKey(place)] : placeAt(place);
    animal.position.set(at.x, at.y, at.z);
    const scale = mini ? (place.word === 'w' ? 0.55 : 0.7) : (place.word === 'w' ? 0.85 : 1.05);
    animal.scale.setScalar(scale);
  }

  makeMini(place, animalKind) {
    const group = new THREE.Group();
    group.add(mesh(this.geo(new THREE.CircleGeometry(1.8, 40)), this.material('#fbe7b4', { roughness: 1 }), {
      y: 0.015, rx: -Math.PI / 2, shadow: false,
    }));
    group.add(mesh(this.geo(new THREE.TorusGeometry(1.78, 0.035, 6, 40)), this.material('#a7f3d0', { roughness: 0.6 }), {
      y: 0.03, rx: -Math.PI / 2, shadow: false,
    }));
    const rock = this.rock(1);
    rock.position.set(-0.85, 0, 0);
    group.add(rock);
    const shell = this.shell(1);
    shell.position.set(0.9, 0, 0.15);
    group.add(shell);
    const animal = this.animal(animalKind);
    this.seat(animal, place, true);
    group.add(animal);
    const hit = mesh(this.geo(new THREE.BoxGeometry(3.5, 2.8, 0.2)), this.material('#ffffff', { visible: false }), {
      y: 1.25, z: 0.25, shadow: false,
    });
    group.add(hit);
    group.userData.hit = hit;
    group.userData.animal = animal;
    group.userData.choice = place.word;
    group.userData.tapHeight = 1.25;
    return group;
  }

  choiceRound(target) {
    return new Promise((resolve) => {
      this.phase = 'asking';
      this.last = target.word;
      this.item('R:' + target.word);
      const root = new THREE.Group();
      root.userData.dynamic = true;
      this.roundRoot = root;
      this.scene.add(root);

      const choices = reefChoices(target.place, this.L.words, this.L.choices);
      const width = choices.length >= 4 ? 3.0 : MINI_WIDTH;
      const step = width + MINI_GAP;
      const start = -((choices.length - 1) / 2) * step;
      this.choices = choices.map((place, i) => {
        const group = this.makeMini(place, target.animal);
        group.position.set(start + i * step, 0, 0);
        group.scale.setScalar(width / MINI_WIDTH);
        root.add(group);
        this.tappable(group, () => this.tapChoice(group, target, resolve));
        this.roundTappables.push(group);
        return group;
      });
      const right = this.choices.find((group) => group.userData.choice === target.word);

      this.question('position', target.word, {
        short: () => T.reefAsk(target.animal, target.place.word, target.place.on),
        hint: () => T.reefLook(),
        simplify: () => this.removeOption(this.lastWrong?.parent ? this.lastWrong : this.choices.find((group) => group !== right && group.parent)),
        reveal: () => this.hint(right, () => this.phase !== 'asking'),
      }, { options: this.choices.length });

      const bubble = { big: '?', onTap: () => this.replay(), passthrough: true };
      if (this.L.mode === 'see') Object.assign(bubble, { big: target.word, pic: positionPicture(target.word, target.place.on) });
      ui.bubble(bubble);
      this.ask(T.reefAsk(target.animal, target.place.word, target.place.on));
    });
  }

  async tapChoice(group, target, resolve) {
    if (!this.alive || this.phase !== 'asking') return;
    this.poke();
    this.lookAt(group);
    if (group.userData.choice !== target.word) {
      this.phase = 'checking';
      this.lastWrong = group;
      this.wrong(group.userData.choice, { obj: group, feedback: false });
      hop(group, 0.22);
      await this.say(T.reefWrong(target.animal, target.place.word, target.place.on));
      if (!this.alive) return;
      const right = this.choices.find((choice) => choice.userData.choice === target.word);
      this.phase = 'asking';
      this.hint(right, () => this.phase !== 'asking');
      return;
    }
    this.phase = 'solved';
    this.correct(target.word);
    this.stopIdle();
    this.choices.forEach((choice) => this.untap(choice));
    sfx.good();
    const s0 = group.userData.animal.scale.x;
    await animate(420, (t) => group.userData.animal.scale.setScalar(s0 * (1 + Math.sin(t * Math.PI) * 0.2)), ease.linear);
    if (!this.alive) return;
    this.success(group.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    await this.say([this.praise(), ...T.reefRight(target.animal, target.place.word, target.place.on)]);
    if (!this.alive) return;
    resolve();
  }

  makeSpot(place) {
    const at = placeAt(place);
    const group = new THREE.Group();
    group.position.set(at.x, at.y, at.z);
    group.userData.choice = place.word;
    group.userData.spot = true;
    group.userData.tapHeight = 0;
    const ringMat = this.material('#fef08a', { emissive: '#f59e0b', emissiveIntensity: 0.9, roughness: 0.4 });
    const ring = mesh(this.geo(new THREE.TorusGeometry(0.55, 0.08, 8, 28)), ringMat, { rx: -Math.PI / 2, shadow: false });
    const disc = mesh(this.geo(new THREE.CircleGeometry(0.5, 24)), this.material('#fff7cc', { transparent: true, opacity: 0.7, depthWrite: false }), {
      y: 0.01, rx: -Math.PI / 2, shadow: false,
    });
    group.add(ring, disc);
    group.add(mesh(this.geo(new THREE.SphereGeometry(1.2, 12, 8)), this.material('#ffffff', { visible: false }), { shadow: false }));
    group.userData.ring = ring;
    group.userData.disc = disc;
    const off = this.onUpdate((dt, t) => {
      const k = 1 + Math.sin(t * 5 + at.x) * 0.12;
      ring.scale.setScalar(k);
      disc.scale.setScalar(k);
      ringMat.emissiveIntensity = 0.7 + Math.sin(t * 5 + at.x) * 0.25;
    });
    this.roundOffs.push(off);
    return group;
  }

  placeRound(target) {
    return new Promise((resolve) => {
      this.phase = 'asking';
      this.last = target.word;
      this.item('R:' + target.word);
      const root = new THREE.Group();
      root.userData.dynamic = true;
      this.roundRoot = root;
      this.scene.add(root);

      const rock = this.rock(1.25);
      rock.position.set(-3.8, 0, 0);
      root.add(rock);
      const shell = this.shell(1.35);
      shell.position.set(2.4, 0, 0.6);
      root.add(shell);
      this.animalObj = this.animal(target.animal);
      this.animalObj.position.set(0, 3.6, 0.3);
      this.animalObj.scale.setScalar(1.05);
      root.add(this.animalObj);

      this.spots = reefSpots(target.place, this.L.words, this.L.choices).map((place) => {
        const spot = this.makeSpot(place);
        root.add(spot);
        this.tappable(spot, () => this.tapSpot(spot, target, resolve));
        this.roundTappables.push(spot);
        return spot;
      });
      const right = this.spots.find((spot) => spot.userData.choice === target.word);

      this.question('position', target.word, {
        short: () => T.reefPlaceAsk(target.animal, target.place.word, target.place.on),
        hint: () => T.reefPlaceLook(),
        simplify: () => this.removeOption(this.lastWrong?.parent ? this.lastWrong : this.spots.find((spot) => spot !== right && spot.parent)),
        reveal: () => this.hint(right, () => this.phase !== 'asking'),
      }, { options: this.spots.length });

      ui.bubble({ big: '?', pic: ANIMAL_EMOJI[target.animal], onTap: () => this.replay(), passthrough: true });
      this.ask(T.reefPlaceAsk(target.animal, target.place.word, target.place.on));
    });
  }

  async swim(place) {
    const animal = this.animalObj;
    const to = placeAt(place);
    const from = animal.position.clone();
    const s0 = animal.scale.x, s1 = place.word === 'w' ? 0.85 : 1.05;
    await animate(900, (t) => {
      animal.position.lerpVectors(from, new THREE.Vector3(to.x, to.y, to.z), t);
      animal.position.y += Math.sin(t * Math.PI) * 0.6;
      animal.scale.setScalar(s0 + (s1 - s0) * t);
    }, ease.inOut);
    animal.position.set(to.x, to.y, to.z);
  }

  async tapSpot(spot, target, resolve) {
    if (!this.alive || this.phase !== 'asking') return;
    this.poke();
    this.lookAt(spot);
    if (spot.userData.choice !== target.word) {
      this.phase = 'checking';
      this.lastWrong = spot;
      this.wrong(spot.userData.choice, { obj: spot, feedback: false });
      hop(spot, 0.15);
      await this.say(T.reefWrong(target.animal, target.place.word, target.place.on));
      if (!this.alive) return;
      const right = this.spots.find((choice) => choice.userData.choice === target.word);
      this.phase = 'asking';
      this.hint(right, () => this.phase !== 'asking');
      return;
    }
    this.phase = 'solved';
    this.correct(target.word);
    this.stopIdle();
    this.spots.forEach((choice) => this.untap(choice));
    sfx.good();
    await this.swim(target.place);
    if (!this.alive) return;
    this.success(this.animalObj.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    await this.say([this.praise(), ...T.reefRight(target.animal, target.place.word, target.place.on)]);
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
