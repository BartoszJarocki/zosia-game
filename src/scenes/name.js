import * as THREE from 'three';
import { animate, ease, hop, wait } from '../engine.js';
import { makeTrain, makeKitten, rbox, mat, mesh } from '../models.js';
import { makePlatform, makeStationHouse, makeLamp, makeHouse } from '../world/props.js';
import { dust, sparkle } from '../fx/particles.js';
import { glyphTexture, labelTexture, TILE_COLORS } from '../textures.js';
import { CONFIG, showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle, pick } from '../util.js';
import { T } from '../lang/pl.js';
import { distractors } from '../levels.js';
import { ALL_LETTERS } from '../levels/data.js';
import { Mission } from './mission.js';

// "Name Train": load the letters of a word onto the train, in order. No spelling from memory: the word is
// always there to look at; the skills are recognising, matching, ordering and noticing what's missing.
// GAME.md "mode":
//   ghost      faint letters on the wagons: match each block to its wagon
//   word       the whole word in the bubble, wagons empty: which letter comes next?
//   missing    the train arrives loaded, one letter missing (Z O _ I A): which one?
//   highlight  the whole word in the bubble with the next letter lit (for new words)
// At the end the letters are said one by one, then the word, the word turns into its thing (PICTURES), and the
// train drives off (that's the reward).

// What a finished word turns into: a picture in the bubble and something in the scene. Her name: she cheers.
const PICTURES = {
  KOT: { pic: '🐱', show: (m) => m.kittenRides() },
  DOM: { pic: '🏠', show: (m) => m.houseAppears() },
  MAMA: { pic: '❤️', show: (m) => m.heartFloats() },
  TATA: { pic: '❤️', show: (m) => m.heartFloats() },
};
const NAME_PICTURE = { pic: '👧', show: (m) => m.girlCheers() };
export class NameMission extends Mission {
  constructor(game) {
    super(game, 'name');
    this.word = pick(this.L.words).toUpperCase();
    this.mode = this.L.mode || 'ghost';
    // which wagons she fills, in order (missing: just the gaps; the rest arrives loaded)
    const all = [...this.word].map((_, i) => i);
    this.fill = this.mode === 'missing' ? shuffle(all).slice(0, Math.min(this.L.gaps || 1, this.word.length - 1)).sort((a, b) => a - b) : all;
    this.rounds = this.fill.length;
    const width = 2 + this.word.length * 1.65 + 2;
    this.view = { pos: new THREE.Vector3(0, 6.2, 11.5), look: new THREE.Vector3(0, 1.4, 0.3), minWidth: Math.max(14, width + 3) };
    this.post = { tilt: 0.35, focus: 0.42, band: 0.3 };
  }

  build() {
    this.meadow({ clear: [[0, 0, 7], [0, -1.5, 9]] });
    // track: rails on sleepers, gravel bed, station behind
    this.scene.add(mesh(new THREE.BoxGeometry(80, 0.06, 2.4), mat('#b8b1a7', { roughness: 1 }), { y: 0.02, z: -1.5 }));
    for (const z of [-2.05, -0.95]) this.scene.add(mesh(new THREE.BoxGeometry(80, 0.1, 0.1), mat('#9ca3af', { metalness: 0.6, roughness: 0.35 }), { y: 0.12, z }));
    for (let x = -40; x < 40; x += 0.9) this.scene.add(mesh(new THREE.BoxGeometry(0.25, 0.08, 1.7), mat('#8a4b1f'), { x, y: 0.07, z: -1.5 }));
    const platform = makePlatform(16);
    platform.position.set(0, 0, -4.1);
    this.scene.add(platform);
    const station = makeStationHouse();
    station.position.set(3.5, 0.5, -6.2);
    station.scale.setScalar(1.3);
    this.scene.add(station);
    for (const x of [-6, 0, 6]) { const l = makeLamp(); l.position.set(x, 0.5, -4.6); this.scene.add(l); }

    const n = this.word.length;
    this.train = makeTrain(n);
    const span = 1.9 + n * 1.65; // engine front to last wagon
    this.train.rotation.y = Math.PI; // engine on the left, wagons trail right: reads Z-O-S-I-A
    this.train.position.set(-(span / 2 - 1.1), 0.1, -1.5);
    this.scene.add(this.train);
    this.trainSpeed = 0;
    this.onUpdate((dt, t) => this.train.userData.update(t, this.trainSpeed));

    // ghost letters show where each one goes (level 1)
    this.ghosts = [];
    if (this.mode === 'ghost') this.word.split('').forEach((_, i) => { this.ghosts[i] = this.makeGhost(i); });

    const edge = this.view.minWidth / 2;
    this.addHeroes(new THREE.Vector3(-edge + 1.2, 0, 2.6), 0.5, new THREE.Vector3(edge - 1.2, 0, 2.4), -0.5);

    // missing mode: the train arrives loaded, except the gaps
    this.placed = [];
    const colors0 = shuffle(TILE_COLORS);
    if (this.mode === 'missing') {
      this.train.updateMatrixWorld(true);
      [...this.word].forEach((letter, i) => {
        if (this.fill.includes(i)) return;
        const b = new THREE.Mesh(rbox(1.25, 1.25, 1.25, 0.14), new THREE.MeshStandardMaterial({ map: glyphTexture(showLetter(letter), { bg: colors0[i % colors0.length] }), roughness: 0.45 }));
        b.castShadow = true;
        b.position.copy(this.train.localToWorld(this.train.userData.slots[i].clone()));
        this.scene.add(b);
        this.train.attach(b);
        this.placed.push({ block: b, letter, idx: i });
      });
    }

    // letter blocks on the grass, shuffled, plus extras at higher levels (missing: only the gap letters + extras)
    const needed = this.fill.map((i) => this.word[i]);
    const extras = [];
    for (let i = 0; i < this.L.extras; i++) {
      const base = needed[i % needed.length];
      const d = distractors(base, ALL_LETTERS, 3, this.L.similar).find((l) => !this.word.includes(l) && !extras.includes(l));
      if (d) extras.push(d);
    }
    const letters = shuffle([...needed, ...extras]);
    const colors = shuffle(TILE_COLORS);
    const gap = Math.min(1.75, (this.view.minWidth - 5) / letters.length);
    this.blocks = letters.map((letter, i) => {
      const m = new THREE.MeshStandardMaterial({ map: glyphTexture(showLetter(letter), { bg: colors[i % colors.length] }), roughness: 0.45 });
      const b = new THREE.Mesh(rbox(1.25, 1.25, 1.25, 0.14), m);
      b.castShadow = b.receiveShadow = true;
      b.position.set((i - (letters.length - 1) / 2) * gap, 0.63, 2.3 + (i % 2) * 0.5);
      b.rotation.y = (Math.random() - 0.5) * 0.3;
      b.userData.letter = letter;
      b.userData.tapHeight = 0;
      this.scene.add(b);
      this.shadowUnder(b, 0.9, 0.3);
      this.dropIn(b, 0.63, 200 + i * 110).then(() => sfx.pop());
      return b;
    });
  }

  /** A soft white card with a pale blue letter, sitting on wagon i: "this one goes here". */
  makeGhost(i) {
    const slot = this.train.userData.slots[i];
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: labelTexture(showLetter(this.word[i]), { fg: '#9fb8f5', stroke: 'rgba(255,255,255,0.95)' }), transparent: true, opacity: 0.95, depthWrite: false }));
    this.train.updateMatrixWorld(true);
    g.position.copy(this.train.localToWorld(slot.clone())).add(new THREE.Vector3(0, -0.2, 0.62));
    g.userData.tick = (dt, t) => (g.position.y = 1.25 + Math.sin(t * 2.5 + i) * 0.05);
    this.scene.add(g);
    return g;
  }

  get canWindDown() { return false; } // a word is finished, not cut short

  /** The speech bubble for the wagon being filled (idx), or the finished word (idx = -1). lit: light idx. */
  bubbleFor(idx, { lit = this.mode !== 'word' } = {}) {
    const onTap = () => this.replay();
    const filled = this.placed.map((p) => p.idx);
    if (this.mode === 'ghost' && idx >= 0) return ui.bubble({ big: showLetter(this.word[idx]), pic: idx === 0 ? '🚂' : '', onTap });
    const word = [...this.word].map((c, i) => (this.mode === 'missing' && !filled.includes(i) ? '_' : showLetter(c))).join('');
    ui.bubble({ word, at: lit ? idx : -1, done: filled, onTap });
  }

  round(r) {
    return new Promise((resolve) => {
      const idx = this.fill[r];
      const target = this.word[idx];
      this.item('L:' + target);
      let solved = false;
      this.last = target;
      const right = () => this.blocks.find((x) => x.userData.letter === target);
      const ghostOn = () => { // its letter appears on the wagon
        if (this.ghosts[idx]) return;
        const g = (this.ghosts[idx] = this.makeGhost(idx));
        const off = this.onUpdate((dt, t) => { if (!g.parent) off(); else g.userData.tick(dt, t); }); // made after the scene was collected
        sfx.pop();
      };
      this.question('letterVisual', target, {
        short: { word: T.nextLetter(), missing: T.whichMissing() }[this.mode] || T.findLetter(target),
        hint: () => {
          if (this.mode === 'word') { this.bubbleFor(idx, { lit: true }); return T.spellNext(target); } // the next letter lights up
          ghostOn();
          return this.mode === 'missing' ? T.findLetter(target) : T.letterLike(target);
        },
        simplify: () => { // an extra letter (not in the word) leaves, keeping one for the last letter; otherwise the right block steps forward
          const later = this.fill.slice(r + 1).map((i) => this.word[i]);
          const spare = this.blocks.filter((x) => x.userData.letter && x.userData.letter !== target && !later.includes(x.userData.letter) && x.parent);
          const extra = spare.length > 1 || r === this.rounds - 1 ? spare[0] : null;
          if (extra) { this.removeOption(extra); extra.userData.letter = null; return; }
          const b = right();
          if (b && !b.userData.forward) { b.userData.forward = true; this.jumpTo(b, b.position.clone().add(new THREE.Vector3(0, 0, 0.7)), { height: 0.6, ms: 400 }); }
        },
        reveal: () => { const b = right(); if (b) this.hint(b, () => solved); },
      });

      const onTap = async (b) => {
        if (solved || !b.userData.letter) return;
        this.poke();
        this.lookAt(b);
        if (b.userData.letter === target) {
          solved = true;
          this.correct(target);
          this.stopIdle();
          this.untap(b);
          b.userData.letter = null;
          sfx.good();
          const slot = this.train.localToWorld(this.train.userData.slots[idx].clone());
          b.rotation.set(0, 0, 0);
          this.lookAt(slot);
          await this.jumpTo(b, slot, { height: 2, ms: 650 });
          // ride with the train from now on
          this.train.attach(b);
          this.placed.push({ block: b, letter: target, idx });
          sfx.boing();
          this.success(slot.clone().add(new THREE.Vector3(0, 0.8, 0)));
          if (this.ghosts[idx]) this.ghosts[idx].visible = false;
          if (this.mode !== 'ghost') this.bubbleFor(this.fill[r + 1] ?? -1);
          await say([...this.yes(), ...T.letter(target)]);
          resolve();
        } else {
          this.wrong(b.userData.letter, { obj: b, said: this.lookalikeNo(target, b.userData.letter) });
        }
      };
      this.blocks.forEach((b) => { if (b.userData.letter) this.tappable(b, onTap); });

      this.bubbleFor(idx);
      wait(r === 0 ? 1200 : 200).then(() => {
        if (!this.alive) return;
        const first = { word: T.wordStart(this.word), missing: T.missingAsk(this.word) }[this.mode] || T.spellStart(this.word);
        const next = { word: T.nextLetter(), missing: T.whichMissing() }[this.mode] || T.spellNext(target);
        this.ask(r === 0 ? first : next);
      });
    });
  }

  /** KOT: a kitten pops up on the last wagon and rides off with the train. */
  kittenRides() {
    const k = makeKitten();
    k.scale.setScalar(0.95);
    const slot = this.train.userData.slots[this.word.length - 1].clone().add(new THREE.Vector3(0, 0.64, 0)); // on top of the last block
    this.train.updateMatrixWorld(true);
    k.position.copy(this.train.localToWorld(slot));
    this.scene.add(k);
    this.train.attach(k);
    k.rotation.set(0, Math.PI, 0); // (the train is turned round: face the camera; attach() can leave x and z at π)
    this.onUpdate((dt, t) => k.userData.idle(t));
    sfx.meow();
    hop(k, 0.8, 500);
    sparkle(this, k.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0)), { count: 14 });
  }
  /** DOM: a little house pops up on the platform. */
  houseAppears() {
    const h = makeHouse('#bfdbfe', '#ef4444');
    h.scale.setScalar(0.75);
    h.position.set(-6.6, 0.5, -4.6); // on the platform, where the train is about to go
    this.scene.add(h);
    this.dropIn(h, 0.5, 0, 700).then(() => { sfx.boing(); sparkle(this, h.position.clone().add(new THREE.Vector3(0, 1.8, 0)), { count: 18 }); });
  }
  /** MAMA / TATA: a big heart floats up from the train. */
  heartFloats() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.35);
    s.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5);
    const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 }),
      new THREE.MeshStandardMaterial({ color: '#f43f5e', emissive: '#f43f5e', emissiveIntensity: 0.35, roughness: 0.35 }));
    heart.position.set(0, 2, -1);
    this.scene.add(heart);
    sfx.pop();
    animate(2600, (t) => {
      heart.position.y = 2 + t * 2.2;
      heart.scale.setScalar((0.4 + Math.min(1, t * 3) * 0.9) * (1 + Math.sin(t * Math.PI * 6) * 0.06));
      heart.rotation.y = Math.sin(t * Math.PI * 2) * 0.3;
    }, ease.out).then(() => this.shrinkAway(heart, 300));
  }
  /** Her name: she cheers and jumps, sparkles all round. */
  async girlCheers() {
    const to = new THREE.Vector3(-this.view.minWidth / 2 + 3.2, 0, 3); // a hop into view first
    this.walking = true;
    await this.jumpTo(this.girl, to, { height: 0.9, ms: 520 });
    this.walking = false;
    this.cheer(2.5);
    this.girl.userData.setHappy(3);
    sparkle(this, to.clone().add(new THREE.Vector3(0, 1.8, 0)), { count: 22 });
  }

  async outro() {
    await wait(300);
    // spell it together, letter by letter
    this.placed.sort((a, b) => a.idx - b.idx);
    for (const [i, { block, letter }] of this.placed.entries()) {
      if (!this.alive) return;
      if (this.mode !== 'ghost') ui.bubble({ word: [...this.word].map(showLetter).join(''), at: i, onTap: () => {} });
      hop(block, 0.6, 380);
      sfx.pop();
      await say(T.letter(letter));
    }
    if (!this.alive) return;
    const picture = PICTURES[this.word] || (this.word === CONFIG.childName.toUpperCase() ? NAME_PICTURE : null);
    const all = [...this.word].map((_, i) => i);
    ui.bubble({ word: [...this.word].map(showLetter).join(''), done: all, pic: picture?.pic || '', onTap: () => {} });
    this.success(null, { big: true });
    await say([...T.spellWord(this.word), this.praise()]);
    if (!this.alive) return;
    ui.hideBubble(); // (the picture rises where the bubble was)
    if (picture) {
      picture.show(this);
      await say(T.wordPicture(this.word));
      if (!this.alive) return;
    }
    sfx.toot();
    this.trainSpeed = 0.35;
    this.ghosts.forEach((g) => g.removeFromParent());
    const x0 = this.train.position.x;
    let puff = 0;
    await animate(2600, (t) => {
      this.train.position.x = x0 - t * t * 30;
      if (++puff % 8 === 0) dust(this, this.train.position.clone().add(new THREE.Vector3(-1, 0.1, 0.6)), { count: 3, size: 0.25 });
    }, ease.linear);
    this.trainSpeed = 0;
  }
}
