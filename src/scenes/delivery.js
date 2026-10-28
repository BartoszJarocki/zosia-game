import * as THREE from 'three';
import { animate, ease, wait, hop, camera } from '../engine.js';
import { dragging } from '../input/drag.js';
import { rbox, mat, mesh } from '../models.js';
import { makeBush } from '../world/nature.js';
import { makeHouse, makeFence, makeLamp } from '../world/props.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { WORDS, showLetter } from '../config.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { Mission } from './mission.js';

// "Pup Delivery" (Poczta): first sounds — which word starts with which letter. Chase delivers parcels.
//   pictureSound  parcels with pictures: "Co zaczyna się na Ka?" → tap the cat           (letterSound)
//   soundLetter   letter mailboxes + one parcel with a picture: "Do której skrzynki pójdzie kot?"
//                 → drag the parcel into K (or tap the mailbox)                          (letterSound)
// The pictures are the letters' picture words (config WORDS: K → kot 🐱, kaczka 🦆…), taking turns.

/** Letters that sound alike at the start of a word (kept apart unless GAME.md "similar" says otherwise). */
const SOUNDALIKE = { B: 'P', P: 'B', D: 'T', T: 'D', G: 'K', K: 'G', S: 'Z', Z: 'S', W: 'F', F: 'W', M: 'N', N: 'M' };

const pictureCache = new Map();
/** A picture (emoji) on a rounded card. */
function pictureTexture(emoji, bg) {
  const key = emoji + bg;
  if (pictureCache.has(key)) return pictureCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath(); g.roundRect(0, 0, 256, 256, 36); g.fill();
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(12, 12, 232, 232, 28); g.fill();
  g.font = '170px "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 128, 142);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  pictureCache.set(key, tex);
  return tex;
}

/** A cardboard parcel with a picture card on the front. */
function makeParcel(emoji, bg) {
  const g = new THREE.Group();
  const card = new THREE.MeshStandardMaterial({ map: pictureTexture(emoji, bg), roughness: 0.6 });
  const brown = mat('#c08a4a', { roughness: 0.85 });
  const box = new THREE.Mesh(rbox(1.6, 1.4, 1.4, 0.1), [brown, brown, brown, brown, card, brown]);
  box.castShadow = box.receiveShadow = true;
  box.position.y = 0.7;
  g.add(box);
  g.add(mesh(rbox(1.64, 0.14, 0.3, 0.03), mat('#e8d6a8'), { y: 1.41 })); // tape
  return g;
}

/** A mailbox on a post with a big letter on its front. */
function makeMailbox(letter, color) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 10), mat('#6b7280'), { y: 0.65 }));
  const face = new THREE.MeshStandardMaterial({ map: glyphTexture(showLetter(letter), { bg: color }), roughness: 0.45 });
  const body = mat(color, { roughness: 0.4 });
  const box = new THREE.Mesh(rbox(1.5, 1.3, 1.1, 0.16), [body, body, body, body, face, body]);
  box.castShadow = true;
  box.position.y = 1.9;
  g.add(box);
  g.add(mesh(rbox(0.9, 0.12, 0.08, 0.03), mat('#1f2937'), { y: 2.4, z: 0.56 })); // the slot
  return g;
}

export class DeliveryMission extends Mission {
  constructor(game) {
    super(game, 'delivery');
    this.view = { pos: new THREE.Vector3(0, 4.8, 12), look: new THREE.Vector3(0, 1.6, 0), minWidth: 14 };
    this.post = { tilt: 0.4, focus: 0.42, band: 0.3 };
  }

  build() {
    this.meadow({ clear: [[0, 0, 8]] });
    this.addHeroes(new THREE.Vector3(-5.6, 0, 1.8), 0.55, new THREE.Vector3(5.6, 0, 1.6), -0.55);
    // the post office behind: a house with a red sign
    const po = makeHouse('#fef3c7', '#dc2626', { chimney: false });
    po.position.set(0, 0, -6.5);
    po.scale.setScalar(2.1);
    this.scene.add(po);
    this.scene.add(mesh(rbox(2.6, 0.8, 0.12, 0.08), new THREE.MeshStandardMaterial({ map: glyphTexture('📮', { bg: '#dc2626' }), roughness: 0.5 }), { y: 4.6, z: -4.3 }));
    const fence = makeFence(16);
    fence.position.set(0, 0, -4.2);
    this.scene.add(fence);
    for (let i = 0; i < 6; i++) { const b = makeBush({ scale: 0.9 + Math.random() * 0.3, seed: i * 5 }); b.position.set(-7.5 + i * 3, 0, -3.6); this.scene.add(b); }
    for (const x of [-7, 7]) { const l = makeLamp(); l.position.set(x, 0, -3); this.scene.add(l); }
  }

  /** One of a letter's picture words, [word, picture], taking turns: the same letter comes back with another word. */
  wordFor(l) {
    const words = WORDS[l];
    this.turns ??= {};
    const i = (this.turns[l] ??= Math.floor(Math.random() * words.length));
    this.turns[l] = i + 1;
    return words[i % words.length];
  }

  /** Letters to choose between (no sound-alikes unless the level wants them). */
  others(target, pool, n) {
    const alike = this.L.similar ? '' : SOUNDALIKE[target] || '';
    return shuffle(pool.filter((l) => l !== target && !alike.includes(l) && WORDS[l])).slice(0, n);
  }

  round(r) {
    return this.L.mode === 'soundLetter' ? this.boxRound(r) : this.pictureRound(r);
  }

  // ---------- "Co zaczyna się na Ka?": tap the picture ----------
  pictureRound(r) {
    return new Promise((resolve) => {
      const pool = [...this.L.pool].filter((l) => WORDS[l]);
      const target = this.pick('letterSound', pool);
      this.last = target;
      const n = Math.min(this.L.choices, pool.length);
      const opts = shuffle([target, ...this.others(target, pool, n - 1)]);
      const pics = Object.fromEntries(opts.map((l) => [l, this.wordFor(l)]));
      const said = pics[target][0];
      const colors = shuffle(TILE_COLORS);
      const gap = n > 2 ? 3.2 : 3.8;
      let solved = false, lastWrong = null;
      const parcels = opts.map((l, i) => {
        const p = makeParcel(pics[l][1], colors[i]);
        p.position.x = (i - (n - 1) / 2) * gap;
        p.rotation.y = (Math.random() - 0.5) * 0.2;
        p.userData.letter = l;
        p.userData.tapHeight = 0.7;
        this.scene.add(p);
        this.shadowUnder(p, 1.1, 0.3);
        this.dropIn(p, 0, i * 140).then(() => sfx.pop());
        this.tappable(p, async () => {
          if (solved) return;
          this.poke();
          this.lookAt(p);
          if (l === target) {
            solved = true;
            this.correct(l);
            this.stopIdle();
            parcels.forEach((x) => this.untap(x));
            sfx.good();
            this.success(p.position.clone().add(new THREE.Vector3(0, 1.8, 0)));
            parcels.filter((x) => x !== p && x.parent).forEach((x) => this.shrinkAway(x, 400));
            await say([this.praise(), ...T.letterLike(l, said)]); // "Ka jak kot!"
            if (!this.alive) return;
            await this.deliver(p);
            resolve();
          } else {
            lastWrong = p;
            this.wrong(l, { obj: p });
          }
        });
        return p;
      });
      const right = parcels.find((p) => p.userData.letter === target);
      ui.bubble({ big: showLetter(target), pic: '📦', onTap: () => this.replay() });
      this.question('letterSound', target, {
        short: T.startsWith(target),
        hint: () => T.letterLike(target, said), // "Ka jak kot!"
        simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : parcels.find((p) => p !== right && p.parent)),
        reveal: () => this.hint(right, () => solved),
      });
      wait(500).then(() => { if (this.alive) this.ask(r === 0 ? [...T.deliveryStart(), ...T.startsWith(target)] : T.startsWith(target)); });
    });
  }

  // ---------- "Do której skrzynki pójdzie kot?": the parcel into the right mailbox ----------
  boxRound(r) {
    return new Promise((resolve) => {
      const pool = [...this.L.pool].filter((l) => WORDS[l]);
      const target = this.pick('letterSound', pool);
      this.last = target;
      const n = Math.min(this.L.choices, pool.length);
      const letters = shuffle([target, ...this.others(target, pool, n - 1)]);
      const [said, pic] = this.wordFor(target);
      const colors = shuffle(TILE_COLORS);
      const gap = n > 2 ? 3.4 : 4;
      let solved = false, lastWrong = null;
      const boxes = letters.map((l, i) => {
        const b = makeMailbox(l, colors[i]);
        b.position.set((i - (n - 1) / 2) * gap, 0, -1.2);
        b.userData.letter = l;
        b.userData.tapHeight = 1.9;
        this.scene.add(b);
        this.shadowUnder(b, 0.8, 0.3);
        this.dropIn(b, 0, i * 140).then(() => sfx.pop());
        this.tappable(b, () => choose(b)); // tapping a mailbox = putting the parcel in it
        return b;
      });
      const parcel = makeParcel(pic, '#fde68a');
      parcel.scale.setScalar(0.8);
      parcel.position.set(0, 0, 3);
      this.scene.add(parcel);
      this.shadowUnder(parcel, 0.9, 0.3);
      this.dropIn(parcel, 0, n * 140 + 200).then(() => sfx.pop());
      parcel.userData.tapHeight = 0.6;
      const home = new THREE.Vector3(0, 0, 3);
      // Dragged along the ground, the parcel would slide behind the fence under her finger. Past the mailboxes'
      // front it moves back along her line of sight instead (the same spot on screen), so it climbs their fronts.
      const FRONT = 0.1;
      const inFront = (p) => (p.z >= FRONT ? p : camera.position.clone().lerp(p, (camera.position.z - FRONT) / (camera.position.z - p.z)));
      // the mailbox the top of the parcel is over on screen (the box with the letter: the posts' feet are a nudge away)
      const under = () => {
        const c = parcel.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.9, 0)).project(camera);
        return boxes.find((b) => {
          if (!b.parent || b.userData.gone) return false;
          const q = [[-0.85, 1.1], [0.85, 1.1], [-0.85, 2.7], [0.85, 2.7]].map(([dx, y]) => new THREE.Vector3(b.position.x + dx, y, b.position.z + 0.55).project(camera));
          return c.x > Math.min(...q.map((v) => v.x)) && c.x < Math.max(...q.map((v) => v.x)) && c.y > Math.min(...q.map((v) => v.y)) && c.y < Math.max(...q.map((v) => v.y));
        });
      };
      let placed = null, over = null;
      const offDrag = this.onUpdate(() => {
        if (dragging() !== parcel) { placed = over = null; return; }
        if (!placed || !parcel.position.equals(placed)) parcel.position.copy((placed = inFront(parcel.position.clone()))); // (drag.js moved it)
        const b = under();
        if (b && b !== over) hop(b, 0.15, 260); // the mailbox it would go into
        over = b;
      });
      this.draggable(parcel, {
        height: 0,
        lift: 0.6,
        onPick: () => { this.poke(); sfx.pop(); },
        // only a drop on a mailbox posts it; anywhere else it floats back
        onDrop: () => {
          parcel.position.copy(inFront(parcel.position.clone()));
          const b = under();
          if (!b) return false;
          choose(b);
          return true;
        },
        onTap: () => { this.poke(); hop(parcel, 0.3); }, // (a tap on the parcel: it just wiggles; tap a mailbox instead)
      });

      const choose = async (b) => {
        if (solved) return;
        this.poke();
        this.lookAt(b);
        if (b.userData.letter === target) {
          solved = true;
          this.correct(target);
          this.stopIdle();
          boxes.forEach((x) => this.untap(x));
          this.untap(parcel);
          sfx.good();
          // into the slot it goes
          const from = parcel.position.clone(), to = b.position.clone().add(new THREE.Vector3(0, 2.2, 0.3));
          const s0 = parcel.scale.x;
          await animate(650, (t) => {
            parcel.position.lerpVectors(from, to, t);
            parcel.position.y += Math.sin(t * Math.PI) * 1.4;
            parcel.scale.setScalar(Math.max(0.001, s0 * (1 - t * t)));
          }, ease.inOut);
          parcel.removeFromParent();
          sfx.ding();
          hop(b, 0.35);
          this.success(to.clone().add(new THREE.Vector3(0, 0.6, 0)), { big: true });
          await say([this.praise(), ...T.letterLike(target, said)]);
          if (!this.alive) return;
          await Promise.all(boxes.map((x) => this.shrinkAway(x, 350)));
          offDrag();
          resolve();
        } else {
          lastWrong = b;
          this.wrong(b.userData.letter, { obj: b });
          // the parcel comes back to her
          if (parcel.position.distanceTo(home) > 0.1) this.jumpTo(parcel, home, { height: 0.5, ms: 350 });
        }
      };

      const right = boxes.find((b) => b.userData.letter === target);
      ui.bubble({ big: '', pic, onTap: () => this.replay() });
      this.question('letterSound', target, {
        short: T.whichBox(said),
        hint: () => T.letterLike(target, said), // "Ka jak kot!"
        simplify: () => this.removeOption(lastWrong?.parent ? lastWrong : boxes.find((b) => b !== right && b.parent)),
        reveal: () => this.hint(right, () => solved),
      });
      wait(700 + n * 140).then(() => { if (this.alive) this.ask(r === 0 ? [...T.deliveryStart(), ...T.whichBox(said)] : T.whichBox(said)); });
    });
  }

  /** The chosen parcel goes off to be delivered (Chase takes it). */
  async deliver(p) {
    const to = this.pup.position.clone().add(new THREE.Vector3(-0.6, 0.4, 0.3));
    const from = p.position.clone();
    await animate(600, (t) => {
      p.position.lerpVectors(from, to, t);
      p.position.y += Math.sin(t * Math.PI) * 1.5;
      p.scale.setScalar(Math.max(0.001, 1 - t * 0.7));
    }, ease.inOut);
    sfx.bark();
    hop(this.pup, 0.5);
    await this.shrinkAway(p, 250);
  }
}
