import * as THREE from 'three';
import { animate, ease, hop, wait } from '../engine.js';
import { makeBone, makeKitten, pawBadge, rbox, mat, mesh } from '../models.js';
import { makeBush } from '../world/nature.js';
import { makePupHouse, makeFence } from '../world/props.js';
import { sparkle } from '../fx/particles.js';
import { glyphTexture, TILE_COLORS } from '../textures.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { numberChoices } from '../levels.js';
import { roundOrder, DICE } from '../levels/treats.js';
import { Mission } from './mission.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Chase's tray: the treats he gets lie on it in rows of five (a ten-frame), cream on blue so every one shows.
const TRAY = { x: 1.6, z: 0.75, w: 4.5, d: 1.9, top: 0.1 };
const ROW_Z = [0.35, 1.15];
const GAP = 0.78;
const BONE_Y = TRAY.top + 0.08;
const ON_TRAY = 1.15, LIE = 0.6; // treats on the tray: their size and slant (side by side without touching)
const DROP = new THREE.Vector3(TRAY.x, 0, TRAY.z); // a treat dragged near here goes to Chase
const PILE = new THREE.Vector3(-1.2, 0, 2.8); // the treats she gives lie here, in front of the treat box
const DISH = new THREE.Vector3(3.9, 0, 2.8); // flash, hidden: the plate with Chase's bowl over it
const BLOCK = 1.0, BLOCK_Z = 3.15; // "how many?" numerals: a row in front of the tray, low enough to hide no treat
const PALE = '#fef3c7', FULL = '#fde047';
// Landscape sees the whole patio; portrait looks down more steeply, so the tall screen shows the patio's depth.
const VIEWS = {
  wide: { pos: new THREE.Vector3(0.9, 8.6, 9.6), look: new THREE.Vector3(1.0, 1.5, 0.3), minWidth: 12.4 },
  tall: { pos: new THREE.Vector3(1.2, 12.6, 8.8), look: new THREE.Vector3(1.2, 1.3, 1.0), minWidth: 8.4 },
};

// "Treat House": counting for real.
//  give    – "give Chase N treats": move treats from the pile to Chase (drag, or tap one), one by one, onto his
//            tray. Ghost rings early; later she decides when to stop and taps Chase.
//  howMany – bones are already on the tray: count them (tap to count) and pick the numeral. Wrong choices are ±1.
//  share   – Chase and kittens wait at their plates: she taps whoever is still hungry. One treat each.
//  flash   – treats seen under Chase's bowl for two seconds; she gives him the same number.
//  hidden  – treats go under the bowl, then one more; she gives him as many as are under it.
export class CountingMission extends Mission {
  constructor(game) {
    super(game, 'counting');
    this.view = { pos: new THREE.Vector3(), look: new THREE.Vector3(), minWidth: 0 };
    this.frame();
    this.post = { tilt: 0.35, focus: 0.42, band: 0.36 };
  }

  /** Landscape or portrait: pick the camera that fits (checked every frame, changed only on a flip). */
  frame() {
    const v = VIEWS[innerWidth >= innerHeight ? 'wide' : 'tall'];
    if (this.framed === v) return;
    this.framed = v;
    this.view.pos.copy(v.pos);
    this.view.look.copy(v.look);
    this.view.minWidth = v.minWidth;
  }

  build() {
    this.onUpdate(() => { if (!this.pushing) this.frame(); });
    this.meadow({ clear: [[0.5, 0, 6.5]] });
    const house = makePupHouse();
    house.position.set(2.2, 0, -4.2);
    house.scale.setScalar(1.25);
    this.scene.add(house);
    const fence = makeFence(14);
    fence.position.set(0, 0, -6.5);
    this.scene.add(fence);
    for (const [x, z] of [[-4.5, -5.2], [-2.5, -5.5], [6, -5], [7.5, -3.5]]) { const b = makeBush({ seed: Math.round(x * 10) }); b.position.set(x, 0, z); this.scene.add(b); }
    // patio (warm brick, so cream treats stand out on it too) + ball
    this.scene.add(mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.06, 48), mat('#c0784a', { roughness: 0.9 }), { x: 1.2, y: 0.03, z: 0.9 }));
    const ball = mesh(new THREE.SphereGeometry(0.28, 20, 14), mat('#22c55e', { roughness: 0.4 }), { x: -3.2, y: 0.28, z: -2 });
    this.scene.add(ball);
    // Chase's tray (moves aside for "share", when everyone gets a plate)
    const tray = (this.tray = mesh(rbox(TRAY.w, 0.1, TRAY.d, 0.05), mat('#1e40af', { roughness: 0.55 }), { x: TRAY.x, y: TRAY.top - 0.05, z: TRAY.z }));
    tray.userData.dynamic = true;
    this.scene.add(tray);

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

  /** Spot i on the tray. Up to five spots: one row, centred. More: rows of five from the left (a ten-frame). */
  slotPos(i, layout) {
    const ten = layout > 5;
    const col = ten ? i % 5 : i + 2 - (layout - 1) / 2;
    return new THREE.Vector3(TRAY.x + (col - 2) * GAP, BONE_Y, ROW_Z[ten ? Math.floor(i / 5) : 0]);
  }

  /** Ghost rings on the tray for spots from..to-1: an empty spot is a ring, so it never looks like a treat. */
  makeRings(from, to, layout) {
    const rings = [];
    for (let i = from; i < to; i++) {
      const r = mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 32), new THREE.MeshStandardMaterial({ color: PALE, roughness: 0.5 }), { rx: -Math.PI / 2, shadow: false });
      r.position.copy(this.slotPos(i, layout)).setY(TRAY.top + 0.02);
      r.scale.setScalar(0.001);
      this.scene.add(r);
      rings[i] = r;
      wait((i - from) * 60).then(() => animate(300, (t) => r.scale.setScalar(0.001 + t), ease.back));
    }
    return rings;
  }

  /** A treat flies out of the box to a spot. */
  flyBone(to) {
    const bone = makeBone(ON_TRAY);
    const from = this.box.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    bone.position.copy(from);
    this.scene.add(bone);
    animate(220, (t) => { this.box.scale.set(1 + Math.sin(t * Math.PI) * 0.1, 1 - Math.sin(t * Math.PI) * 0.12, 1 + Math.sin(t * Math.PI) * 0.1); }, ease.linear);
    const flight = animate(480, (t) => {
      bone.position.lerpVectors(from, to, t);
      bone.position.y += Math.sin(t * Math.PI) * 1.6;
      bone.rotation.z = t * Math.PI * 2;
    }, ease.linear).then(() => { bone.rotation.set(0, LIE, 0); sfx.crunch(); });
    return { bone, flight };
  }

  /** One treat into Chase's mouth. */
  chomp(bn) {
    const mouth = this.pup.position.clone().add(new THREE.Vector3(0, 1.3, 0.6));
    const p0 = bn.position.clone(), s0 = bn.scale.x;
    return animate(190, (t) => { bn.position.lerpVectors(p0, mouth, t); bn.scale.setScalar(s0 * (1 - t) + 0.001); }, ease.in)
      .then(() => { bn.removeFromParent(); sfx.crunch(); });
  }

  async gobble(bones) {
    this.lookAt(this.pup.position.clone().add(new THREE.Vector3(0, 1.3, 0.6)));
    for (const bn of bones) {
      if (!this.alive) return;
      await this.chomp(bn);
    }
    this.pup.userData.setHappy(2);
    hop(this.pup, 0.7);
  }

  /** A new order each run (src/levels/treats.js), ending on an easy, happy round; winding down skips to it. */
  round(r) {
    const { types, auto } = this.L;
    this.plan ||= roundOrder(types, this.rounds, { easy: types.filter((t) => t === 'share' || (t === 'give' && auto)) });
    const kind = this.windingDown && r === this.rounds - 1 ? this.plan.at(-1) : this.plan[r] ?? this.plan.at(-1);
    return this[`${kind}Round`]();
  }

  /** The pile in front of the treat box: big treats for little fingers, popping in one by one. */
  makePile(count) {
    return Array.from({ length: count }, (_, i) => {
      const bone = makeBone(1.4);
      const a = i * 2.4, r = 0.3 + (i % 4) * 0.32;
      bone.position.set(PILE.x + Math.cos(a) * r, 0.16 + (i % 3) * 0.04, PILE.z + Math.sin(a) * r * 0.55);
      bone.rotation.set(0, a, 0);
      bone.userData.tapHeight = 0.3;
      bone.userData.home = bone.position.clone();
      bone.scale.setScalar(0.001);
      this.scene.add(bone);
      wait(i * 40).then(() => animate(260, (t) => bone.scale.setScalar(0.001 + 1.4 * t), ease.out));
      return bone;
    });
  }

  /**
   * Treats from the pile to Chase's tray, one by one (drag one over, or tap it and it hops by itself), each
   * counted aloud. f.done resolves once exactly n are there: as soon as the n-th is given when auto, otherwise
   * when she taps Chase. A wrong amount is answered and she carries on: too few, "Za mało! Jeszcze!"; too many,
   * Chase gives the extra ones back and she taps him again herself. compare(f) runs once before the first
   * verdict (flash, hidden: the bowl's treats line up next to hers).
   */
  feed({ n, auto = false, layout, rings = [], compare = null }) {
    // state: giving → (she taps Chase) checking → giving again, or done
    const f = { rings, pile: this.makePile(Math.min(12, n + (auto ? 2 : 3))), given: [], landed: [], state: 'giving' };
    f.count = () => f.given.length;
    f.next = () => f.pile.find((b) => !f.given.includes(b));
    f.done = new Promise((resolve) => (f.resolve = resolve));
    const finish = () => {
      f.state = 'done';
      this.onPup = null;
      this.pupGlow(false);
      f.pile.forEach((b) => this.untap(b));
      f.resolve();
    };
    const give = (bone) => {
      if (f.state !== 'giving' || f.given.includes(bone) || f.count() >= layout) return false;
      this.untap(bone);
      f.given.push(bone);
      const i = f.count() - 1;
      const from = bone.position.clone(), to = this.slotPos(i, layout), s0 = bone.scale.x;
      sfx.pop();
      f.landed.push(animate(420, (t) => {
        bone.position.lerpVectors(from, to, t);
        bone.position.y += Math.sin(t * Math.PI) * 0.9;
        bone.scale.setScalar(s0 + (ON_TRAY - s0) * t);
      }, ease.inOut).then(() => { bone.rotation.set(0, LIE, 0); sfx.crunch(); rings[i]?.material.color.set(FULL); this.pupWags(); }));
      say(T.number(f.count()));
      if (auto && f.count() === n) finish();
      else if (!auto) this.pupGlow(true); // "tap Chase when you're done" comes from the quiet-time help
      return true;
    };
    const drag = {
      height: 0.14,
      onPick: (b) => { this.poke(); sfx.pop(); this.lookAt(b); },
      onDrop: (b, p) => p.distanceTo(DROP) < 2.8 && give(b), // anywhere near the tray or Chase
      onTap: (b) => { this.poke(); give(b); }, // the fallback: it hops over by itself
    };
    f.pile.forEach((b) => this.draggable(b, drag));
    if (auto) return f;

    // too many: the last ones given hop back to the pile, where they can be given again
    const giveBack = async () => {
      const bone = f.given.pop();
      rings[f.count()]?.material.color.set(PALE);
      const p0 = bone.position.clone(), s0 = bone.scale.x;
      await animate(380, (t) => { bone.position.lerpVectors(p0, bone.userData.home, t); bone.position.y += Math.sin(t * Math.PI); bone.scale.setScalar(s0 + (1.4 - s0) * t); }, ease.linear);
      this.draggable(bone, drag);
    };
    this.onPup = async () => {
      if (f.state !== 'giving') return;
      if (!f.count()) { sfx.bark(); hop(this.pup, 0.5); return; }
      this.poke();
      f.state = 'checking';
      await Promise.all(f.landed); // (a tap while a treat is still flying counts it)
      if (compare && !f.compared) { f.compared = true; await compare(f); }
      if (!this.alive) return;
      const c = f.count();
      if (c === n) { finish(); return; }
      this.wrong(c, { feedback: false }); // a wrong amount: answered here, in words
      if (c < n) { f.state = 'giving'; this.say(T.tooFew()); return; }
      await this.say(T.tooManyBack(c - n));
      while (f.count() > n && this.alive) await giveBack();
      if (!this.alive) return;
      f.state = 'giving';
      this.say(T.nowRight()); // the last tap is hers
    };
    return f;
  }

  /** Chase has the right amount: a cheer and the lines, he eats (bowl treats too), the round clears away. */
  async eatUp(f, lines, more = []) {
    await Promise.all(f.landed);
    await wait(200);
    if (!this.alive) return;
    sfx.good();
    this.success(this.pup.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
    await say(lines);
    if (!this.alive) return;
    await this.gobble([...f.given, ...more]);
    await say(T.yum());
    if (!this.alive) return;
    await Promise.all([...f.rings.filter(Boolean), ...f.pile.filter((b) => !f.given.includes(b))].map((x) => this.shrinkAway(x, 250)));
  }

  // ---------- "give Chase N treats" ----------
  // One-to-one counting with real objects: each treat lands on its own spot on Chase's tray, counted aloud.
  //   slots yes: ghost rings show where the N treats go · no: they just line up (help shows the rings)
  //   auto  yes: done when N are there · no: she decides when to stop and taps Chase
  async giveRound() {
    const n = this.pick('counting', range(...this.L.give));
    this.last = n;
    const auto = this.L.auto;
    const layout = auto ? n : n > 5 ? 10 : Math.max(5, n + 2); // room for a few too many
    const f = this.feed({ n, auto, layout, rings: this.L.slots ? this.makeRings(0, n, layout) : [] });
    let marked = false;
    this.question('counting', n, {
      short: () => (f.count() === 0 ? T.dragTreat() : !auto && f.count() >= n ? T.tapPupWhenDone() : T.treatsDone(n)),
      hint: () => { // rings show the spots still to fill; nothing given yet: a treat hops ("tap me")
        if (!marked && !this.L.slots) { marked = true; this.makeRings(f.count(), n, layout).forEach((r, i) => (f.rings[i] = r)); sfx.pop(); }
        if (f.count() >= n) return T.giveThenTap(n); // (not auto: "then tap Chase")
        if (f.count() > 0) return T.treatsGive(n); // the prompt said "Trzy smakołyki!": the clue says the whole task
        const b = f.next();
        if (b) hop(b, 0.5, 400);
        return T.tapTreat();
      },
      reveal: () => { const b = f.next(), c0 = f.count(); if (b && c0 < n) this.hint(b, () => f.state === 'done' || f.count() > c0); },
    }, { scored: !auto }); // an automatic give can't go wrong: played, not counted

    ui.bubble({ big: String(n), dots: n, pic: '🦴', onTap: () => this.replay(), passthrough: true }); // Chase sits right under it
    wait(400).then(() => { if (this.alive) this.ask(auto ? [...T.treatsGive(n), ...T.dragTreat()] : T.giveThenTap(n)); });
    await f.done;
    if (!this.alive) return;
    this.correct(n);
    this.stopIdle();
    await this.eatUp(f, [...T.treatsDone(n), this.praise()]);
  }

  /** A treat landed by Chase: a little hop and a happy face, every time. */
  pupWags() {
    this.pup.userData.setHappy(0.8);
    hop(this.pup, 0.22, 280);
  }

  // ---------- "everyone gets one" ----------
  // Chase and one to three kittens wait at their plates; she taps whoever is still hungry and a treat flies over,
  // counted aloud. One for each: one-to-one counting. Tapping one who already has a treat is a wrong answer.
  shareRound() {
    return new Promise((resolve) => {
      const [lo, hi] = this.L.share;
      const n = this.pick('counting', range(lo, hi));
      this.last = n;
      const seats = [[1.6, -1.3], [-0.3, -0.8], [3.7, -0.3], [5.0, 0.3]]; // Chase's spot first; none behind the treat box
      this.showTray(false); // everyone gets a plate instead
      const friends = seats.slice(0, n).map(([x, z], i) => {
        const obj = i === 0 ? this.pup : makeKitten(['#fb923c', '#9ca3af', '#f5f5f4'][i - 1]);
        let landed = Promise.resolve();
        if (i > 0) {
          obj.scale.setScalar(1.25);
          obj.position.set(x, 0, z);
          this.scene.add(obj);
          this.onUpdate((dt, t) => obj.userData.idle(t));
          landed = this.dropIn(obj, 0, 150 + i * 220, 600).then(() => sfx.meow());
        }
        const plate = mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.08, 28), mat('#1e40af', { roughness: 0.55 }), { x, y: 0.06, z: z + 1.05 }); // (blue, like Chase's tray: the treat shows)
        plate.userData.tapHeight = 0;
        plate.userData.hungry = true;
        this.scene.add(plate);
        return { obj, plate, landed, kitten: i > 0, fed: false, bone: null };
      });
      let done = false;
      const fed = () => friends.filter((f) => f.fed).length;
      const flights = [];
      const hungryHop = () => friends.filter((f) => !f.fed).forEach((f, i) => Promise.all([f.landed, wait(i * 160)]).then(() => { hop(f.obj, 0.35, 320); if (f.kitten) sfx.meow(); else sfx.bark(); }));
      this.question('counting', n, {
        short: T.shareRule(),
        hint: () => { hungryHop(); return T.shareWho(); },
        simplify: () => { hungryHop(); },
        reveal: () => { const f = friends.find((x) => !x.fed); if (f) this.hint(f.obj, () => f.fed || done); },
      }, { scored: false }); // one each, and the hungry ones hop: it can hardly go wrong (played, not counted)

      const feed = (f) => {
        if (done) return;
        this.poke();
        this.lookAt(f.obj);
        if (f.fed) { this.wrong('fed', { obj: f.obj, said: T.shareHasOne() }); return; }
        f.fed = true;
        f.plate.userData.hungry = false;
        const { bone, flight } = this.flyBone(f.plate.position.clone().setY(0.16));
        f.bone = bone;
        flights.push(Promise.all([flight, f.landed]).then(() => { f.obj.userData.setHappy?.(0.8); hop(f.obj, 0.3, 300); if (f.kitten) sfx.meow(); })); // (a hop mid-drop would leave it in the air)
        say(T.number(fed()));
        if (fed() === n) finish();
      };
      for (const f of friends) {
        if (f.kitten) this.tappable(f.obj, () => feed(f));
        this.tappable(f.plate, () => feed(f));
      }
      this.onPup = () => feed(friends[0]);

      const finish = async () => {
        done = true;
        this.correct(n);
        this.stopIdle();
        this.onPup = null;
        friends.forEach((f) => { this.untap(f.plate); if (f.kitten) this.untap(f.obj); });
        await Promise.all(flights);
        await wait(250);
        if (!this.alive) return;
        sfx.good();
        this.success(this.pup.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
        await say([...T.shareDone(), ...T.treatsDone(n), this.praise()]);
        if (!this.alive) return;
        // everyone eats at once
        await Promise.all(friends.map((f) => {
          const mouth = f.obj.position.clone().add(new THREE.Vector3(0, f.kitten ? 0.9 : 1.3, 0.5));
          const p0 = f.bone.position.clone(), s0 = f.bone.scale.x;
          return animate(260, (t) => { f.bone.position.lerpVectors(p0, mouth, t); f.bone.scale.setScalar(s0 * (1 - t) + 0.001); }, ease.in)
            .then(() => { f.bone.removeFromParent(); sfx.crunch(); hop(f.obj, 0.5, 380); });
        }));
        this.pup.userData.setHappy(2);
        await say(T.shareYum());
        if (!this.alive) return;
        await Promise.all(friends.flatMap((f) => (f.kitten ? [f.obj, f.plate] : [f.plate])).map((x) => this.shrinkAway(x, 300)));
        await this.showTray(true);
        resolve();
      };

      ui.bubble({ dots: n, pic: '🦴', onTap: () => this.replay(), passthrough: true });
      wait(500 + n * 220).then(() => { if (this.alive) this.ask(T.shareStart(n)); });
    });
  }

  /** Chase's tray goes away for "share" (everyone gets a plate) and comes back after. */
  showTray(on) {
    const s0 = this.tray.scale.x, s1 = on ? 1 : 0.001;
    if (s0 === s1) return Promise.resolve();
    if (on) this.tray.visible = true;
    return animate(300, (t) => this.tray.scale.setScalar(s0 + (s1 - s0) * t), on ? ease.back : ease.in).then(() => { if (!on) this.tray.visible = false; });
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
  // The bones lie on Chase's tray in rows of five, she counts them (a tap counts one aloud) and picks the numeral.
  // Right: Chase eats them one by one while they are counted again, and the last number is hers (cardinality).
  async howManyRound() {
    const n = this.pick('quantity', range(...this.L.howMany));
    this.last = n;
    const layout = n > 5 ? 10 : n;
    const bones = [];
    let tapCount = 0, solved = false, lastWrong = null;
    // bones tumble in (no counting aloud: that's her job)
    for (let i = 0; i < n; i++) {
      wait(300 + i * 220).then(() => {
        if (!this.alive) return;
        const { bone } = this.flyBone(this.slotPos(i, layout));
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
    // numeral blocks to choose from, in a row in front of the tray
    let chosen;
    const right = new Promise((resolve) => (chosen = resolve));
    const max = Math.max(this.L.howMany[1] + 1, n + 1);
    const colors = shuffle(TILE_COLORS);
    const blocks = numberChoices(n, max, 3, true).map((num, i) => {
      const m = new THREE.MeshStandardMaterial({ map: glyphTexture(String(num), { bg: colors[i], dots: this.L.slots ? num : 0 }), roughness: 0.45 }); // (the helping hand: dots too)
      const b = new THREE.Mesh(rbox(BLOCK, BLOCK, BLOCK, 0.13), m);
      b.castShadow = true;
      b.position.set(TRAY.x + (i - 1) * 1.6, BLOCK / 2, BLOCK_Z);
      b.rotation.y = (Math.random() - 0.5) * 0.3;
      b.userData.num = num;
      b.userData.tapHeight = 0;
      this.scene.add(b);
      this.shadowUnder(b, 0.7, 0.3);
      this.dropIn(b, BLOCK / 2, 300 + n * 220 + i * 120).then(() => sfx.pop());
      this.tappable(b, () => {
        if (solved) return;
        this.poke();
        this.lookAt(b);
        if (num === n) { solved = true; chosen(b); return; }
        lastWrong = b;
        this.wrong(num, { obj: b });
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
    }, { options: blocks.length });

    ui.bubble({ big: '?', pic: '🦴', onTap: () => this.replay() });
    wait(400 + n * 220).then(() => { if (this.alive) this.ask(T.howMany()); });

    const b = await right;
    this.correct(n);
    this.stopIdle();
    blocks.forEach((x) => this.untap(x));
    bones.forEach((x) => this.untap(x));
    sfx.good();
    this.success(b.position.clone().add(new THREE.Vector3(0, 1, 0)));
    await say(T.yes());
    if (!this.alive) return;
    blocks.filter((x) => x !== b && x.parent).forEach((x) => this.shrinkAway(x, 300));
    // count together as he eats: one bone, one number; the last number lands on her block
    this.lookAt(this.pup.position.clone().add(new THREE.Vector3(0, 1.3, 0.6)));
    for (let k = 0; k < bones.length; k++) {
      this.chomp(bones[k]);
      this.pupWags();
      await say(T.number(k + 1));
      if (!this.alive) return;
    }
    hop(b, 0.6, 500);
    sparkle(this, b.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { count: 14 });
    this.pup.userData.setHappy(2);
    await say([...T.treatsDone(n), ...T.yum()]);
    if (!this.alive) return;
    await this.shrinkAway(b, 300);
  }

  // ---------- "flash" and "hidden": as many as under the bowl ----------
  // A plate with Chase's red bowl upside down over it. flash: the bowl lifts for two seconds over 1–4 treats laid
  // out like a die (seen at a glance), then covers them. hidden: some treats go onto the plate, the bowl covers
  // them and one more slides in under it (adding without words). Then she gives Chase the same number and taps
  // him: the bowl lifts and its treats line up on the tray, one under each of hers, so she sees if it's the same.
  flashRound() { return this.bowlRound('flash'); }
  hiddenRound() { return this.bowlRound('hidden'); }

  /** The plate and the bowl. bowl.userData.to(pose) moves the bowl: 'shut', 'peek' (back edge up), 'aside'. */
  makeDish() {
    const dish = new THREE.Group();
    dish.add(mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.08, 40), mat('#1e40af', { roughness: 0.55 }), { y: 0.04 }));
    const bowl = new THREE.Group();
    const red = mat('#e23b3b', { roughness: 0.35, side: THREE.DoubleSide });
    bowl.add(mesh(new THREE.SphereGeometry(0.82, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), red, { s: [1, 0.85, 1] }));
    bowl.add(mesh(new THREE.TorusGeometry(0.82, 0.05, 8, 40), mat('#b91c1c', { roughness: 0.4 }), { rx: Math.PI / 2 }));
    bowl.add(mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.1, 24), red, { y: 0.72 })); // its foot, now on top
    const poses = {
      shut: { p: [0, 0.08, 0], rx: 0 },
      peek: { p: [0, 0.08 + 0.82 * Math.sin(0.45), 0], rx: 0.45 }, // the back lifts, the front stays down: nothing shows
      aside: { p: [-1.75, 0.04, -0.15], rx: 0 },
    };
    bowl.userData.to = (pose, ms = 450) => {
      const a = bowl.position.clone(), rx0 = bowl.rotation.x, { p, rx } = poses[pose];
      const b = new THREE.Vector3(...p), up = a.distanceTo(b) > 1 ? 1.1 : 0;
      return animate(ms, (t) => { bowl.position.lerpVectors(a, b, t); bowl.position.y += Math.sin(t * Math.PI) * up; bowl.rotation.x = rx0 + (rx - rx0) * t; }, ease.inOut);
    };
    bowl.position.set(...poses.shut.p);
    dish.add(bowl);
    dish.userData.bowl = bowl;
    dish.position.copy(DISH);
    this.scene.add(dish);
    return dish;
  }

  async bowlRound(kind) {
    const n = this.pick('quantity', range(...this.L[kind]));
    this.last = n;
    const dish = this.makeDish(), bowl = dish.userData.bowl;
    const under = []; // the treats on the plate, under the bowl
    const lay = () => under.forEach((b, i) => { const [x, z] = DICE[under.length][i]; b.position.set(x, 0.18, z); b.rotation.set(0, 0, 0); });
    const onPlate = () => { const b = makeBone(1.05); dish.add(b); under.push(b); return b; };
    ui.bubble({ big: '?', pic: '🦴', onTap: () => this.replay(), passthrough: true });
    await this.dropIn(dish, 0, 0, 600);
    sfx.pop();
    if (kind === 'flash') {
      for (let i = 0; i < n; i++) onPlate();
      lay();
      await this.say(T.flashStart());
      if (!this.alive) return;
      await bowl.userData.to('aside');
      await wait(2000);
      await bowl.userData.to('shut');
    } else {
      await bowl.userData.to('aside', 1);
      await this.say(T.lookCarefully());
      for (let i = 0; i < n - 1; i++) { // they land where she can see them; no counting aloud
        if (!this.alive) return;
        const b = onPlate();
        const [x, z] = DICE[n - 1][i], to = new THREE.Vector3(x, 0.18, z), from = this.box.position.clone().sub(DISH).setY(1.8);
        b.position.copy(from);
        await animate(480, (t) => { b.position.lerpVectors(from, to, t); b.position.y += Math.sin(t * Math.PI) * 1.4; }, ease.linear);
        sfx.crunch();
        await wait(250);
      }
      await wait(600);
      await bowl.userData.to('shut');
      sfx.pop();
      if (!this.alive) return;
      this.say(T.hiddenMore());
      await bowl.userData.to('peek', 300);
      const b = onPlate(), from = this.box.position.clone().sub(DISH).setY(1.8), to = new THREE.Vector3(0, 0.18, -0.6);
      b.position.copy(from);
      await animate(560, (t) => { b.position.lerpVectors(from, to, t); b.position.y += Math.sin(t * Math.PI) * 1.8; }, ease.linear);
      lay(); // (under the bowl: they shuffle into a die's pattern, for when it lifts)
      await bowl.userData.to('shut', 300);
      sfx.crunch();
    }
    if (!this.alive) return;

    let open = false;
    const show = async (stay) => { // the bowl lifts: for two seconds, or for good
      if (open) return;
      open = true;
      await bowl.userData.to('aside');
      if (stay) return;
      await wait(2000);
      if (!this.alive || f.state === 'checking') return;
      await bowl.userData.to('shut');
      open = false;
    };
    const f = this.feed({
      n, layout: 5,
      compare: async () => { // the bowl's treats line up under hers, one each
        this.say(T.checkBowl());
        open = true;
        await bowl.userData.to('aside');
        for (const [j, b] of under.entries()) {
          if (!this.alive) return;
          const p0 = b.getWorldPosition(new THREE.Vector3()), to = this.slotPos(j + 5, 10);
          this.scene.attach(b);
          await animate(380, (t) => { b.position.lerpVectors(p0, to, t); b.position.y += Math.sin(t * Math.PI) * 0.8; b.scale.setScalar(1.05 + (ON_TRAY - 1.05) * t); }, ease.inOut);
          b.rotation.set(0, LIE, 0);
          sfx.pop();
        }
        await wait(500);
      },
    });
    const ask = [...(kind === 'flash' ? T.flashAsk() : T.hiddenAsk()), ...T.sameForPup()];
    this.question('quantity', n, {
      short: () => (f.count() === 0 ? ask : T.tapPupWhenDone()),
      hint: () => { wait(700).then(() => show(false)); return T.lookAgain(); },
      reveal: () => { show(true); },
    });
    this.ask(ask);
    await f.done;
    if (!this.alive) return;
    this.correct(n);
    this.stopIdle();
    await this.eatUp(f, [...T.same(), ...T.treatsDone(n), this.praise()], under);
    if (this.alive) await this.shrinkAway(dish, 300);
  }
}
