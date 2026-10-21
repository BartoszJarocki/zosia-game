import * as THREE from 'three';
import { animate, ease, hop, wait } from '../engine.js';
import { makeBone, pawBadge, rbox, mat, mesh } from '../models.js';
import { makeBush, makeTree } from '../world/nature.js';
import { makePupHouse, makeFence } from '../world/props.js';
import { sparkle } from '../fx/particles.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { Mission } from './mission.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// "Treat House": counting for real.
//  give    – "give Chase N treats": move treats from the pile to Chase (drag, or tap one), one by one, onto a
//            ten-frame (rows of 5). Ghost spots early; later she decides when to stop and taps Chase.
//  howMany – bones are already there: count them (tap to count) and pick the numeral. Wrong choices are ±1.
export class CountingMission extends Mission {
  constructor(game) {
    super(game, 'counting');
    this.view = { pos: new THREE.Vector3(0, 6, 9.2), look: new THREE.Vector3(0.2, 1.8, 0.4), minWidth: 11.5 };
    this.post = { tilt: 0.35, focus: 0.45, band: 0.32 };
  }

  build() {
    this.meadow({ clear: [[0.5, 0, 6.5]] });
    const house = makePupHouse();
    house.position.set(2.2, 0, -4.2);
    house.scale.setScalar(1.25);
    this.scene.add(house);
    const fence = makeFence(14);
    fence.position.set(0, 0, -6.5);
    this.scene.add(fence);
    for (const [x, z] of [[-4.5, -5.2], [-2.5, -5.5], [6, -5], [7.5, -3.5]]) { const b = makeBush({ seed: Math.round(x * 10) }); b.position.set(x, 0, z); this.scene.add(b); }
    // patio + bowl + ball
    this.scene.add(mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.06, 48), mat('#fdf0cf', { roughness: 0.9 }), { x: 1.3, y: 0.03, z: 0.8 }));
    this.scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.28, 24), mat('#e23b3b', { roughness: 0.35 }), { x: 3.4, y: 0.14, z: -1.2 }));
    const ball = mesh(new THREE.SphereGeometry(0.28, 20, 14), mat('#22c55e', { roughness: 0.4 }), { x: -3.2, y: 0.28, z: -2 });
    this.scene.add(ball);

    this.addHeroes(new THREE.Vector3(-4.6, 0, 1.4), 0.6, new THREE.Vector3(1.6, 0, -1.3), 0);
    this.tappable(this.pup, () => (this.onPup ? this.onPup() : (sfx.bark(), hop(this.pup, 0.5))));

    // treat box
    const box = (this.box = new THREE.Group());
    box.add(mesh(rbox(1.8, 1.2, 1.4, 0.14), mat('#e08a1e', { roughness: 0.5 })));
    box.add(mesh(rbox(1.95, 0.2, 1.55, 0.08), mat('#9a4d12'), { y: 0.62 }));
    const b = makeBone(2);
    b.position.set(0, 0.88, 0);
    box.add(b);
    const paw = pawBadge('#e08a1e');
    paw.position.set(0, 0, 0.72);
    paw.scale.setScalar(0.9);
    box.add(paw);
    box.children.forEach((c) => (c.position.y += 0.6));
    box.position.set(-2, 0, 1.5);
    box.rotation.y = 0.35;
    box.userData.tapHeight = 0.8;
    this.scene.add(box);
    this.shadowUnder(box, 1.3, 0.3);
    this.tappable(box, () => { sfx.pop(); hop(this.box, 0.15, 300); }); // (the treats are in the pile next to it)
  }

  /** Ten-frame layout: rows of five in front of Chase. */
  slotPos(i, perRowCount) {
    const row = Math.floor(i / 5), col = i % 5;
    const inRow = Math.min(5, perRowCount - row * 5);
    return new THREE.Vector3(1.6 + (col - (inRow - 1) / 2) * 0.78, 0.12, 0.7 + row * 0.8);
  }

  makeSlots(count) {
    const slots = [];
    for (let i = 0; i < count; i++) {
      const s = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), { shadow: false });
      s.position.copy(this.slotPos(i, count));
      s.position.y = 0.08;
      s.scale.setScalar(0.001);
      this.scene.add(s);
      slots.push(s);
      wait(i * 60).then(() => animate(300, (t) => s.scale.setScalar(0.001 + t), ease.back));
    }
    return slots;
  }

  flyBone(to, onLand) {
    const bone = makeBone(1.1);
    const from = this.box.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    bone.position.copy(from);
    this.scene.add(bone);
    animate(220, (t) => { this.box.scale.set(1 + Math.sin(t * Math.PI) * 0.1, 1 - Math.sin(t * Math.PI) * 0.12, 1 + Math.sin(t * Math.PI) * 0.1); }, ease.linear);
    const flight = animate(480, (t) => {
      bone.position.lerpVectors(from, to, t);
      bone.position.y += Math.sin(t * Math.PI) * 1.6;
      bone.rotation.z = t * Math.PI * 2;
    }, ease.linear).then(() => { bone.rotation.set(0, 0.3, 0); sfx.crunch(); onLand?.(); });
    return { bone, flight };
  }

  async gobble(bones) {
    const mouth = this.pup.position.clone().add(new THREE.Vector3(0, 1.3, 0.6));
    this.lookAt(mouth);
    for (const bn of bones) {
      if (!this.alive) return;
      const p0 = bn.position.clone();
      await animate(190, (t) => { bn.position.lerpVectors(p0, mouth, t); bn.scale.setScalar(1.1 * (1 - t) + 0.001); }, ease.in);
      bn.removeFromParent();
      sfx.crunch();
    }
    this.pup.userData.setHappy(2);
    hop(this.pup, 0.7);
  }

  round(r) {
    const type = this.L.types[r % this.L.types.length];
    return type === 'howMany' ? this.howManyRound() : this.giveRound();
  }

  // ---------- "give Chase N treats" ----------
  // A pile of treats by the box; she moves them one by one to Chase (drag, or just tap one: it hops over by
  // itself). Each lands on its own spot and is counted aloud: one-to-one counting with real objects.
  //   slots yes: ghost spots show where the N treats go · no: they just line up
  //   auto  yes: done when N are there · no: she decides when to stop and taps Chase
  giveRound() {
    return new Promise((resolve) => {
      const [lo, hi] = this.L.give;
      const n = this.pick('counting', range(lo, hi));
      this.last = n;
      this.item('Q:' + n);
      const auto = this.L.auto, ghost = this.L.slots !== false;
      const spotsN = auto ? n : n > 5 ? 10 : Math.max(5, n + 2); // the ten-frame layout (rows of five)
      const slots = ghost ? this.makeSlots(auto ? n : spotsN) : [];
      if (ghost && !auto) slots.slice(n).forEach((s) => s.visible = false); // only N spots on show
      const given = [], landed = [];
      let done = false, marked = false;
      const PALE = '#fef3c7', FULL = '#fde047';

      // the pile: a few more than needed, lying by the box
      const pile = [];
      for (let i = 0; i < Math.min(12, n + (auto ? 2 : 3)); i++) {
        const bone = makeBone(1.4); // big enough for little fingers
        const a = i * 2.4, r = 0.3 + (i % 4) * 0.32;
        bone.position.set(-1.1 + Math.cos(a) * r, 0.16 + (i % 3) * 0.04, 2.95 + Math.sin(a) * r * 0.55); // in the open, in front of the box
        bone.rotation.set(0, a, 0);
        bone.userData.tapHeight = 0.3;
        bone.userData.home = bone.position.clone();
        this.scene.add(bone);
        pile.push(bone);
        this.draggable(bone, {
          height: 0.14,
          onPick: () => { this.poke(); sfx.pop(); this.lookAt(bone); },
          onDrop: (b, p) => (p.distanceTo(new THREE.Vector3(1.6, 0, 1)) < 2.8 ? (give(b), true) : false), // anywhere near Chase
          onTap: (b) => { this.poke(); give(b); }, // the fallback: it hops over by itself
        });
      }
      const count = () => given.length;
      const short = () => (count() === 0 ? T.dragTreat() : !auto && count() >= n ? T.tapPupWhenDone() : T.treatsDone(n));
      this.question('counting', n, {
        short,
        hint: () => { // the spots still to fill light up softly
          if (!marked) {
            marked = true;
            if (ghost) slots.slice(count(), n).forEach((s) => { s.visible = true; s.material.color.set(PALE); });
            else this.showSpots(count(), n, auto ? n : spotsN);
          }
          return short();
        },
        reveal: () => { const next = pile.find((b) => !given.includes(b)); const c0 = count(); if (next && count() < n) this.hint(next, () => done || count() > c0); },
      });

      ui.bubble({ big: String(n), dots: n, pic: '🦴', onTap: () => this.replay(), passthrough: true }); // Chase sits right under it
      wait(400).then(() => { if (this.alive) this.ask(auto ? [...T.treatsGive(n), ...T.dragTreat()] : T.giveThenTap(n)); });

      // one treat goes to Chase: onto the next spot, counted aloud
      const give = (bone) => {
        if (done || given.includes(bone) || count() >= spotsN) return;
        this.untap(bone);
        given.push(bone);
        const i = count() - 1;
        const to = this.slotPos(i, auto ? n : spotsN);
        const from = bone.position.clone();
        sfx.pop();
        landed.push(animate(420, (t) => {
          bone.position.lerpVectors(from, to, t);
          bone.position.y += Math.sin(t * Math.PI) * 0.9;
        }, ease.inOut).then(() => { bone.rotation.set(0, 0.3, 0); sfx.crunch(); if (slots[i]) slots[i].material.color.set(FULL); }));
        say(T.number(count()));
        if (auto && count() === n) { finish(); return; }
        if (!auto) this.pupGlow(true); // "tap Chase when you're done" comes from the quiet-time help
      };

      const finish = async () => {
        this.correct(n);
        done = true;
        this.stopIdle();
        this.onPup = null;
        this.pupGlow(false);
        pile.forEach((b) => this.untap(b));
        await Promise.all(landed);
        await wait(200);
        if (!this.alive) return;
        sfx.good();
        this.success(this.pup.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
        await say([...T.treatsDone(n), this.praise()]);
        if (!this.alive) return;
        await this.gobble(given);
        await say(T.yum());
        if (!this.alive) return;
        await Promise.all([...slots, ...pile.filter((b) => !given.includes(b)), ...(this.spots || [])].map((s) => this.shrinkAway(s, 250)));
        this.spots = null;
        resolve();
      };

      if (!auto) {
        this.onPup = async () => {
          if (done || count() === 0) { sfx.bark(); hop(this.pup, 0.5); return; }
          this.poke();
          await Promise.all(landed);
          if (count() === n) { finish(); return; }
          this.wrong(count(), { feedback: false }); // gave the wrong number of treats: answered below
          if (count() > n) {
            // too many: give the extras back to the pile, one by one
            done = true;
            await this.say(T.tooMany());
            while (count() > n && this.alive) {
              const bn = given.pop();
              const p0 = bn.position.clone(), to = bn.userData.home;
              await animate(380, (t) => { bn.position.lerpVectors(p0, to, t); bn.position.y += Math.sin(t * Math.PI); }, ease.linear);
              await this.say(T.number(count()));
            }
            if (this.alive) finish();
          } else {
            this.say(T.tooFew());
          }
        };
      }
    });
  }

  /** Help without ghost spots: show pale spots where the next treats go (from..to-1). */
  showSpots(from, to, layout) {
    this.spots ||= [];
    for (let i = from; i < to; i++) {
      const s = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 24), new THREE.MeshStandardMaterial({ color: '#fef3c7', transparent: true, opacity: 0.85 }), { shadow: false });
      s.position.copy(this.slotPos(i, layout)).setY(0.08);
      this.scene.add(s);
      this.spots.push(s);
    }
    sfx.pop();
  }

  pupGlow(on) {
    if (on === this.glowing) return;
    this.glowing = on;
    if (on && !this.glowOff) {
      this.glowOff = this.onUpdate((dt, t) => {
        if (!this.glowing) return;
        const k = 1 + Math.max(0, Math.sin(t * 5)) * 0.05;
        this.pup.scale.setScalar(k);
      });
    }
    if (!on) this.pup.scale.setScalar(1);
  }

  // ---------- "how many treats?" ----------
  howManyRound() {
    return new Promise((resolve) => {
      const [lo, hi] = this.L.howMany;
      const n = this.pick('quantity', range(lo, hi));
      this.last = n;
      this.item('H:' + n);
      const slotsN = n > 5 ? 10 : 5;
      const slots = this.makeSlots(slotsN);
      const bones = [];
      let tapCount = 0, solved = false, lastWrong = null;
      // bones tumble in (no counting aloud: that's her job)
      for (let i = 0; i < n; i++) {
        wait(300 + i * 220).then(() => {
          if (!this.alive) return;
          const { bone } = this.flyBone(this.slotPos(i, slotsN));
          bone.userData.tapHeight = 0;
          bones.push(bone);
          this.tappable(bone, () => {
            // touch-counting: each tap lights a bone and says the next number
            if (solved || bone.userData.counted) return;
            bone.userData.counted = true;
            tapCount++;
            sparkle(this, bone.position.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 6, size: 0.1, speed: 1.5 });
            hop(bone, 0.3, 300);
            say(T.number(tapCount));
          });
        });
      }
      // numeral blocks to choose from
      const max = Math.max(this.L.howMany[1] + 1, n + 1);
      const opts = numberChoices(n, max, 3, true);
      const colors = shuffle(TILE_COLORS);
      const blocks = opts.map((num, i) => {
        const m = new THREE.MeshStandardMaterial({ map: glyphTexture(String(num), { bg: colors[i] }), roughness: 0.45 });
        const b = new THREE.Mesh(rbox(1.15, 1.15, 1.15, 0.14), m);
        b.castShadow = true;
        b.position.set(-1.2 + i * 1.5, 0.6, 3.1);
        b.rotation.y = (Math.random() - 0.5) * 0.3;
        b.userData.num = num;
        b.userData.tapHeight = 0;
        this.scene.add(b);
        this.shadowUnder(b, 0.8, 0.3);
        this.dropIn(b, 0.6, 300 + n * 220 + i * 120).then(() => sfx.pop());
        this.tappable(b, async () => {
          if (solved) return;
          this.poke();
          this.lookAt(b);
          if (num === n) {
            solved = true;
            this.correct(num);
            this.stopIdle();
            blocks.forEach((x) => this.untap(x));
            bones.forEach((x) => this.untap(x));
            sfx.good();
            this.success(b.position.clone().add(new THREE.Vector3(0, 1, 0)));
            await say([...T.yes(), ...T.treatsDone(n)]);
            if (!this.alive) return;
            blocks.filter((x) => x.parent).forEach((x) => this.shrinkAway(x, 300));
            await this.gobble(bones);
            await say(T.yum());
            if (!this.alive) return;
            await Promise.all(slots.map((s) => this.shrinkAway(s, 250)));
            resolve();
          } else {
            lastWrong = b;
            this.wrong(num, { obj: b });
          }
        });
        return b;
      });

      // help: count the bones together, lighting each one (stops if anything else is said)
      const step = async (segments) => { const p = this.say(segments), mine = this.sayToken; await p; return mine === this.sayToken && this.alive && !solved; };
      const countTogether = async (said = []) => {
        if (!(await step([...said, ...T.countTogether()]))) return;
        for (let k = 0; k < bones.length; k++) {
          hop(bones[k], 0.35, 300);
          sparkle(this, bones[k].position.clone().add(new THREE.Vector3(0, 0.3, 0)), { count: 5, size: 0.1, speed: 1.4 });
          if (!(await step(T.number(k + 1)))) return;
        }
        tapCount = 0;
        bones.forEach((x) => (x.userData.counted = false));
        await step(T.howManyShort());
      };
      const rb = blocks.find((x) => x.userData.num === n);
      this.question('quantity', n, {
        short: T.howManyShort(),
        hint: () => countTogether(),
        simplify: (said) => { this.removeOption(lastWrong?.parent ? lastWrong : blocks.find((x) => x !== rb && x.parent)); return countTogether(said); },
        reveal: () => this.hint(rb, () => solved),
      });

      ui.bubble({ big: '?', pic: '🦴', onTap: () => this.replay() });
      wait(400 + n * 220).then(() => { if (this.alive) this.ask(T.howMany()); });
    });
  }
}
