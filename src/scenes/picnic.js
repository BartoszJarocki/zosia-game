import * as THREE from 'three';
import { animate, ease, shakeNo, wait, hop } from '../engine.js';
import { makeBone, makeKitten, rbox, mat, mesh } from '../models.js';
import { makeBush } from '../world/nature.js';
import { glyphTexture } from '../textures.js';
import { sfx, say } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { Mission } from './mission.js';

// "Pup Picnic": more, less, the same — comparing amounts by looking, before numbers.
//   more          two blankets with treats: "Gdzie jest więcej smakołyków?" Hungry Chase eats them.
//   less          a kitten with a small tummy wants the smaller pile: "Gdzie jest mniej smakołyków?"
//   same          Chase's plate + two blankets: "Gdzie jest tyle samo, co u Czejsa?"
//   numerals      (later) the blankets show numerals instead of treats: 3 or 5?
// The clue lines each group up on its own blanket, one row each from the middle outwards: the longer row has
// more (one-to-one matching). With numerals it puts the dots under each numeral. No < or > signs.
// Skill: comparison (item = the mode, '#' with numerals).

const BLANKET_X = 3.5, BLANKET_Z = 0.6, BLANKET_W = 5.2, BLANKET_D = 3;
const ROW = 0.95;   // treats in a lined-up row, centre to centre
const INNER = 1.6;  // a lined-up row starts this far from the middle and runs outwards (rows of five)
const PLATE = new THREE.Vector3(0, 0, -1.75); // Chase's plate ("same")
const NUMERAL_BG = '#2563eb';

function checkTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = color;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) g.fillRect(x * 16, y * 16, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.6, 1.5);
  return t;
}

export class PicnicMission extends Mission {
  constructor(game) {
    super(game, 'picnic');
    this.view = { pos: new THREE.Vector3(0, 7.5, 10.5), look: new THREE.Vector3(0, 1.1, -0.6), minWidth: 14 };
    this.post = { tilt: 0.4, focus: 0.46, band: 0.32 };
  }

  build() {
    this.meadow({ clear: [[0, 0, 7.5]] });
    this.addHeroes(new THREE.Vector3(-3.7, 0, -2.5), 0.35, new THREE.Vector3(0, 0, -2.9), 0); // (Zosia behind the red blanket, in view)
    for (let i = 0; i < 5; i++) { const b = makeBush({ scale: 0.9 + Math.random() * 0.4, seed: i * 3 }); b.position.set(-7 + i * 3.5, 0, -5.6); this.scene.add(b); }
    // a picnic basket by Chase
    const basket = new THREE.Group();
    basket.add(mesh(rbox(1.2, 0.7, 0.8, 0.1), mat('#b45309', { roughness: 0.8 }), { y: 0.35 }));
    basket.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20, Math.PI), mat('#92400e'), { y: 0.72 }));
    basket.position.set(2.4, 0, -3.6);
    this.scene.add(basket);
    // two blankets
    this.blankets = [-1, 1].map((side, i) => {
      const b = mesh(new THREE.PlaneGeometry(BLANKET_W, BLANKET_D), new THREE.MeshStandardMaterial({ map: checkTexture(i ? '#60a5fa' : '#f87171'), roughness: 0.95 }), { x: side * BLANKET_X, y: 0.04, z: BLANKET_Z, rx: -Math.PI / 2, shadow: false });
      b.receiveShadow = true;
      this.scene.add(b);
      return b;
    });
    // the kitten who comes for "less": a small tummy wants the smaller pile
    if (this.L.modes.includes('less')) {
      const k = (this.kitten = makeKitten());
      k.position.set(3.7, 0, -2.4);
      k.rotation.y = -0.4;
      k.userData.tapHeight = 0.8;
      this.scene.add(k);
      this.shadowUnder(k, 0.45);
      this.onUpdate((dt, t) => k.userData.idle(t));
      this.tappable(k, () => { sfx.meow(); hop(k, 0.35); });
    }
  }

  /** Two amounts for a comparison: far apart early (difference ≥ 2), close later (difference 1). */
  amounts(max) {
    for (;;) {
      const a = 1 + Math.floor(Math.random() * max), b = 1 + Math.floor(Math.random() * max);
      const d = Math.abs(a - b);
      if (this.L.close ? d === 1 : d >= 2) return [a, b];
    }
  }

  /**
   * n treats laid out on a spot (neat rows of up to four, or one straight row), or a numeral card.
   * Each is marked `treat` (and `num`, its amount) so probes can see what she sees.
   */
  spread(n, at, { numeral = false, row = false, y = 0.16 } = {}) {
    const items = [];
    if (numeral) {
      const card = new THREE.Mesh(rbox(2.2, 0.16, 2.2, 0.08), [mat('#fff'), mat('#fff'), new THREE.MeshStandardMaterial({ map: glyphTexture(String(n), { bg: NUMERAL_BG }) }), mat('#fff'), mat('#fff'), mat('#fff')]);
      card.position.copy(at).setY(0.12);
      card.userData.treat = true;
      card.userData.num = n;
      this.scene.add(card);
      items.push(card);
      return items;
    }
    const perRow = row ? n : n > 4 ? Math.ceil(n / 2) : n, jitter = row ? 0 : 0.12;
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - r * perRow);
      const bone = makeBone(1.5);
      bone.position.set(at.x + (col - (inRow - 1) / 2) * ROW + (Math.random() - 0.5) * jitter, y, at.z + (r - 0.5 * (n > perRow ? 1 : 0)) * 1.0 + (Math.random() - 0.5) * jitter);
      bone.rotation.y = row ? 0 : (Math.random() - 0.5) * 0.8;
      bone.userData.treat = true;
      this.scene.add(bone);
      this.dropIn(bone, y, 120 + i * 70, 500);
      items.push(bone);
    }
    return items;
  }

  round(r) {
    return new Promise((resolve) => {
      const mode = this.L.modes[r % this.L.modes.length];
      const numerals = this.L.numerals;
      const item = mode + (numerals ? '#' : '');
      let counts, ref = 0;
      if (mode === 'same') {
        // Chase's plate (up to 5) and two blankets: one the same, one a bit different
        ref = 1 + Math.floor(Math.random() * Math.min(this.L.max, 5));
        const d = this.L.close ? 1 : 2;
        const other = ref - d >= 1 && (ref + d > this.L.max || Math.random() < 0.5) ? ref - d : ref + d;
        counts = shuffle([ref, other]);
      } else counts = this.amounts(this.L.max);
      const answer = mode === 'same' ? counts.indexOf(ref) : mode === 'more' ? (counts[0] > counts[1] ? 0 : 1) : counts[0] < counts[1] ? 0 : 1;
      this.last = item;
      const spots = [-1, 1].map((side) => new THREE.Vector3(side * BLANKET_X, 0, BLANKET_Z));
      const groups = counts.map((n, i) => this.spread(n, spots[i], { numeral: numerals }));
      // Chase's own treats, in a row on his plate
      const plate = mode === 'same' ? mesh(new THREE.CylinderGeometry(1, 1, 0.08, 40), mat('#ffffff', { roughness: 0.4 }), { x: PLATE.x, y: 0.05, z: PLATE.z, s: [Math.max(1.3, ref * ROW / 2 + 0.5), 1, 0.62] }) : null;
      if (plate) this.scene.add(plate);
      const refItems = mode === 'same' ? this.spread(ref, PLATE, { row: true, y: 0.22 }) : [];
      let solved = false, lined = false;

      // tap zones: the blankets (each group stays on its own blanket, clue or not)
      const zones = spots.map((at, i) => {
        const z = new THREE.Mesh(new THREE.BoxGeometry(BLANKET_W, 1.2, BLANKET_D), new THREE.MeshBasicMaterial({ visible: false }));
        z.position.copy(at).setY(0.6);
        z.userData.tapHeight = 0;
        this.scene.add(z);
        this.tappable(z, () => choose(i));
        return z;
      });
      const ask = { more: T.askMore(), less: T.askLess(), same: T.askSame() }[mode];
      const yes = { more: T.yesMore(), less: T.yesLess(), same: T.yesSame() }[mode];
      const eater = mode === 'less' && this.kitten ? this.kitten : this.pup;

      const choose = async (i) => {
        if (solved) return;
        this.poke();
        this.lookAt(spots[i]);
        if (i === answer) {
          solved = true;
          this.correct(item);
          this.stopIdle();
          zones.forEach((z) => this.untap(z));
          sfx.good();
          this.success(spots[i].clone().add(new THREE.Vector3(0, 1.5, 0)), { big: true });
          // numerals: the treats appear for real
          let eat = groups[i];
          if (numerals) { groups[i].forEach((c) => this.shrinkAway(c, 250)); eat = this.spread(counts[i], spots[i]); await wait(400 + counts[i] * 70); }
          await say([...yes, ...T.number(counts[i])]);
          if (!this.alive) return;
          await this.feast(eater, eat, spots[i]);
          await Promise.all([...groups.flat(), ...refItems, ...(plate ? [plate] : [])].filter((x) => x.parent).map((x) => this.shrinkAway(x, 250)));
          zones.forEach((z) => z.removeFromParent());
          resolve();
        } else {
          const more = counts[i] > counts[1 - i] || (mode === 'same' && counts[i] > ref);
          this.wrong(item + ':' + counts[i], { said: more ? T.noMore() : T.noLess() });
          groups[i].forEach((x) => shakeNo(x));
        }
      };

      // the clue: each group lines up on its own blanket, one row each from the middle outwards (the longer row
      // has more); numeral cards get their dots underneath
      const clue = () => {
        if (lined) return;
        lined = true;
        sfx.whoosh();
        if (numerals) {
          groups.forEach((g, i) => g.forEach((card) => { card.material[2].map = glyphTexture(String(counts[i]), { bg: NUMERAL_BG, dots: counts[i] }); hop(card, 0.3); }));
          return;
        }
        groups.forEach((g, i) => g.forEach((b, k) => {
          const side = i ? 1 : -1, rows = Math.ceil(g.length / 5), r0 = b.rotation.y;
          const from = b.position.clone(), to = new THREE.Vector3(side * (INNER + (k % 5) * ROW), 0.16, BLANKET_Z + (Math.floor(k / 5) - (rows - 1) / 2) * 0.9);
          animate(600, (t) => { b.position.lerpVectors(from, to, t); b.position.y += Math.sin(t * Math.PI) * 0.5; b.rotation.y = r0 * (1 - t); }, ease.inOut);
        }));
      };

      ui.bubble({ big: '', pic: eater === this.kitten ? '🐱' : '🧺', onTap: () => this.replay() });
      this.question('comparison', item, {
        short: ask,
        hint: () => { clue(); return T.lookCarefully(); },
        simplify: () => clue(),
        reveal: () => groups[answer].forEach((b) => this.hint(b, () => solved)), // the right group pulses
      }, { options: 2 });
      const story = eater === this.kitten ? T.kittenTummy() : [];
      wait(700 + Math.max(...counts) * 70).then(() => { if (this.alive) this.ask([...(r === 0 ? T.picnicStart() : []), ...story, ...ask]); });
    });
  }

  /** Chase (or the kitten) trots over and eats them. */
  async feast(who, items, at) {
    const kitten = who === this.kitten, home = who.position.clone(), turn = who.rotation.y;
    const to = at.clone().add(new THREE.Vector3(0, 0, -1.6));
    who.rotation.y = Math.atan2(to.x - home.x, to.z - home.z);
    await this.jumpTo(who, to, { height: 0.6, ms: 500 });
    who.rotation.y = 0;
    for (const b of items) {
      if (!this.alive) return;
      const p0 = b.position.clone(), mouth = who.position.clone().add(new THREE.Vector3(0, kitten ? 0.8 : 1.2, 0.5));
      await animate(170, (t) => { b.position.lerpVectors(p0, mouth, t); b.scale.setScalar(Math.max(0.001, 1.15 * (1 - t))); }, ease.in);
      b.removeFromParent();
      sfx.crunch();
    }
    who.userData.setHappy?.(2);
    if (kitten) sfx.meow();
    await hop(who, 0.6);
    await say(T.yum());
    who.rotation.y = Math.atan2(home.x - who.position.x, home.z - who.position.z);
    await this.jumpTo(who, home, { height: 0.6, ms: 500 });
    who.rotation.y = turn;
  }
}
