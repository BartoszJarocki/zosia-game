import * as THREE from 'three';
import { animate, ease, wiggle, hop, wait } from '../engine.js';
import { makeKitten, rbox } from '../models.js';
import { makeBush } from '../world/nature.js';
import { makeFence, makeBench, makeLamp } from '../world/props.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { WORDS, showLetter } from '../config.js';
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
export class LettersMission extends Mission {
  constructor(game) {
    super(game, 'letters');
    this.view = { pos: new THREE.Vector3(0, 4.6, 12), look: new THREE.Vector3(0, 1.5, 0), minWidth: 14 };
    this.post = { tilt: 0.4, focus: 0.4, band: 0.3 };
  }

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
  }

  round() {
    return new Promise((resolve) => {
      const pool = [...this.L.pool];
      const ask = this.L.ask || 'name';
      const skill = SKILL[ask];
      const target = this.pick(skill, pool);
      this.last = target;
      this.item('L:' + target);
      const n = Math.min(this.L.choices, pool.length);
      const opts = shuffle([target, ...distractors(target, pool, n - 1, this.L.similar)]);
      const colors = shuffle(TILE_COLORS);
      const emoji = (WORDS[target] || [])[1] || '';
      const gap = n > 3 ? 2.55 : 2.8;
      const blocks = [];
      let solved = false, lastWrong = null;

      const kitten = makeKitten();
      kitten.visible = false;
      this.scene.add(kitten);
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
            await say([this.praise(), ...(ask === 'sound' ? T.soundIs(target) : []), ...T.kittyFound(target)]);
            if (!this.alive) return;
            // kitty scampers off
            const side = Math.sign(kitten.position.x || 1);
            const x0 = kitten.position.x;
            kitten.rotation.y = side * Math.PI / 2;
            sfx.whoosh();
            await animate(700, (t) => { kitten.position.x = x0 + side * t * 14; kitten.position.y = Math.abs(Math.sin(t * 12)) * 0.3; }, ease.in);
            kitten.removeFromParent();
            offKitten();
            b.removeFromParent();
            resolve();
          } else {
            lastWrong = b;
            this.wrong(letter, T.thatsLetter(letter));
            sfx.oops();
            wiggle(b);
          }
        });
      });

      // what the speech bubble shows: the letter (match, name), its picture (word), or just a clue icon
      const letter = showLetter(target);
      const bubble = (big, pic) => ui.bubble({ big, pic, onTap: () => this.replay() });
      const show = { match: [letter, ''], name: [letter, ''], audio: ['', '🐱'], word: ['', emoji], sound: ['', '👂'] }[ask];
      bubble(...show);
      const right = blocks.find((x) => x.userData.letter === target);
      const prompt = {
        match: T.kittyMatch(),
        name: [...T.kittyHid(), ...T.findLetter(target)],
        audio: [...T.kittyHid(), ...T.findLetter(target)],
        word: [...T.kittyHid(), ...T.letterLike(target), ...T.findLetter(target)],
        sound: [...T.kittyHid(), ...T.whichSound(target)],
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
        reveal: () => this.hint(right, () => solved),
      });
      wait(500).then(() => {
        if (this.alive) this.ask(prompt);
      });
    });
  }
}
