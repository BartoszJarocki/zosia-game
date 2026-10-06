import * as THREE from 'three';
import { animate, ease, wiggle, hop, wait } from '../engine.js';
import { makeTrain, rbox, mat, mesh } from '../models.js';
import { makePlatform, makeStationHouse, makeLamp } from '../world/props.js';
import { dust } from '../fx/particles.js';
import { glyphTexture, labelTexture, TILE_COLORS } from '../textures.js';
import { CONFIG, showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle, pick } from '../util.js';
import { T } from '../lang/pl.js';
import { distractors } from '../levels.js';
import { ALL_LETTERS } from '../levels/data.js';
import { Mission } from './mission.js';

// "Name Train": load the letters of a word onto the train, in order.
//  L1 her name, ghost letters on the wagons · L2 whole word in the bubble, next letter lit, +1 extra block
//  L3 more words, +2 extras (lookalikes).
export class NameMission extends Mission {
  constructor(game) {
    super(game, 'name');
    this.word = pick(this.L.words).toUpperCase();
    this.rounds = this.word.length;
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
    if (this.L.ghost) {
      this.train.userData.slots.forEach((slot, i) => {
        // a soft white card with a pale blue letter, sitting on the wagon: "this one goes here"
        const g = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: labelTexture(showLetter(this.word[i]), { fg: '#9fb8f5', stroke: 'rgba(255,255,255,0.95)' }), transparent: true, opacity: 0.95, depthWrite: false }));
        this.train.updateMatrixWorld(true);
        g.position.copy(this.train.localToWorld(slot.clone())).add(new THREE.Vector3(0, -0.2, 0.62));
        g.userData.tick = (dt, t) => (g.position.y = 1.25 + Math.sin(t * 2.5 + i) * 0.05);
        this.scene.add(g);
        this.ghosts.push(g);
      });
    }

    const edge = this.view.minWidth / 2;
    this.addHeroes(new THREE.Vector3(-edge + 1.2, 0, 2.6), 0.5, new THREE.Vector3(edge - 1.2, 0, 2.4), -0.5);

    // letter blocks on the grass, shuffled, plus extras at higher levels
    const extras = [];
    for (let i = 0; i < this.L.extras; i++) {
      const base = this.word[i % this.word.length];
      const d = distractors(base, ALL_LETTERS, 3, this.L.similar).find((l) => !this.word.includes(l) && !extras.includes(l));
      if (d) extras.push(d);
    }
    const letters = shuffle([...this.word, ...extras]);
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

  bubbleFor(r) {
    const target = this.word[r];
    if (this.L.bubble === 'word') ui.bubble({ word: [...this.word].map(showLetter).join(''), at: r, onTap: () => this.replay() });
    else ui.bubble({ big: showLetter(target), pic: r === 0 ? '🚂' : '', onTap: () => this.replay() });
  }

  round(r) {
    if (r === 0) this.placed = [];
    return new Promise((resolve) => {
      const target = this.word[r];
      this.item('L:' + target);
      this.question('letterVisual', target);
      let wrong = 0, solved = false;
      this.last = target;

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
          const slot = this.train.localToWorld(this.train.userData.slots[r].clone());
          b.rotation.set(0, 0, 0);
          this.lookAt(slot);
          await this.jumpTo(b, slot, { height: 2, ms: 650 });
          // ride with the train from now on
          this.train.attach(b);
          this.placed.push({ block: b, letter: target });
          sfx.boing();
          this.success(slot.clone().add(new THREE.Vector3(0, 0.8, 0)));
          if (this.ghosts[r]) this.ghosts[r].visible = false;
          if (this.L.bubble === 'word') ui.bubble({ word: [...this.word].map(showLetter).join(''), at: r + 1, onTap: () => this.replay() });
          await say(T.letter(target));
          resolve();
        } else {
          wrong++;
          this.wrong(b.userData.letter);
          sfx.oops();
          wiggle(b);
          say([...T.thatsLetter(b.userData.letter), ...T.findLetter(target)]);
          if (wrong >= 2) {
            const right = this.blocks.find((x) => x.userData.letter === target);
            if (right) this.hint(right, () => solved);
          }
        }
      };
      this.blocks.forEach((b) => { if (b.userData.letter) this.tappable(b, onTap); });

      this.bubbleFor(r);
      wait(r === 0 ? 1200 : 200).then(() => {
        if (!this.alive) return;
        if (r === 0) this.ask(T.spellStart(this.word));
        else this.ask(T.spellNext(target));
      });
    });
  }

  async outro() {
    await wait(300);
    // spell it together, letter by letter
    for (const [i, { block, letter }] of this.placed.entries()) {
      if (!this.alive) return;
      if (this.L.bubble === 'word') ui.bubble({ word: [...this.word].map(showLetter).join(''), at: i, onTap: () => {} });
      hop(block, 0.6, 380);
      sfx.pop();
      await say(T.letter(letter));
    }
    if (!this.alive) return;
    ui.hideBubble();
    this.success(null, { big: true });
    await say([...T.spellWord(this.word), this.praise()]);
    if (!this.alive) return;
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
