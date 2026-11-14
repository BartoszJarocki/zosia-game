import * as THREE from 'three';
import { animate, ease, hop, wait, camera, shakeNo } from '../engine.js';
import { makeTrain, makeKitten, rbox, mat, mesh } from '../models.js';
import { makePlatform, makeStationHouse, makeLamp, makeHouse } from '../world/props.js';
import { dust, sparkle } from '../fx/particles.js';
import { mergeSiblings } from '../fx/optimize.js';
import { glyphTexture, labelTexture, TILE_COLORS } from '../textures.js';
import { CONFIG, WORDS, showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T, SYLLABLE_ROWS } from '../lang/pl.js';
import { isLookalike, settingsFor } from '../levels.js';
import { ALL_LETTERS } from '../levels/data.js';
import { pickWord, gapsFor, pickExtras, whoseOrder, whoseTrains, syllableWagons, nextSlot, couple } from '../levels/train.js';
import { Mission } from './mission.js';

// "Name Train": load the letters of a word onto the train, in order. No spelling from memory: the word is
// always there to look at; the skills are recognising, matching, ordering and noticing what's missing.
// GAME.md "mode":
//   ghost      faint letters on the wagons: match each block to its wagon
//   highlight  the whole word in the bubble with the next letter lit
//   word       the whole word in the bubble, the next wagon glowing: which letter goes here?
//   missing    the train arrives loaded with gaps (Z O _ I _), the whole word in the bubble: which are missing?
//   whose      three trains with name boards: "Który pociąg jest Zosi?" (WhoseTrain, below)
//   match, hear, build   the syllable train: MAMA from two MA blocks (SyllableTrain, below)
// At the end the word is clapped in syllables, then said whole ("Zo! Sia! Zosia!"), it turns into its thing
// (PICTURES) and the train drives off (that's the reward).

const NAME = CONFIG.childName.toUpperCase();
/** What a finished word turns into: a picture in the bubble and something in the scene. */
const PICTURES = {
  KOT: { pic: '🐱', show: (m) => m.kittenRides() },
  DOM: { pic: '🏠', show: (m) => m.houseAppears() },
};
const NAME_PICTURE = { pic: '👧', show: (m) => m.girlCheers() }; // her name: she cheers
const HEART = { pic: '❤️', show: (m) => floatHeart(m) };         // a person (MAMA, KASIA…): a kiss for them
const STEP = 1.65; // wagon to wagon
const GAP = 1.6;   // letter block to letter block on the grass
let lastWord = null; // (never the same word twice in a row)

/**
 * The syllable train's task kinds (GAME.md mode): the skill a piece is recorded as, whether the word shows in pieces
 * from the start (`match` is the example itself), and how many pieces arrive on the train. Without the example a word
 * card stands by the track and brings it back.
 */
const SYLLABLE_TASKS = {
  match: { skill: 'syllableVisual', example: true, leave: 0 },
  hear: { skill: 'syllableAudio', example: false, leave: 1 },
  build: { skill: 'syllableBuild', example: false, leave: 0 },
};
/** Who or what a syllable word is, in the bubble: before she answers in `hear` and `build`, once it is built in `match`. */
export const WORD_PICS = { MAMA: '👩', TATA: '👨', LALA: '🪆' };
const SYL_W = 1.4, SYL_H = 1.05, SYL_GAP = 1.85; // a syllable block, and block to block on the grass

/** main.js does `new NameMission(game)`: the level's mode decides which train mission that is. */
export function NameMission(game) {
  const Train = { whose: WhoseTrain, match: SyllableTrain, hear: SyllableTrain, build: SyllableTrain }[settingsFor('name').mode] || LetterTrain;
  return new Train(game);
}

/** MAMA, TATA, a family name: a big heart floats up from the train. */
function floatHeart(m) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.35);
  s.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5);
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 }),
    new THREE.MeshStandardMaterial({ color: '#f43f5e', emissive: '#f43f5e', emissiveIntensity: 0.35, roughness: 0.35 }));
  heart.position.set(0, 2, -1);
  m.scene.add(heart);
  sfx.pop();
  animate(2600, (t) => {
    heart.position.y = 2 + t * 2.2;
    heart.scale.setScalar((0.4 + Math.min(1, t * 3) * 0.9) * (1 + Math.sin(t * Math.PI * 6) * 0.06));
    heart.rotation.y = Math.sin(t * Math.PI * 2) * 0.3;
  }, ease.out).then(() => m.shrinkAway(heart, 300));
}

/** The train toots and drives off to the left with whatever rides on it. */
async function driveOff(m) {
  sfx.toot();
  m.trainSpeed = 0.35;
  const x0 = m.train.position.x;
  let puff = 0;
  await animate(2600, (t) => {
    m.train.position.x = x0 - t * t * 30;
    if (++puff % 8 === 0) dust(m, m.train.position.clone().add(new THREE.Vector3(-1, 0.1, 0.6)), { count: 3, size: 0.25 });
  }, ease.linear);
  m.trainSpeed = 0;
}

/** The station: meadow, a track on gravel at each z, the platform, station house and lamps behind. */
function buildStation(m, tracks) {
  const back = Math.min(...tracks);
  m.meadow({ clear: [[0, 0, 7], ...tracks.map((z) => [0, z, 9])] });
  for (const z of tracks) {
    m.scene.add(mesh(new THREE.BoxGeometry(80, 0.06, 2.4), mat('#b8b1a7', { roughness: 1 }), { y: 0.02, z }));
    for (const dz of [-0.55, 0.55]) m.scene.add(mesh(new THREE.BoxGeometry(80, 0.1, 0.1), mat('#9ca3af', { metalness: 0.6, roughness: 0.35 }), { y: 0.12, z: z + dz }));
    for (let x = -40; x < 40; x += 0.9) m.scene.add(mesh(new THREE.BoxGeometry(0.25, 0.08, 1.7), mat('#8a4b1f'), { x, y: 0.07, z }));
  }
  const platform = makePlatform(16);
  platform.position.set(0, 0, back - 2.6);
  m.scene.add(platform);
  const station = makeStationHouse();
  station.position.set(3.5, 0.5, back - 4.7);
  station.scale.setScalar(1.3);
  m.scene.add(station);
  for (const x of [-6, 0, 6]) { const l = makeLamp(); l.position.set(x, 0.5, back - 3.1); m.scene.add(l); }
}

/** A train rotated so the engine is on the left and the wagons trail right (reads Z-O-S-I-A). */
function trainAt(cars, x, z) {
  const t = makeTrain(cars);
  t.rotation.y = Math.PI;
  t.position.set(x, 0.1, z);
  return t;
}

class LetterTrain extends Mission {
  constructor(game) {
    super(game, 'name');
    this.mode = this.L.mode || 'ghost';
    this.word = lastWord = pickWord(this.L.words, { name: NAME, last: lastWord });
    // which wagons she fills, in order (missing: just the gaps; the rest arrives loaded)
    this.fill = this.mode === 'missing' ? gapsFor(this.word, this.L.gaps) : [...this.word].map((_, i) => i);
    this.rounds = this.fill.length;
    // The blocks wait in front of the train, in two rows when there are many, or on a portrait iPad where one
    // row would make them too small (there they come close to the camera, filling the tall screen). With two rows the
    // camera looks down more, so the back row shows over the front one. The heroes stand either side.
    const n = this.fill.length + this.L.extras;
    const tall = camera.aspect < 1;
    const rows = n > (tall ? 4 : 7) ? 2 : 1;
    const size = tall ? 1.12 : 1; // (they shrink onto the wagons)
    const half = ((Math.ceil(n / rows) - 1) * GAP + 1.25 * size) / 2;
    const front = rows === 1 ? 2.3 : tall ? 4.5 : 2.2, rowGap = tall ? 3.5 : 2.6;
    this.layout = { rows, size, front, rowGap, heroX: half + 1.6, heroZ: rows === 1 ? 2.5 : front + rowGap / 2 - 0.2 };
    this.span = 1.9 + this.word.length * STEP; // engine front to last wagon
    // heroes stand nearer the camera than the point it frames, so they need ~20% more room than their x
    const minWidth = Math.max(14, this.span + 2, (this.layout.heroX + 1) * 2 / 0.8);
    this.view = rows === 1 ? { pos: new THREE.Vector3(0, 6.2, 11.5), look: new THREE.Vector3(0, 1.4, 0.3), minWidth }
      : tall ? { pos: new THREE.Vector3(0, 9, 11), look: new THREE.Vector3(0, 1, -1), minWidth } // (framed on the train: the rows sit nearer, so bigger)
        : { pos: new THREE.Vector3(0, 9.4, 13), look: new THREE.Vector3(0, 0.8, 1.4), minWidth };
    this.post = { tilt: 0.35, focus: 0.42, band: 0.3 };
  }

  build() {
    buildStation(this, [-1.5]);
    const n = this.word.length;
    this.train = trainAt(n, -(this.span / 2 - 1.1), -1.5);
    this.scene.add(this.train);
    this.trainSpeed = 0;
    this.onUpdate((dt, t) => this.train.userData.update(t, this.trainSpeed));

    // ghost letters show where each one goes (level 1)
    this.ghosts = [];
    if (this.mode === 'ghost') this.word.split('').forEach((_, i) => { this.ghosts[i] = this.makeGhost(i); });
    // word and highlight: the wagon to fill next glows softly
    if (this.mode === 'word' || this.mode === 'highlight') this.glow = this.makeGlow();

    const { rows, size, front, rowGap, heroX, heroZ } = this.layout;
    this.addHeroes(new THREE.Vector3(-heroX, 0, heroZ), 0.5, new THREE.Vector3(heroX, 0, heroZ), -0.5);

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

    // letter blocks on the grass, shuffled, plus extras that look like none of the word's letters (unless similar)
    const needed = this.fill.map((i) => this.word[i]);
    const extras = pickExtras(this.word, this.L.extras, { pool: ALL_LETTERS, similar: this.L.similar, isLookalike });
    const letters = shuffle([...needed, ...extras]);
    const colors = shuffle(TILE_COLORS);
    const perRow = Math.ceil(letters.length / rows);
    this.blocks = letters.map((letter, i) => {
      const m = new THREE.MeshStandardMaterial({ map: glyphTexture(showLetter(letter), { bg: colors[i % colors.length] }), roughness: 0.45 });
      const b = new THREE.Mesh(rbox(1.25, 1.25, 1.25, 0.14), m);
      b.castShadow = b.receiveShadow = true;
      const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, letters.length - row * perRow);
      const y = 0.63 * size;
      b.scale.setScalar(size);
      b.position.set((col - (inRow - 1) / 2) * GAP, y, rows === 1 ? front + (i % 2) * 0.5 : front + row * rowGap);
      b.rotation.y = (Math.random() - 0.5) * 0.3;
      b.userData.letter = letter;
      b.userData.tapHeight = 0;
      this.scene.add(b);
      this.shadowUnder(b, 0.9, 0.3);
      this.dropIn(b, y, 200 + i * 110).then(() => sfx.pop());
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

  /** A softly glowing golden frame on the wagon that is filled next: "a block goes here" (moved with glowAt). */
  makeGlow() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const c = cv.getContext('2d');
    c.shadowColor = '#fde047'; c.shadowBlur = 28;
    c.strokeStyle = '#fbbf24'; c.lineWidth = 16; c.fillStyle = 'rgba(253, 224, 71, 0.28)';
    c.beginPath(); c.roundRect(34, 34, 188, 188, 30); c.fill(); c.stroke();
    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    g.userData.tick = (dt, t) => { g.material.opacity = 0.7 + Math.sin(t * 3) * 0.25; g.scale.setScalar(1 + Math.sin(t * 3) * 0.04); };
    this.scene.add(g);
    return g;
  }
  glowAt(idx) {
    if (!this.glow) return;
    this.glow.visible = idx >= 0;
    if (idx >= 0) this.glow.position.copy(this.train.localToWorld(this.train.userData.slots[idx].clone())).add(new THREE.Vector3(0, -0.1, 0.1)); // (where the block will sit)
  }

  get canWindDown() { return false; } // a word is finished, not cut short

  /** The speech bubble for the wagon being filled (idx), or the finished word (idx = -1). lit: light idx. */
  bubbleFor(idx, { lit = this.mode === 'highlight' } = {}) {
    const onTap = () => this.replay();
    if (this.mode === 'ghost' && idx >= 0) return ui.bubble({ big: showLetter(this.word[idx]), pic: idx === 0 ? '🚂' : '', onTap });
    const done = this.placed.filter((p) => p.mine).map((p) => p.idx); // (missing: the letters she put on)
    ui.bubble({ word: [...this.word].map(showLetter).join(''), at: lit ? idx : -1, done, onTap });
  }

  /** The wagons still empty, left to right. */
  open() { return this.fill.filter((i) => !this.placed.some((p) => p.idx === i)); }

  round(r) {
    return new Promise((resolve) => {
      const idx = this.open()[0];
      const target = this.word[idx];
      let solved = false;
      this.last = target;
      const right = () => this.blocks.find((x) => x.userData.letter === target);
      const ghostOn = () => { // its letter appears on the wagon
        if (this.ghosts[idx]) return;
        const g = (this.ghosts[idx] = this.makeGhost(idx));
        const off = this.onUpdate((dt, t) => { if (!g.parent) off(); else g.userData.tick(dt, t); }); // made after the scene was collected
        sfx.pop();
      };
      const next = { word: T.whichNow(), missing: T.whichMissing() }[this.mode] || T.spellNext(target);
      // the re-asks take turns ("Popatrz na słowo!" / "Która teraz?"), so no line comes three times in a row
      const reask = [{ word: T.lookAtWord(), missing: T.lookAtWord() }[this.mode] || T.findLetter(target), next];
      let asked = 0;
      const hooks = {
        short: () => reask[asked++ % 2],
        hint: () => {
          if (this.mode !== 'ghost') this.bubbleFor(idx, { lit: true }); // the letter lights up in the word
          if (this.mode === 'word') return T.spellNext(target);
          ghostOn();
          return this.mode === 'missing' || !WORDS[target] ? T.findLetter(target) : T.letterLike(target);
        },
        simplify: () => { // an extra letter (not in the word) leaves, keeping one for the last letter; otherwise the clue
          const later = this.open().slice(1).map((i) => this.word[i]);
          const spare = this.blocks.filter((x) => x.userData.letter && x.userData.letter !== target && !later.includes(x.userData.letter) && x.parent);
          const extra = spare.length > 1 || r === this.rounds - 1 ? spare[0] : null;
          if (!extra) return hooks.hint();
          this.removeOption(extra);
          extra.userData.letter = null;
        },
        reveal: () => { const b = right(); if (b) this.hint(b, () => solved); },
      };
      // blocks she can pick from, per right answer (missing: every open gap's letter is right)
      const options = () => this.blocks.filter((x) => x.userData.letter).length / (this.mode === 'missing' ? this.open().length : 1);
      this.question('letterVisual', target, hooks, { options: options() });

      const onTap = async (b) => {
        if (solved || !b.userData.letter) return;
        this.poke();
        this.lookAt(b);
        // missing: any missing letter is right (she was asked which ones are missing), it goes to its own gap
        const into = b.userData.letter === target ? idx : this.mode === 'missing' ? this.open().find((i) => this.word[i] === b.userData.letter) : undefined;
        if (into === undefined) { this.wrong(b.userData.letter, { obj: b, said: this.lookalikeNo(target, b.userData.letter) }); return; }
        solved = true;
        const letter = b.userData.letter;
        if (into !== idx) this.learn.retarget(letter); // (a wrong tap or help before still counts)
        this.correct(letter);
        this.stopIdle();
        this.untap(b);
        b.userData.letter = null;
        sfx.good();
        const slot = this.train.localToWorld(this.train.userData.slots[into].clone());
        b.rotation.set(0, 0, 0);
        this.lookAt(slot);
        const s0 = b.scale.x;
        // The wagon is taken now and the next letter is asked at once, while this block is still in the air: she
        // need not wait for the hop to tap the next one.
        this.placed.push({ block: b, letter, idx: into, mine: true });
        if (this.ghosts[into]) this.ghosts[into].visible = false;
        const next = this.open()[0] ?? -1;
        this.glowAt(next);
        if (this.mode !== 'ghost') this.bubbleFor(next);
        this.talk = say([...this.yes(), ...T.letter(letter)]); // the next letter can be tapped while it is said
        const landed = Promise.all([this.jumpTo(b, slot, { height: 2, ms: 650 }), animate(650, (t) => b.scale.setScalar(s0 + (1 - s0) * t))]).then(() => {
          if (!this.alive) return;
          this.train.attach(b); // (it rides with the train from now on)
          sfx.boing();
          this.success(slot.clone().add(new THREE.Vector3(0, 0.8, 0)));
        });
        if (next < 0) { await landed; await this.talk; } // (the word is done: the ending waits for the last block and the voice)
        resolve();
      };
      this.blocks.forEach((b) => { if (b.userData.letter) this.tappable(b, onTap); });

      this.glowAt(idx);
      this.bubbleFor(idx);
      wait(r === 0 ? 1200 : 200).then(() => {
        if (!this.alive) return;
        const first = { word: T.wordStart(this.word), missing: T.missingAsk(this.word, this.fill.length) }[this.mode] || T.spellStart(this.word);
        this.askAfter(this.talk, r === 0 ? first : next);
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
  /** Her name: she hops towards the train and cheers, sparkles all round. */
  async girlCheers() {
    const to = this.girl.position.clone().add(new THREE.Vector3(0.8, 0, -0.4));
    this.walking = true;
    await this.jumpTo(this.girl, to, { height: 0.9, ms: 520 });
    this.walking = false;
    this.cheer(2.5);
    this.girl.userData.setHappy(3);
    sparkle(this, to.clone().add(new THREE.Vector3(0, 1.8, 0)), { count: 22 });
  }

  /** The word in syllables, the way Polish reading starts: each one a toot, a bounce and its blocks hopping. */
  async clapSyllables() {
    const syllables = this.L.syllables[this.word];
    const blocks = [...this.placed].sort((a, b) => a.idx - b.idx).map((p) => p.block);
    // the bubble shows the word with a little space between syllables, each turning green as it is said
    const shown = syllables.map((s) => [...s].map(showLetter).join('')).join(' ');
    const done = [];
    let at = 0;
    for (const [k, s] of syllables.entries()) {
      if (!this.alive) return;
      const letters = [...s].map((_, j) => at + j);
      letters.forEach((i) => done.push(i + k)); // (+k: the spaces before this syllable)
      at += s.length;
      ui.bubble({ word: shown, done: [...done], onTap: () => {} });
      sfx.whistle();
      letters.forEach((i) => hop(blocks[i], 0.55, 380));
      hop(this.pup, 0.45, 340);
      this.pup.userData.setHappy(0.6);
      this.cheer(0.5);
      await wait(250);
      await say(T.syllable(s));
    }
  }

  async outro() {
    await wait(300);
    this.glowAt(-1);
    await this.clapSyllables();
    if (!this.alive) return;
    // …then the whole word
    const whose = this.L.whose[this.word];
    const picture = PICTURES[this.word] || (this.word === NAME ? NAME_PICTURE : whose ? HEART : null);
    const all = [...this.word].map((_, i) => i);
    ui.bubble({ word: [...this.word].map(showLetter).join(''), done: all, pic: picture?.pic || '', onTap: () => {} });
    this.placed.forEach(({ block }) => hop(block, 0.35, 420));
    this.success(null, { big: true });
    await say([...T.spellWord(this.word), this.praise()]);
    if (!this.alive) return;
    ui.hideBubble(); // (the picture rises where the bubble was)
    if (picture) {
      picture.show(this);
      await say(T.wordPicture(this.word, whose));
      if (!this.alive) return;
    }
    this.ghosts.forEach((g) => g.removeFromParent());
    await driveOff(this);
  }
}

/** A canvas texture of w × h px, drawn by draw(context, w, h). */
function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const FONT = '"Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif';
const EMOJI = '"Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';
const shownSyllable = (s) => [...s].map(showLetter).join('');

/** A syllable as it is written on a block (on the block's colour, bg) or faintly on a wagon (no bg). */
function syllableFace(s, { bg = null, fg = '#ffffff', stroke = 'rgba(0,0,0,0.25)' } = {}) {
  return canvasTexture(448, 336, (c, w, h) => {
    if (bg) { c.fillStyle = bg; c.beginPath(); c.roundRect(0, 0, w, h, 44); c.fill(); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 200px ${FONT}`;
    c.lineJoin = 'round'; c.lineWidth = 16; c.strokeStyle = stroke;
    c.strokeText(shownSyllable(s), w / 2, h * 0.55);
    c.fillStyle = fg;
    c.fillText(shownSyllable(s), w / 2, h * 0.55);
  });
}

/** The word card: the word's picture over a box per syllable, empty, or with the syllables written in (the example). */
function cardFace(word, parts, shown) {
  return canvasTexture(512, 512, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.strokeStyle = '#93c5fd'; c.lineWidth = 18;
    c.beginPath(); c.roundRect(9, 9, w - 18, h - 18, 56); c.fill(); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `210px ${EMOJI}`;
    c.fillText(WORD_PICS[word] || '', w / 2, h * 0.33);
    const box = (w - 60) / parts.length - 24;
    parts.forEach((s, i) => {
      const x = 30 + 12 + i * (box + 24);
      c.fillStyle = '#eff6ff'; c.strokeStyle = '#bfdbfe'; c.lineWidth = 8;
      c.beginPath(); c.roundRect(x, h * 0.62, box, h * 0.28, 24); c.fill(); c.stroke();
      if (!shown) return;
      c.fillStyle = '#1d4ed8';
      c.font = `700 ${Math.round(h * 0.2)}px ${FONT}`;
      c.fillText(shownSyllable(s), x + box / 2, h * 0.775);
    });
  });
}

/**
 * The syllable train (GAME.md levels 10 to 12): she builds MAMA, TATA and LALA from whole syllables, one word a round.
 * Each block she can tap is a wagon of levels/train.js ({ syllable, slot }), and it fits the next empty wagon by its text
 * only. Every wagon she fills is one question, recorded as the mode's skill (SYLLABLE_TASKS) with its syllable as the item.
 */
class SyllableTrain extends Mission {
  constructor(game) {
    super(game, 'name');
    this.mode = this.L.mode;
    this.task = SYLLABLE_TASKS[this.mode];
    this.order = shuffle(this.L.words);
    this.rounds = this.order.length;
    this.pool = [...new Set(this.L.words.flatMap((w) => this.L.syllables[w]))];
    this.cars = Math.max(...this.L.words.map((w) => this.L.syllables[w].length));
    // one row of blocks in front of the train; on a portrait iPad they come a little nearer, as the letter blocks do
    const n = this.cars - this.task.leave + this.L.extras;
    const size = camera.aspect < 1 ? 1.12 : 1;
    const half = ((n - 1) * SYL_GAP + SYL_W * size) / 2;
    this.layout = { size, front: 2.3, heroX: half + 1.6, heroZ: 2.5 };
    this.span = 1.9 + this.cars * STEP;
    this.trainX = -(this.span / 2 - 1.1);
    this.cardX = this.trainX + 1.9 + (this.cars - 1) * STEP + 2;
    const minWidth = Math.max(14, (this.cardX + 1) * 2, ((this.layout.heroX + 1) * 2) / 0.8);
    this.view = { pos: new THREE.Vector3(0, 6.2, 11.5), look: new THREE.Vector3(0, 1.4, 0.3), minWidth };
    this.post = { tilt: 0.35, focus: 0.42, band: 0.3 };
    this.blocks = [];
    this.ghosts = [];
    this.cards = new Map(); // (the card's two faces per word, made once)
  }

  build() {
    buildStation(this, [-1.5]);
    this.train = trainAt(this.cars, this.trainX, -1.5);
    this.scene.add(this.train);
    this.trainSpeed = 0;
    this.onUpdate((dt, t) => this.train.userData.update(t, this.trainSpeed));
    const { heroX, heroZ } = this.layout;
    this.addHeroes(new THREE.Vector3(-heroX, 0, heroZ), 0.5, new THREE.Vector3(heroX, 0, heroZ), -0.5);
    if (!this.task.example) this.card = this.makeCard();
  }

  /** The word card on a post past the train's last wagon: a tap brings back the example (showExample). */
  makeCard() {
    const card = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
    face.position.set(0, 2.3, 0.06);
    card.add(face, mesh(rbox(1.94, 1.94, 0.1, 0.06), mat('#e2e8f0'), { y: 2.3 }), mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), mat('#64748b'), { y: 0.7, z: -0.06 }));
    card.position.set(this.cardX, 0, -2.4);
    card.userData.face = face;
    card.userData.tapHeight = 2.3;
    this.scene.add(card);
    this.tappable(card, () => this.showExample());
    return card;
  }
  /** The card shows the round's word: its picture, and the syllables when the example is on. */
  cardFor(shown) {
    if (!this.card) return;
    const key = `${this.word}|${shown}`;
    if (!this.cards.has(key)) this.cards.set(key, cardFace(this.word, this.parts, shown));
    this.card.userData.face.material.map = this.cards.get(key);
    this.card.userData.face.material.needsUpdate = true;
  }

  /** Where a block sits on wagon i (a syllable block is lower than a letter block). */
  slotPoint(i) {
    this.train.updateMatrixWorld(true);
    return this.train.localToWorld(this.train.userData.slots[i].clone()).add(new THREE.Vector3(0, (SYL_H - 1.25) / 2, 0));
  }

  /** A syllable block for wagon w: on its wagon when it arrives loaded, else the i-th of n on the grass. It pops up in place. */
  makeBlock(w, color, i, n) {
    const { size, front } = this.layout;
    const b = new THREE.Mesh(rbox(SYL_W, SYL_H, 1, 0.14), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(SYL_W * 0.94, SYL_H * 0.9), new THREE.MeshStandardMaterial({ map: syllableFace(w.syllable, { bg: color }), roughness: 0.45 }));
    face.position.z = 0.505;
    b.add(face);
    b.castShadow = b.receiveShadow = true;
    b.userData.wagon = w;
    this.scene.add(b);
    if (w.slot !== null) {
      b.position.copy(this.slotPoint(w.slot));
      this.train.attach(b);
    } else {
      b.scale.setScalar(size);
      b.position.set((i - (n - 1) / 2) * SYL_GAP, (SYL_H / 2) * size, front + (i % 2) * 0.45);
      b.rotation.y = (Math.random() - 0.5) * 0.24;
      b.userData.home = b.position.clone();
      b.userData.choice = w.syllable; // (what the play tools read as this option)
      b.userData.tapHeight = 0;
      this.shadowUnder(b, 0.95, 0.3);
    }
    const s = b.scale.x;
    b.scale.setScalar(0.001);
    wait(i * 90).then(() => animate(320, (t) => b.scale.setScalar(Math.max(0.001, s * t)), ease.out)).then(() => { if (this.alive && b.parent) sfx.pop(); });
    return b;
  }

  /** The example on the train: each empty wagon shows its syllable faintly. */
  ghostsOn() {
    this.parts.forEach((s, i) => {
      if (this.ghosts[i] || this.wagons.some((w) => w.slot === i)) return;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.98), new THREE.MeshBasicMaterial({ map: syllableFace(s, { fg: '#9fb8f5', stroke: 'rgba(255,255,255,0.95)' }), transparent: true, opacity: 0.95, depthWrite: false }));
      const at = this.slotPoint(i).add(new THREE.Vector3(0, -0.15, 0.55));
      g.position.copy(at);
      const off = this.onUpdate((dt, t) => { if (!g.parent) off(); else g.position.y = at.y + Math.sin(t * 2.5 + i) * 0.05; });
      this.scene.add(g);
      this.ghosts[i] = g;
    });
  }

  /** The bubble: the word in pieces while the example shows (the pieces on the train done), and who or what it is. */
  bubbleFor({ built = false } = {}) {
    const pic = built || !this.task.example ? WORD_PICS[this.word] || '' : '';
    if (!built && !this.example) return ui.bubble({ pic, onTap: () => this.replay() });
    const done = [];
    let at = 0;
    this.parts.forEach((s, i) => {
      if (built || this.wagons.some((w) => w.slot === i)) for (let j = 0; j < s.length; j++) done.push(at + j);
      at += s.length + 1; // (and the space after it)
    });
    ui.bubble({ word: this.parts.map(shownSyllable).join(' '), done, pic, onTap: built ? () => {} : () => this.replay() }); // (a plain space is lost between the bubble's letters)
  }

  /** A syllable she could copy from the screen as she answers: the example, or the same piece on the train (`match` is matching by design). */
  copyable(target) {
    return !this.task.example && (this.example || this.wagons.some((w) => w.slot !== null && w.syllable === target));
  }

  round(r) {
    return new Promise((resolve) => {
      if (r > 0) this.clearWord();
      this.word = this.order[r];
      this.parts = this.L.syllables[this.word];
      this.example = this.task.example;
      this.wagons = syllableWagons(this.parts, { leave: this.task.leave, extras: this.L.extras, pool: this.pool });
      const waiting = this.wagons.filter((w) => w.slot === null);
      const colors = shuffle(TILE_COLORS);
      this.blocks = this.wagons.map((w, i) => this.makeBlock(w, colors[i % colors.length], w.slot === null ? waiting.indexOf(w) : i, waiting.length));
      if (this.example) this.ghostsOn();
      this.cardFor(false);
      this.askNext(resolve, r, true);
    });
  }

  /** One question: the next empty wagon. A right block takes it at the tap, and the next one is asked at once. */
  askNext(resolve, r, first) {
    const { word, parts } = this;
    const slot = nextSlot(parts, this.wagons), target = parts[slot];
    const row = SYLLABLE_ROWS[this.mode];
    const line = () => (this.example && !this.task.example ? SYLLABLE_ROWS.match.next(word, target) : first ? row.ask(word, target) : row.next(word, target, parts[slot - 1]));
    const waiting = () => this.blocks.filter((b) => b.userData.choice && b.parent);
    const needed = () => parts.filter((_, i) => !this.wagons.some((w) => w.slot === i));
    let solved = false;
    this.last = target;
    const hooks = {
      short: line,
      hint: () => { // the example's faint syllable pulses; without it the word is said in its syllables, so she still finds the piece
        if (this.example) { if (this.ghosts[slot]) this.pulseUntil(this.ghosts[slot], () => solved); return T.syllable(target); }
        this.blocks.filter((b) => b.userData.wagon.slot !== null).forEach((b) => hop(b, 0.3, 380));
        return parts.flatMap((s) => T.syllable(s));
      },
      simplify: () => { // a block no empty wagon wants leaves
        const spare = waiting().find((b) => !needed().includes(b.userData.choice));
        if (!spare) return hooks.hint();
        this.removeOption(spare);
        delete spare.userData.choice;
      },
      reveal: () => { const b = waiting().find((x) => x.userData.choice === target); if (b) this.hint(b, () => solved); },
    };
    const options = waiting().length / Math.max(1, waiting().filter((b) => b.userData.choice === target).length);
    this.question(this.task.skill, target, hooks, { options });
    if (this.copyable(target)) this.learn.answerOnScreen();

    const onTap = (b) => {
      if (solved || !b.userData.choice || b.userData.trying) return;
      this.poke();
      this.lookAt(b);
      const w = b.userData.wagon;
      if (couple(parts, this.wagons, w) < 0) {
        this.swapOut(b, slot);
        this.wrong(w.syllable, { said: [...T.syllable(w.syllable), ...T.no()], quiet: true }); // (swapOut sounds the "no" at the wagon)
        return;
      }
      solved = true;
      this.correct(w.syllable);
      this.stopIdle();
      this.untap(b);
      delete b.userData.choice;
      sfx.good();
      const at = this.slotPoint(w.slot);
      b.rotation.set(0, 0, 0);
      this.lookAt(at);
      if (this.ghosts[w.slot]) this.ghosts[w.slot].visible = false;
      const s0 = b.scale.x;
      const built = nextSlot(parts, this.wagons) < 0;
      if (built) sfx.yes();
      this.talk = say([...(built ? [] : this.yes()), ...T.syllable(w.syllable)]); // its whole syllable: "Tak! Ma!", the last one "Ma!" before "Mama!"
      const landed = Promise.all([this.jumpTo(b, at, { height: 2, ms: 650 }), animate(650, (t) => b.scale.setScalar(s0 + (1 - s0) * t))]).then(() => {
        if (!this.alive) return;
        this.train.attach(b);
        sfx.boing();
        this.success(at.clone().add(new THREE.Vector3(0, 0.8, 0)));
      });
      if (!built) { this.askNext(resolve, r, false); return; }
      landed.then(() => this.talk).then(() => (this.alive ? this.joined() : undefined)).then(resolve);
    };
    this.blocks.forEach((b) => { if (b.userData.choice) this.tappable(b, onTap); });

    this.bubbleFor();
    (first && r === 0 ? wait(900) : Promise.resolve()).then(() => { if (this.alive) this.askAfter(this.talk, line()); });
  }

  /** A wrong block tries the empty wagon, shakes its head there and hops back to the grass: what is on the train stays. */
  async swapOut(b, slot) {
    b.userData.trying = true;
    sfx.pop();
    await this.jumpTo(b, this.slotPoint(slot).add(new THREE.Vector3(0, 0.45, 0.25)), { height: 1.1, ms: 380 });
    if (!this.alive) return;
    sfx.no();
    if (this.pup) shakeNo(this.pup, { amp: 0.6 });
    await shakeNo(b);
    if (!this.alive) return;
    await this.jumpTo(b, b.userData.home, { height: 0.9, ms: 380 });
    b.userData.trying = false;
  }

  /** The card, mid-question: the example comes back (the syllables on the card, faint on the empty wagons, in the bubble). Nothing restarts. */
  showExample() {
    if (this.example || !this.aid) return; // (nothing to show now: the tap gets its tick)
    this.example = true;
    this.cardFor(true);
    this.ghostsOn();
    this.bubbleFor();
    sfx.pop();
    hop(this.card, 0.25, 380);
    this.learn.answerOnScreen();
    this.helped(2);
    this.poke();
    this.ask([...T.lookAtWord(), ...SYLLABLE_ROWS.match.next(this.word, this.last)]);
  }

  /** The word is built: its blocks hop, the bubble shows who or what it is, the voice says it, then the kiss. */
  joined() {
    const { word } = this, whose = this.L.whose[word];
    this.blocks.filter((b) => b.userData.wagon.slot !== null && b.parent).forEach((b) => hop(b, 0.35, 420));
    this.bubbleFor({ built: true });
    this.success(null, { big: true });
    sfx.toot();
    if (whose) floatHeart(this);
    const name = say(T.spellWord(word));
    this.talk = name.then(() => (this.alive ? say(T.wordPicture(word, whose)) : undefined));
    return name;
  }

  /** The built word leaves the train before the next one: its blocks shrink away, and the faint syllables go. */
  clearWord() {
    for (const b of this.blocks) { this.untap(b); delete b.userData.choice; this.shrinkAway(b, 300); }
    this.ghosts.forEach((g) => g?.removeFromParent());
    this.ghosts = [];
  }

  async outro() {
    await wait(300);
    if (!this.alive) return;
    this.ghosts.forEach((g) => g?.removeFromParent());
    await driveOff(this);
  }
}

/** A white name board ("ZOSIA") as a canvas texture, w × h world units. */
function boardTexture(word, w, h) {
  const px = 160;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * px); cv.height = Math.round(h * px);
  const c = cv.getContext('2d');
  const r = 0.16 * px;
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#93c5fd';
  c.lineWidth = 0.08 * px;
  c.beginPath();
  c.roundRect(c.lineWidth / 2, c.lineWidth / 2, cv.width - c.lineWidth, cv.height - c.lineWidth, r);
  c.fill(); c.stroke();
  c.fillStyle = '#1d4ed8';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${Math.round(0.86 * px)}px "Fredoka", "Arial Rounded MT Bold", "Helvetica Neue", Arial, sans-serif`;
  c.fillText([...word].map(showLetter).join(''), cv.width / 2, cv.height * 0.54);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const boardWidth = (word) => 0.68 * word.length + 0.6;
const carsFor = (word) => Math.ceil((boardWidth(word) + 0.2) / STEP);

/**
 * "Który pociąg jest Zosi?": three trains roll in with name boards, one per track; she taps the one asked for.
 * Her own name first, then mama or tata, then a family name (levels/train.js whoseOrder). A miss never gets
 * a "no": the right train just toots.
 */
class WhoseTrain extends Mission {
  constructor(game) {
    super(game, 'name');
    this.mode = 'whose';
    this.rounds = 3;
    this.order = whoseOrder(this.L.whose, { name: NAME, rounds: this.rounds });
    this.count = this.L.assist ? 2 : 3; // trains each round (a gentler run: two)
    this.tracks = [-4.6, -1.2, 2.2];
    // the boards line up on the left, so the first letters sit one above the other
    const longest = Math.max(...this.L.words.map((w) => 1.9 + carsFor(w) * STEP));
    this.left = -longest / 2;
    this.heroX = longest / 2 + 0.2;
    // (looking at the middle board's height keeps the back board below the speech bubble)
    this.view = { pos: new THREE.Vector3(0, 11.2, 13.7), look: new THREE.Vector3(0, 1.5, -1.2), minWidth: Math.max(15, longest + 3) };
    this.post = { tilt: 0.3, focus: 0.5, band: 0.42 };
    this.trains = [];
  }

  build() {
    buildStation(this, this.tracks);
    this.addHeroes(new THREE.Vector3(-this.heroX, 0, 4), 0.4, new THREE.Vector3(this.heroX, 0, 4), -0.4);
  }

  /** One train with a name board, its engine at x (the left), on track z. */
  makeNameTrain(word, z) {
    const cars = carsFor(word), w = boardWidth(word), h = 1.15;
    const t = trainAt(cars, this.left + 1.1, z);
    const board = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: boardTexture(word, w, h), roughness: 0.6 }));
    face.position.z = 0.06;
    board.add(face, mesh(rbox(w + 0.08, h + 0.08, 0.1, 0.04), mat('#e2e8f0')));
    for (const dx of [-w / 2 + 0.4, w / 2 - 0.4]) board.add(mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), mat('#64748b'), { x: dx, y: -h / 2 - 0.2, z: -0.05 }));
    t.updateMatrixWorld(true);
    board.position.copy(t.localToWorld(new THREE.Vector3(-1.2 - w / 2, 1.45 + h / 2 - 0.55, 0))); // (starts right behind the engine)
    this.scene.add(board);
    t.attach(board);
    mergeSiblings(t);
    t.userData.word = word;
    t.userData.tapHeight = 1.2;
    t.userData.board = board;
    t.userData.speed = 0;
    t.userData.off = this.onUpdate((dt, time) => t.userData.update(time, t.userData.speed));
    this.scene.add(t);
    return t;
  }

  /** The trains roll in from the right, engines first, and stop with their boards lined up. */
  async arrive(words) {
    const tracks = this.tracks.slice(-words.length);
    this.trains = words.map((w, i) => this.makeNameTrain(w, tracks[i]));
    sfx.engine();
    await Promise.all(this.trains.map((t, i) => {
      const x1 = t.position.x, x0 = x1 + 34;
      t.position.x = x0;
      return wait(i * 260).then(() => animate(1700, (k) => { t.position.x = x0 + (x1 - x0) * k; t.userData.speed = 0.3 * (1 - k); }, ease.out));
    }));
    this.trains.forEach((t) => (t.userData.speed = 0));
  }

  /** Off to the left, all of them (or just one, when help takes a wrong one away). */
  leave(trains) {
    return Promise.all(trains.map((t) => {
      this.untap(t);
      const x0 = t.position.x;
      return animate(1800, (k) => { t.position.x = x0 - k * k * 34; t.userData.speed = 0.35 * k; }, ease.linear)
        .then(() => { t.userData.off(); t.removeFromParent(); });
    }));
  }

  /** What a wrong train says about itself: whose it is ("To pociąg mamy!"), or its word when it is a thing (KOT, DOM). */
  whoseIt(word) {
    const whose = this.L.whose[word];
    return whose ? T.whoseIs(whose) : T.spellWord(word);
  }

  /** "Here I am!": the train toots, bounces and puffs, its board grows for a moment. */
  honk(t) {
    sfx.toot();
    hop(t, 0.25, 380);
    const b = t.userData.board;
    animate(700, (k) => b.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.12));
    dust(this, t.position.clone().add(new THREE.Vector3(-0.6, 2.2, 0)), { count: 4, size: 0.3 });
  }

  round(r) {
    return new Promise((resolve) => {
      const asked = this.order[r];
      const whose = this.L.whose[asked];
      this.last = asked;
      ui.bubble({ big: '?', pic: '🚂', onTap: () => this.replay() });
      this.arrive(whoseTrains(this.L.words, asked, this.count - 1)).then(() => {
        if (!this.alive) return;
        let solved = false;
        const right = () => this.trains.find((t) => t.userData.word === asked);
        this.question('wordVisual', asked, {
          short: T.whoseAsk(whose),
          hint: () => { ui.bubble({ word: [...asked].map(showLetter).join(''), onTap: () => this.replay() }); ui.nudgeBubble(); return T.whoseAsk(whose); }, // the name in the bubble (now she can match it); after a wrong train, whose that was comes first
          simplify: () => { const t = this.trains.find((x) => x.userData.word !== asked && x.parent && x.userData.onTap); if (t && this.trains.filter((x) => x.userData.onTap).length > 2) this.leave([t]); },
          reveal: () => { this.hint(right(), () => solved, right().userData.board); return T.whoseIs(whose); },
        }, { options: this.trains.length });

        const onTap = async (t) => {
          if (solved) return;
          this.poke();
          this.lookAt(t.userData.board);
          if (t.userData.word !== asked) { this.wrong(t.userData.word, { obj: t, said: this.whoseIt(t.userData.word) }); return; }
          solved = true;
          this.correct(asked);
          this.stopIdle();
          sfx.good();
          this.honk(t);
          this.success(t.userData.board.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0.3)));
          if (asked === NAME) { this.cheer(2); this.girl.userData.setHappy(3); hop(this.girl, 0.5); }
          ui.bubble({ word: [...asked].map(showLetter).join(''), done: [...asked].map((_, i) => i), onTap: () => {} });
          this.talk = this.say([...this.yes(), ...T.whoseIs(whose)]);
          await wait(400);
          if (!this.alive) return;
          this.leave(this.trains.filter((x) => x.parent)); // (off to the left as the next ones roll in from the right)
          resolve();
        };
        this.trains.forEach((t) => this.tappable(t, onTap));
        this.askAfter(this.talk, r === 0 ? [...T.trainsCame(), ...T.whoseAsk(whose)] : T.whoseAsk(whose));
      });
    });
  }
}
