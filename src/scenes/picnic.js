import * as THREE from 'three';
import { animate, ease, wiggle, wait, hop } from '../engine.js';
import { makeBone, rbox, mat, mesh } from '../models.js';
import { makeBush } from '../world/nature.js';
import { glyphTexture } from '../textures.js';
import { sfx, say } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { Mission } from './mission.js';

// "Pup Picnic": more, less, the same — comparing amounts by looking, before numbers.
//   more / less   two blankets with treats: "Gdzie jest więcej smakołyków?"
//   same          Chase's plate + two blankets: "Gdzie jest tyle samo, co u Czejsa?"
//   numerals      (later) the blankets show numerals instead of treats: 3 or 5?
// The clue lines both groups up in rows, side by side: the longer row has more (one-to-one matching).
// No < or > signs. Skill: comparison (item = the mode, '#' with numerals).

const BLANKET_X = 3.2, BLANKET_Z = 0.6;

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
  t.repeat.set(2, 1.5);
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
    this.addHeroes(new THREE.Vector3(-5.8, 0, 2.6), 0.6, new THREE.Vector3(0, 0, -2.9), 0); // (in front of the bubble)
    for (let i = 0; i < 5; i++) { const b = makeBush({ scale: 0.9 + Math.random() * 0.4, seed: i * 3 }); b.position.set(-7 + i * 3.5, 0, -5.6); this.scene.add(b); }
    // a picnic basket by Chase
    const basket = new THREE.Group();
    basket.add(mesh(rbox(1.2, 0.7, 0.8, 0.1), mat('#b45309', { roughness: 0.8 }), { y: 0.35 }));
    basket.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20, Math.PI), mat('#92400e'), { y: 0.72 }));
    basket.position.set(2.4, 0, -3.6);
    this.scene.add(basket);
    // two blankets
    this.blankets = [-1, 1].map((side, i) => {
      const b = mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial({ map: checkTexture(i ? '#60a5fa' : '#f87171'), roughness: 0.95 }), { x: side * BLANKET_X, y: 0.04, z: BLANKET_Z, rx: -Math.PI / 2, shadow: false });
      b.receiveShadow = true;
      this.scene.add(b);
      return b;
    });
  }

  /** Two amounts for a comparison: far apart early (difference ≥ 2), close later (difference 1). */
  amounts(max) {
    for (;;) {
      const a = 1 + Math.floor(Math.random() * max), b = 1 + Math.floor(Math.random() * max);
      const d = Math.abs(a - b);
      if (this.L.close ? d === 1 : d >= 2) return [a, b];
    }
  }

  /** n treats laid out on a spot (neat rows of up to four), or a numeral card. */
  spread(n, at, { numeral = false } = {}) {
    const items = [];
    if (numeral) {
      const card = new THREE.Mesh(rbox(1.6, 0.16, 1.6, 0.08), [mat('#fff'), mat('#fff'), new THREE.MeshStandardMaterial({ map: glyphTexture(String(n), { bg: '#2563eb' }) }), mat('#fff'), mat('#fff'), mat('#fff')]);
      card.position.copy(at).setY(0.12);
      this.scene.add(card);
      items.push(card);
      return items;
    }
    const perRow = n > 4 ? Math.ceil(n / 2) : n;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
      const bone = makeBone(1.5);
      bone.position.set(at.x + (col - (inRow - 1) / 2) * 0.95 + (Math.random() - 0.5) * 0.12, 0.16, at.z + (row - 0.5 * (n > perRow ? 1 : 0)) * 1.0 + (Math.random() - 0.5) * 0.12);
      bone.rotation.y = (Math.random() - 0.5) * 0.8;
      this.scene.add(bone);
      this.dropIn(bone, 0.14, 120 + i * 70, 500);
      items.push(bone);
    }
    return items;
  }

  round(r) {
    return new Promise((resolve) => {
      const mode = this.L.modes[r % this.L.modes.length];
      const numerals = this.L.numerals;
      const item = mode + (numerals ? '#' : '');
      this.item('C:' + item);
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
      const refItems = mode === 'same' ? this.spread(ref, new THREE.Vector3(0, 0, -1.7)) : [];
      let solved = false, lined = false;

      // tap zones over the blankets
      const zones = spots.map((at, i) => {
        const z = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 3), new THREE.MeshBasicMaterial({ visible: false }));
        z.position.copy(at).setY(0.6);
        z.userData.tapHeight = 0;
        this.scene.add(z);
        this.tappable(z, () => choose(i));
        return z;
      });
      const ask = { more: T.askMore(), less: T.askLess(), same: T.askSame() }[mode];
      const yes = { more: T.yesMore(), less: T.yesLess(), same: T.yesSame() }[mode];

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
          await this.feast(eat, spots[i]);
          await Promise.all([...groups.flat(), ...refItems].filter((x) => x.parent).map((x) => this.shrinkAway(x, 250)));
          zones.forEach((z) => z.removeFromParent());
          resolve();
        } else {
          const more = counts[i] > counts[1 - i] || (mode === 'same' && counts[i] > ref);
          this.wrong(item + ':' + counts[i], more ? T.hereMore() : T.hereLess());
          sfx.oops();
          groups[i].forEach((x) => wiggle(x));
        }
      };

      // the clue: line both groups up in rows, side by side (the longer row has more)
      const lineUp = () => {
        if (lined || numerals) return;
        lined = true;
        sfx.whoosh();
        const rows = mode === 'same' ? [...groups, refItems] : groups;
        const zs = mode === 'same' ? [BLANKET_Z - 0.5, BLANKET_Z + 0.6, -1.7] : [BLANKET_Z - 0.5, BLANKET_Z + 0.6];
        rows.forEach((g, gi) => g.forEach((b, k) => {
          const from = b.position.clone(), to = new THREE.Vector3(-3.6 + k * 0.95, 0.16, zs[gi]);
          animate(600, (t) => { b.position.lerpVectors(from, to, t); b.position.y += Math.sin(t * Math.PI) * 0.5; b.rotation.y = 0; }, ease.inOut);
        }));
      };

      ui.bubble({ big: '', pic: '🧺', onTap: () => this.replay() });
      this.question('comparison', item, {
        short: ask,
        hint: () => { lineUp(); return T.lookCarefully(); },
        simplify: () => lineUp(),
        reveal: () => groups[answer].forEach((b) => this.hint(b, () => solved)), // the right group pulses
      });
      wait(700 + Math.max(...counts) * 70).then(() => { if (this.alive) this.ask(r === 0 ? [...T.picnicStart(), ...ask] : ask); });
    });
  }

  /** Chase trots over and eats them. */
  async feast(items, at) {
    const p = this.pup, from = p.position.clone(), to = at.clone().add(new THREE.Vector3(0, 0, -1.6));
    p.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    await this.jumpTo(p, to, { height: 0.6, ms: 500 });
    p.rotation.y = 0;
    for (const b of items) {
      if (!this.alive) return;
      const p0 = b.position.clone(), mouth = p.position.clone().add(new THREE.Vector3(0, 1.2, 0.5));
      await animate(170, (t) => { b.position.lerpVectors(p0, mouth, t); b.scale.setScalar(Math.max(0.001, 1.15 * (1 - t))); }, ease.in);
      b.removeFromParent();
      sfx.crunch();
    }
    p.userData.setHappy(2);
    await hop(p, 0.6);
    await say(T.yum());
    p.rotation.y = Math.atan2(from.x - p.position.x, from.z - p.position.z);
    await this.jumpTo(p, from, { height: 0.6, ms: 500 });
    p.rotation.y = 0;
  }
}
