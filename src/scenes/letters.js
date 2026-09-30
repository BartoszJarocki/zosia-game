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
import { pickTarget } from '../progress.js';
import { Mission } from './mission.js';

// "Kitty Park": a kitten hides behind one of the letter blocks.
//  L1 match the letter shown · L2 more letters · L3 only hear it (picture clue), 4 blocks incl. lookalikes.
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
      const target = pickTarget(pool, 'L:', this.last);
      this.last = target;
      this.item('L:' + target);
      const n = Math.min(this.L.choices, pool.length);
      const opts = shuffle([target, ...distractors(target, pool, n - 1, this.L.similar)]);
      const colors = shuffle(TILE_COLORS);
      const emoji = (WORDS[target] || [])[1] || '';
      const gap = n > 3 ? 2.55 : 2.8;
      const blocks = [];
      let wrong = 0;
      let solved = false;

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
            blocks.filter((x) => x !== b).forEach((x) => this.shrinkAway(x, 500));
            await say([this.praise(), ...T.kittyFound(target)]);
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
            wrong++;
            this.miss();
            sfx.oops();
            wiggle(b);
            say([...T.thatsLetter(letter), ...T.whereLetter(target)]);
            if (wrong >= 2) this.hint(blocks.find((x) => x.userData.letter === target), () => solved);
          }
        });
      });

      ui.bubble({
        big: this.L.show === 'letter' ? showLetter(target) : '',
        pic: emoji,
        onTap: () => this.ask(this.prompt),
      });
      wait(500).then(() => {
        if (this.alive) this.ask(T.kittyAsk(target));
      });
    });
  }
}
