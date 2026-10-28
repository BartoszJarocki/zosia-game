import * as THREE from 'three';
import { animate, ease, hop, wait } from '../engine.js';
import { makeKitten, rbox } from '../models.js';
import { makeBush } from '../world/nature.js';
import { makeFence, makeBench, makeLamp } from '../world/props.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { letterWord, showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { distractors } from '../levels.js';
import { Mission } from './mission.js';

// "Kitty Park": a kitten hides behind one of the letter blocks. Each level asks in a different way
// (GAME.md "ask"), so the letter is met as a shape, a name, a word and a sound — not just more blocks:
//   match  the letter is shown: "find the same one" (no name)       → letterVisual
//   name   the letter is shown and named: "Znajdź Be!"               → letterVisual
//   audio  only named (nothing shown)                               → letterAudio
//   word   named with its picture word: "Be jak banan! Znajdź Be!"  → letterAudio
//   sound  its sound: "Która literka robi: mmmm?"                   → letterSound
const SKILL = { match: 'letterVisual', name: 'letterVisual', audio: 'letterAudio', word: 'letterAudio', sound: 'letterSound' };
const FUR = ['#fb923c', '#9ca3af', '#f5f5f4', '#57534e', '#fbbf24'];
export class LettersMission extends Mission {
  constructor(game) {
    super(game, 'letters');
    this.view = { pos: new THREE.Vector3(0, 4.6, 12), look: new THREE.Vector3(0, 1.5, 0), minWidth: 14 };
    this.post = { tilt: 0.4, focus: 0.4, band: 0.3 };
    this.saved = []; // the kittens she found: they sit in a row at the front, and play together at the end
    this.seats = this.rounds;
  }

  /** Where the i-th kitten she finds sits: a row in front of the blocks, between Zosia and Chase. */
  seat(i) {
    const gap = Math.min(1.3, 7 / this.seats);
    return new THREE.Vector3((i - (this.seats - 1) / 2) * gap, 0, 3.6);
  }

  /** The found kitten hops over to its seat in the row (while the right answer is praised). */
  async toSeat(kitten) {
    await wait(650);
    if (!this.alive) return;
    const to = this.seat(this.saved.length);
    this.saved.push(kitten);
    kitten.rotation.y = Math.atan2(to.x - kitten.position.x, to.z - kitten.position.z);
    const s0 = kitten.scale.x;
    await Promise.all([
      this.jumpTo(kitten, to, { height: 1, ms: 600 }),
      animate(600, (t) => kitten.scale.setScalar(s0 + (1 - s0) * t)),
    ]);
    animate(300, (t) => { kitten.rotation.y *= 1 - t; });
  }

  /** Everyone she found comes out to play: they chase each other round in a ring, hopping. */
  async outro() {
    const from = this.saved.map((k) => k.position.clone());
    const t0 = performance.now() / 1000;
    this.onUpdate((dt, t) => {
      const k = Math.min(1, (performance.now() / 1000 - t0) / 0.8);
      this.saved.forEach((kit, i) => {
        const a = (i / this.saved.length) * Math.PI * 2 + t * 0.9;
        const ring = new THREE.Vector3(Math.cos(a) * 1.7, 0, 1.2 + Math.sin(a) * 1.1);
        kit.position.lerpVectors(from[i], ring, k);
        kit.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.3 * k;
        kit.rotation.y = k < 1 ? Math.atan2(ring.x - from[i].x, ring.z - from[i].z) : Math.atan2(-1.7 * Math.sin(a), 1.1 * Math.cos(a)); // (facing the way round)
      });
    });
    setTimeout(() => sfx.meow(), 300);
    await wait(900);
  }
  doneLine() { return T.kittensPlay(); }

  build() {
    this.meadow({ clear: [[0, 0, 8]] });
    this.addHeroes(new THREE.Vector3(-5.4, 0, 1.6), 0.55, new THREE.Vector3(5.4, 0, 1.3), -0.55);
    // the park: picket fence, flowering bushes, benches, lamps
    const fence = makeFence(18);
    fence.position.set(0, 0, -4.6);
    this.scene.add(fence);
    for (let i = 0; i < 7; i++) {
      const b = makeBush({ scale: 0.9 + Math.random() * 0.4, seed: i * 7 });
      b.position.set(-7.5 + i * 2.5, 0, -3.8 - Math.random() * 0.4);
      this.scene.add(b);
    }
    for (const [x, z, ry] of [[-8.2, -1.8, 0.7], [8.2, -1.8, -0.7]]) {
      const bench = makeBench();
      bench.position.set(x, 0, z);
      bench.rotation.y = ry;
      this.scene.add(bench);
    }
    for (const x of [-6.8, 6.8]) { const l = makeLamp(); l.position.set(x, 0, -3.2); this.scene.add(l); }
    this.onUpdate((dt, t) => this.saved.forEach((k, i) => k.userData.idle(t + i * 0.7)));
  }

  round(r) {
    return new Promise((resolve) => {
      const pool = [...this.L.pool];
      const ask = this.L.ask || 'name';
      const skill = SKILL[ask];
      const target = this.pick(skill, pool);
      this.last = target;
      const n = Math.min(this.L.choices, pool.length);
      const opts = shuffle([target, ...distractors(target, pool, n - 1, this.L.similar)]);
      const colors = shuffle(TILE_COLORS);
      const emoji = letterWord(target)[1];
      const gap = n > 3 ? 2.55 : 2.8;
      const blocks = [];
      let solved = false, lastWrong = null;

      const kitten = makeKitten(FUR[this.saved.length % FUR.length]);
      kitten.visible = false;
      this.scene.add(kitten);
      this.shadowUnder(kitten, 0.45, 0.3);
      const offKitten = this.onUpdate((dt, t) => kitten.userData.idle(t));

      opts.forEach((letter, i) => {
        const m = new THREE.MeshStandardMaterial({ map: glyphTexture(showLetter(letter), { bg: colors[i] }), roughness: 0.45 });
        const b = new THREE.Mesh(rbox(2, 2, 2, 0.22), m);
        b.castShadow = b.receiveShadow = true;
        b.position.x = (i - (n - 1) / 2) * gap;
        b.rotation.y = (Math.random() - 0.5) * 0.3;
        b.userData.tapHeight = 0;
        b.userData.letter = letter;
        this.scene.add(b);
        blocks.push(b);
        this.shadowUnder(b, 1.35, 0.3);
        this.dropIn(b, 1, i * 120).then(() => sfx.pop());
        if (letter === target) kitten.position.set(b.position.x, 0, b.position.z - 0.2);

        this.tappable(b, async () => {
          if (solved) return;
          this.poke();
          this.lookAt(b);
          if (letter === target) {
            solved = true;
            this.correct(letter);
            this.stopIdle();
            blocks.forEach((x) => this.untap(x));
            sfx.good();
            // block flies up, kitty appears
            kitten.position.set(b.position.x, 0, b.position.z - 0.2);
            kitten.rotation.y = 0;
            const y0 = b.position.y;
            animate(700, (t) => {
              b.position.y = y0 + t * 5;
              b.rotation.y += 0.25;
              b.scale.setScalar(Math.max(0.001, 1 - t));
            }, ease.in);
            kitten.visible = true;
            kitten.scale.setScalar(0.001);
            animate(600, (t) => kitten.scale.setScalar(0.001 + t * 1.3), ease.back);
            setTimeout(() => sfx.meow(), 250);
            this.success(new THREE.Vector3(b.position.x, 1.6, b.position.z), { big: true });
            this.lookAt(kitten);
            blocks.filter((x) => x !== b && x.parent).forEach((x) => this.shrinkAway(x, 500));
            // the first time: "Znalazłaś kotka! Es jak ser!"; then shorter, so she gets the next one sooner
            const said = r === 0 ? T.kittyFound(target) : ask === 'sound' ? [] : T.letterLike(target);
            await Promise.all([say([this.praise(), ...(ask === 'sound' ? T.soundIs(target) : []), ...said]), this.toSeat(kitten)]);
            if (!this.alive) return;
            offKitten();
            b.removeFromParent();
            resolve();
          } else {
            lastWrong = b;
            this.wrong(letter, { obj: b, said: this.lookalikeNo(target, letter) });
          }
        });
      });

      // what the speech bubble shows: the letter (match, name), its picture (word), or just a clue icon
      const letter = showLetter(target);
      const bubble = (big, pic) => ui.bubble({ big, pic, onTap: () => this.replay() });
      const show = { match: [letter, ''], name: [letter, ''], audio: ['', '🐱'], word: ['', emoji], sound: ['', '🐱'] }[ask]; // (👂 is U's picture)
      bubble(...show);
      const right = blocks.find((x) => x.userData.letter === target);
      // the story ("Kotek się schował!") the first time; after that just the question
      const hid = r === 0 ? T.kittyHid() : [];
      const prompt = {
        match: r === 0 ? T.kittyMatch() : T.findSame(),
        name: [...hid, ...T.findLetter(target)],
        audio: [...hid, ...T.findLetter(target)],
        word: [...hid, ...T.letterLike(target), ...T.findLetter(target)],
        sound: [...hid, ...T.whichSound(target)],
      }[ask];
      this.question(skill, target, {
        short: ask === 'match' ? T.findSame() : ask === 'sound' ? T.whichSound(target) : T.whereLetter(target),
        // a clue that fits how it was asked: its word (and the letter itself when it wasn't shown)
        hint: () => {
          if (ask === 'sound') { bubble('', emoji); return T.soundLike(target); }
          if (ask === 'audio' || ask === 'word') bubble(letter, emoji);
          return T.letterLike(target);
        },
        simplify: () => this.removeOption(lastWrong || blocks.find((x) => x !== right && x.parent)),
        // the answer: that block pulses and the kitten's tail peeks out from behind it, wagging
        reveal: () => {
          this.hint(right, () => solved);
          kitten.position.set(right.position.x + 0.8, 0, right.position.z - 0.75);
          kitten.rotation.y = -Math.PI / 2;
          kitten.visible = true;
        },
      });
      wait(500).then(() => {
        if (this.alive) this.ask(prompt);
      });
    });
  }
}
