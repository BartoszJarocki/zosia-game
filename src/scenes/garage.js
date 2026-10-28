import * as THREE from 'three';
import { animate, ease, wait, hop } from '../engine.js';
import { mesh, mat, rbox } from '../models.js';
import { makeBush } from '../world/nature.js';
import { sparkle } from '../fx/particles.js';
import { say, sfx } from '../audio.js';
import * as ui from '../ui.js';
import { shuffle } from '../util.js';
import { T } from '../lang/pl.js';
import { SHAPES, shapePieces, patternRound, sortRound, basketFor } from '../levels/garage.js';
import { makeGarage, makeGarageCruiser, makeDoorBoard, makeShapePiece, makeBunting, makePennant, makeGhostPennant, makeFlagStand, makeBasket, makeBlock, shapeSVG, blockSVG, COLOUR_HEX } from '../world/garage-props.js';
import { Mission } from './mission.js';

// "The Garage" (Garaż): Chase's cruiser is in for repairs. Three jobs take turns, one per round (GAME.md `modes`):
//   shapes   the cruiser's door has shaped holes: put the right piece in (drag it, or tap it)        (shape)
//   pattern  the flags on the line go red, blue, red, blue…: which one comes next / is missing?    (pattern)
//   sort     blocks one at a time into two baskets, by colour or by size (drag it, or tap a basket) (sorting)
// Colours are named every time. What lies where comes from src/levels/garage.js; this file draws and animates it.

const FRONT_Z = 2.7;    // the things to choose from
const MIDDLE_Z = -0.8;  // the door, the flag line, the baskets
const GARAGE_Z = -6.2;
const across = (n, gap) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * gap);
const SLATE = '#334155'; // the bubble's shape: the colour of the hole, so the shape is the clue, not the colour

export class GarageMission extends Mission {
  constructor(game) {
    super(game, 'garage');
    this.view = { pos: new THREE.Vector3(0, 4.9, 12.4), look: new THREE.Vector3(0, 1.5, -0.4), minWidth: 14 };
    this.post = { tilt: 0.4, focus: 0.42, band: 0.3 };
  }

  build() {
    this.meadow({ clear: [[0, -1, 8.5]], treeRing: [13, 21] });
    this.scene.add(mesh(rbox(14, 0.04, 9.5, 0.02), mat('#d6d3d1', { roughness: 0.95 }), { y: 0.02, z: -1.3, shadow: false })); // the yard
    const garage = makeGarage();
    garage.position.z = GARAGE_Z;
    this.scene.add(garage);
    this.cruiser = makeGarageCruiser();
    this.cruiser.position.set(0, 0.1, GARAGE_Z - 0.2);
    this.scene.add(this.cruiser);
    this.onUpdate((dt, t) => this.cruiser.userData.update(t, 0));
    for (const [x, z] of [[-8, -3.5], [8, -3.5], [-8.5, -0.5], [8.5, -0.5]]) { const b = makeBush({ seed: Math.round(x * 3 + z) }); b.position.set(x, 0, z); this.scene.add(b); }
    this.addHeroes(new THREE.Vector3(-5.6, 0, 1.9), 0.55, new THREE.Vector3(5.6, 0, 1.7), -0.55);
  }

  round(r) {
    const mode = this.L.modes[r % this.L.modes.length];
    const first = r < this.L.modes.length; // the first time this job comes up in this visit: say what it is
    return { shapes: () => this.doorRound(first), pattern: () => this.flagsRound(first), sort: () => this.blocksRound(first) }[mode]();
  }

  async outro() {
    this.cruiser.userData.setFlashing(true); // mended: it flashes all through the celebration
    sfx.honk();
    await hop(this.cruiser, 0.3, 500);
  }

  // ---------- the door: put each shape in its hole ----------
  async doorRound(first) {
    const mode = this.L.shapes;
    const pieces = shapePieces(mode);
    const firstAsk = this.pick('shape', SHAPES);
    const asks = mode === 'shown' ? [firstAsk] : [firstAsk, this.pick('shape', SHAPES.filter((s) => s !== firstAsk))];
    const odd = (shape) => pieces.find((p) => p.shape === shape).odd;
    const board = makeDoorBoard((mode === 'shown' ? asks : shuffle(SHAPES)).map((shape) => ({ shape, odd: odd(shape) })));
    board.position.set(0, 1.85, MIDDLE_Z);
    this.scene.add(board);
    this.dropIn(board, 1.85, 0, 650).then(() => sfx.pop());
    const xs = across(3, 2.45);
    const objs = pieces.map((p, i) => {
      const o = makeShapePiece(p);
      const y = 0.72 * p.size;
      o.userData.home = new THREE.Vector3(xs[i], y, FRONT_Z);
      o.position.copy(o.userData.home);
      o.rotation.x = -0.12;
      o.userData.choice = p.shape;
      o.userData.tapHeight = 0;
      this.scene.add(o);
      o.userData.shadow = this.shadowUnder(o, 0.75 * p.size, 0.3);
      this.dropIn(o, y, 250 + i * 130).then(() => sfx.pop());
      return o;
    });
    await wait(700);
    for (let k = 0; k < asks.length && this.alive; k++) await this.askShape(asks[k], { board, objs, mode, intro: first && k === 0 });
    if (!this.alive) return;
    const last = objs.find((o) => !o.userData.placed);
    if (mode !== 'shown' && last) { // the last piece has only one place left: it hops in by itself
      await say(T.shapeLast(last.userData.choice));
      if (!this.alive) return;
      await this.fitPiece(last, board);
    }
    objs.filter((o) => !o.userData.placed).forEach((o) => this.shrinkAway(o, 350));
    sfx.good();
    sparkle(this, board.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0.5)), { count: 26 });
    this.cheer(2);
    await say(T.doorFixed());
    if (!this.alive) return;
    // the mended door goes back onto the cruiser
    const from = board.position.clone(), to = this.cruiser.position.clone().add(new THREE.Vector3(0, 1.1, 1.2));
    sfx.whoosh();
    await animate(800, (t) => {
      board.position.lerpVectors(from, to, t);
      board.position.y += Math.sin(t * Math.PI) * 1.5;
      board.scale.setScalar(Math.max(0.001, 1 - t * 0.8));
    }, ease.inOut);
    board.removeFromParent();
    this.cruiser.userData.setFlashing(true);
    sfx.honk();
    await hop(this.cruiser, 0.25, 420);
    this.cruiser.userData.setFlashing(false);
  }

  /** One question: "Gdzie jest kwadrat?" (or, with one hole, "Który kształt pasuje? Koło!"). Resolves when it fits. */
  askShape(target, { board, objs, mode, intro }) {
    return new Promise((resolve) => {
      const shown = mode === 'shown';
      const hole = board.userData.holes.find((h) => h.shape === target);
      const live = () => objs.filter((o) => !o.userData.placed && !o.userData.gone);
      const right = objs.find((o) => o.userData.choice === target);
      let solved = false, lastWrong = null;
      this.last = target;
      this.item('G:' + target);
      const choose = async (o) => {
        if (solved) return;
        this.poke();
        this.lookAt(o);
        if (o === right) {
          solved = true;
          this.correct(target);
          this.stopIdle();
          live().forEach((x) => this.untap(x));
          sfx.good();
          await this.fitPiece(o, board);
          if (!this.alive) return;
          this.success(board.localToWorld(hole.at.clone()).add(new THREE.Vector3(0, 0.4, 0.4)));
          await say([this.praise(), ...T.shape(target)]); // "Brawo! Koło!"
          resolve();
        } else {
          lastWrong = o;
          this.wrong(o.userData.choice, { obj: o, said: T.noShape(o.userData.choice) }); // "Nie, to trójkąt."
          if (o.position.distanceTo(o.userData.home) > 0.1) this.jumpTo(o, o.userData.home, { height: 0.5, ms: 350 });
        }
      };
      for (const o of live()) {
        this.draggable(o, {
          height: o.userData.home.y,
          lift: 0.4,
          onPick: () => { this.poke(); sfx.pop(); },
          onDrop: (x, at) => (at.z < FRONT_Z - 1.2 ? (choose(o), true) : false), // carried up towards the door
          onTap: () => choose(o), // the fallback: tapping a piece tries it
        });
      }
      const picture = () => ui.bubble({ big: shapeSVG(target, SLATE, hole.odd), pic: '🔧', onTap: () => this.replay() });
      if (shown) picture(); else ui.bubble({ big: '', pic: '🔧', onTap: () => this.replay() });
      const prompt = shown ? [...T.shapeFits(), ...T.shape(target)] : T.whereShape(target);
      const clue = () => { picture(); this.glow(hole.plug, () => solved); }; // the shape in the bubble, its hole lights up
      this.question('shape', target, {
        short: prompt,
        hint: () => { clue(); return T.shapeClue(target); }, // "Kwadrat ma cztery rogi!"
        // with one hole a wrong piece can go; with a hole for each, every piece is still needed: the clue instead
        simplify: () => (shown ? this.removeOption(lastWrong?.parent ? lastWrong : live().find((o) => o !== right)) : clue()),
        reveal: () => this.hint(right, () => solved),
      }, { options: live().length });
      this.ask(intro ? [...T.doorBroken(), ...prompt] : prompt);
    });
  }

  /** The piece flies into its hole, turning upright and to the hole's size, and stays in the door. */
  async fitPiece(o, board) {
    o.userData.placed = true;
    o.userData.shadow.visible = false; // (it rides with the door now)
    this.untap(o);
    const hole = board.userData.holes.find((h) => h.shape === o.userData.choice);
    const to = board.localToWorld(hole.at.clone());
    const from = o.position.clone(), s0 = o.scale.x, turn0 = o.userData.body.rotation.z, lean0 = o.rotation.x;
    sfx.whoosh();
    await animate(560, (t) => {
      o.position.lerpVectors(from, to, t);
      o.position.y += Math.sin(t * Math.PI) * 1.2;
      o.scale.setScalar(s0 + (1 - s0) * t);
      o.userData.body.rotation.z = turn0 * (1 - t);
      o.rotation.x = lean0 * (1 - t);
    }, ease.inOut);
    board.attach(o); // it rides with the door from now on
    sfx.crunch();
    sfx.ding();
  }

  /** A hole's dark backing lights up yellow until isDone(). */
  glow(plug, isDone) {
    const m = plug.material;
    if (m.userData.glowing) return;
    m.userData.glowing = true;
    const off = this.onUpdate((dt, t) => {
      if (isDone() || !plug.parent) { off(); m.userData.glowing = false; m.color.set('#1f2937'); m.emissive.set('#000000'); return; }
      m.color.set('#fde047');
      m.emissive.set('#facc15');
      m.emissiveIntensity = 0.5 + 0.4 * Math.sin(t * 6);
    });
  }

  // ---------- the flags: which comes next? ----------
  flagsRound(first) {
    return new Promise((resolve) => {
      const p = patternRound(this.L.pattern);
      const bunting = makeBunting(p.row.length);
      const { hooks, line } = bunting.userData;
      bunting.position.z = MIDDLE_Z;
      this.scene.add(bunting);
      this.dropIn(bunting, 0, 0, 600).then(() => sfx.pop());
      const hung = p.row.map((c, i) => {
        const f = i === p.gap ? makeGhostPennant() : makePennant(c);
        f.position.copy(hooks[i]);
        f.scale.setScalar(0.001);
        line.add(f);
        wait(650 + i * 90).then(() => animate(260, (t) => f.scale.setScalar(0.001 + t), ease.back));
        return f;
      });
      const ghost = hung[p.gap];
      const breathe = this.onUpdate((dt, t) => { if (ghost.parent) ghost.rotation.z = Math.sin(t * 2.6) * 0.12; });
      const xs = across(3, 2.45);
      let solved = false, lastWrong = null;
      const stands = p.choices.map((c, i) => {
        const s = makeFlagStand(c);
        s.userData.home = new THREE.Vector3(xs[i], 0, FRONT_Z);
        s.position.copy(s.userData.home);
        s.userData.choice = c;
        s.userData.tapHeight = 1.4;
        this.scene.add(s);
        this.shadowUnder(s, 0.45, 0.3);
        this.dropIn(s, 0, 900 + i * 130).then(() => sfx.pop());
        return s;
      });
      const right = stands.find((s) => s.userData.choice === p.answer);
      this.last = p.answer;
      this.item('G:' + p.item);

      const choose = async (s) => {
        if (solved) return;
        this.poke();
        this.lookAt(s);
        if (s === right) {
          solved = true;
          this.correct(p.answer);
          this.stopIdle();
          stands.forEach((x) => this.untap(x));
          sfx.good();
          // the flag leaves its stand and hangs in the gap
          const flag = s.userData.flag;
          line.attach(flag);
          const from = flag.position.clone(), s0 = flag.scale.x, to = hooks[p.gap];
          await animate(560, (t) => {
            flag.position.lerpVectors(from, to, t);
            flag.position.y += Math.sin(t * Math.PI) * 0.8;
            flag.scale.setScalar(s0 + (1 - s0) * t);
          }, ease.inOut);
          ghost.removeFromParent();
          breathe();
          hung[p.gap] = flag;
          sfx.ding();
          this.success(line.localToWorld(to.clone()).add(new THREE.Vector3(0, -0.4, 0.3)));
          stands.forEach((x) => this.shrinkAway(x, 300));
          await say([this.praise(), ...T.flag(p.answer)]);
          if (!this.alive) return;
          await this.chant(p.row, hung); // the whole row, flag by flag: "Czerwona! Niebieska! Czerwona!…"
          if (!this.alive) return;
          await this.hangOnGarage(bunting);
          resolve();
        } else {
          lastWrong = s;
          this.wrong(s.userData.choice, { obj: s, said: T.noFlag(s.userData.choice) }); // "Nie, ta jest żółta."
          if (s.position.distanceTo(s.userData.home) > 0.1) this.jumpTo(s, s.userData.home, { height: 0.5, ms: 350 });
        }
      };
      for (const s of stands) {
        this.draggable(s, {
          height: 0,
          lift: 0.5,
          onPick: () => { this.poke(); sfx.pop(); },
          onDrop: (x, at) => (at.z < FRONT_Z - 1.2 ? (choose(s), true) : false), // carried up towards the line
          onTap: () => choose(s),
        });
      }
      const foil = stands.find((s) => !p.row.includes(s.userData.choice));
      const short = p.item === 'gap' ? T.flagGap() : T.flagNext();
      ui.bubble({ big: patternSVG(p.row, p.gap), pic: '', onTap: () => this.replay() });
      this.question('pattern', p.item, {
        short,
        hint: () => this.chant(p.row, hung, p.gap).then(() => this.alive && !solved && this.say(short)), // say the row aloud: the rhythm is the clue
        simplify: () => this.removeOption(lastWrong?.parent && lastWrong !== right ? lastWrong : foil),
        reveal: () => this.hint(right, () => solved, right.userData.flag),
      }, { options: stands.length });
      wait(1500).then(() => { if (this.alive) this.ask(first ? [...T.flagsStart(), ...short] : short); });
    });
  }

  /** Say the row flag by flag, each one bobbing as it is named. skip: the empty place (a beat of silence). */
  async chant(row, flags, skip = -1) {
    for (let i = 0; i < row.length && this.alive; i++) {
      const f = flags[i];
      const s0 = f.scale.x;
      animate(320, (t) => { f.rotation.z = Math.sin(t * Math.PI * 2) * 0.25; f.scale.setScalar(s0 * (1 + Math.sin(t * Math.PI) * 0.18)); }, ease.linear);
      if (i === skip) { sfx.bubble(); await wait(700); continue; }
      await this.say(T.flag(row[i]));
    }
  }

  /** The finished flags go up over the garage door and stay there for the rest of the visit. */
  async hangOnGarage(bunting) {
    const { line, posts } = bunting.userData;
    posts.forEach((p) => this.shrinkAway(p, 300));
    const n = (this.linesHung = (this.linesHung || 0) + 1); // (a long visit can hang a second line, a little higher)
    const from = line.position.clone(), to = new THREE.Vector3(0, 0.95 + (n - 1) * 0.45, GARAGE_Z + 2.2 - MIDDLE_Z);
    const s0 = line.scale.x;
    await animate(800, (t) => { line.position.lerpVectors(from, to, t); line.scale.setScalar(s0 + (0.85 - s0) * t); }, ease.inOut);
  }

  // ---------- the blocks: into the right basket ----------
  async blocksRound(first) {
    const s = sortRound(this.L.sort);
    const baskets = s.baskets.map((b, i) => {
      const o = makeBasket(b.colour, b.size);
      o.position.set(across(2, 4.8)[i], 0, MIDDLE_Z + 0.4);
      o.userData.choice = [b.colour, b.size].filter(Boolean).join('-');
      o.userData.tapHeight = 0.5;
      this.scene.add(o);
      this.shadowUnder(o, 1.2 * o.scale.x, 0.3);
      this.dropIn(o, 0, i * 150).then(() => sfx.pop());
      return o;
    });
    // the blocks wait on a pallet by Chase, who hands them out one at a time
    const pallet = mesh(rbox(2.3, 0.2, 2.1, 0.05), mat('#b7773f', { roughness: 0.9 }), { x: 3.4, y: 0.1, z: 3.3 });
    this.scene.add(pallet);
    const blocks = s.blocks.map((b, i) => {
      const o = makeBlock(b.colour, b.size);
      o.position.set(2.88 + (i % 2) * 1.05, 0.2 + o.userData.half, 2.8 + Math.floor(i / 2) * 1.0); // two by two
      o.rotation.y = (i - 1.5) * 0.12;
      this.scene.add(o);
      o.userData.shadow = this.shadowUnder(o, o.userData.half * 1.3, 0.28);
      this.dropIn(o, 0.2 + o.userData.half, 400 + i * 110).then(() => sfx.pop());
      return o;
    });
    await wait(900);
    for (let k = 0; k < blocks.length && this.alive; k++) {
      if (k > 0 && s.blocks[k].rule !== s.blocks[k - 1].rule) await this.switchRule(baskets, s.baskets);
      if (!this.alive) return;
      await this.sortBlock(s.blocks[k], blocks[k], { baskets, kinds: s.baskets, intro: first && k === 0, firstBlock: k === 0 });
    }
    if (!this.alive) return;
    sfx.good();
    this.cheer(2);
    baskets.forEach((b, i) => wait(i * 120).then(() => hop(b, 0.3)));
    await say(T.tidied());
    await Promise.all([pallet, ...baskets].map((o) => this.shrinkAway(o, 400)));
  }

  /** One block: it comes to the front, is named ("Czerwony klocek!"), and goes into a basket. */
  sortBlock(block, obj, { baskets, kinds, intro, firstBlock }) {
    return new Promise((resolve) => {
      const value = block[block.rule];
      const right = basketFor(block, kinds);
      const home = new THREE.Vector3(0, obj.userData.half, FRONT_Z);
      let solved = false, lastWrong = null;
      this.last = baskets[right].userData.choice;
      this.item('G:' + value);
      obj.rotation.y = 0;
      this.jumpTo(obj, home, { height: 1, ms: 450 }).then(() => sfx.pop());

      const choose = async (i) => {
        if (solved) return;
        this.poke();
        this.lookAt(baskets[i]);
        if (i === right) {
          solved = true;
          this.correct(value);
          this.stopIdle();
          baskets.forEach((b) => this.untap(b));
          this.untap(obj);
          const b = baskets[right];
          const from = obj.position.clone(), to = b.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4 * b.scale.x, 0.35 * b.scale.x + obj.userData.half * 0.5, (Math.random() - 0.5) * 0.3));
          await animate(520, (t) => {
            obj.position.lerpVectors(from, to, t);
            obj.position.y += Math.sin(t * Math.PI) * 1.4;
            obj.rotation.z = t * 0.6;
          }, ease.inOut);
          b.attach(obj);
          obj.userData.shadow.visible = false;
          sfx.crunch();
          hop(b, 0.2, 300);
          this.success(to.clone().add(new THREE.Vector3(0, 0.6, 0)));
          await say([...this.yes(), ...T.into(block.rule, value)]); // "Tak! Czerwony do czerwonego!"
          resolve();
        } else {
          lastWrong = i;
          this.wrong(value, { obj: baskets[i], said: T.noBasket(block.rule, kinds[i][block.rule]) }); // "Nie, ten koszyk jest niebieski."
          if (obj.position.distanceTo(home) > 0.1) this.jumpTo(obj, home, { height: 0.5, ms: 350 });
        }
      };
      baskets.forEach((b, i) => this.tappable(b, () => choose(i))); // tapping a basket = putting the block in it
      this.draggable(obj, {
        height: obj.userData.half,
        lift: 0.5,
        onPick: () => { this.poke(); sfx.pop(); },
        // forgiving: carried up towards the baskets → into the one nearest left-to-right
        onDrop: (o, at) => {
          if (at.z > FRONT_Z - 1) return false;
          const near = baskets.map((b, i) => [Math.abs(b.position.x - at.x), i]).sort((a, b) => a[0] - b[0])[0];
          if (near[0] > 2.6) return false;
          choose(near[1]);
          return true;
        },
        onTap: () => { this.poke(); hop(obj, 0.3); }, // (a tap on the block: it just wiggles; tap a basket instead)
      });

      const named = T.block(block.rule, value); // "Czerwony klocek!" / "Mały klocek!"
      ui.bubble({ big: blockSVG(block.colour, block.rule === 'size' ? block.size : 'big'), pic: '🧺', onTap: () => this.replay() });
      this.question('sorting', value, {
        short: [...named, ...T.whichBasket()],
        hint: () => T.into(block.rule, value), // the rule is the clue: "Duży do dużego!"
        simplify: () => { hop(baskets[right], 0.35); return T.into(block.rule, value); },
        reveal: () => this.hint(baskets[right], () => solved),
      }, { options: baskets.length });
      wait(500).then(() => { if (this.alive) this.ask([...(intro ? T.blocksStart() : []), ...named, ...(firstBlock ? T.whichBasket() : [])]); });
    });
  }

  /** The switch: Chase barks, the baskets bob big and small, "Teraz duże i małe! Duży do dużego, mały do małego!" */
  async switchRule(baskets, kinds) {
    sfx.bark();
    hop(this.pup, 0.6);
    this.pup.userData.setHappy(2);
    kinds.forEach((k, i) => wait(k.size === 'big' ? 300 : 900).then(() => hop(baskets[i], k.size === 'big' ? 0.5 : 0.3, 450)));
    await this.say(T.sortSwitch());
  }
}

/** The flag row for the speech bubble: little pennants, and a "?" where one is missing. */
function patternSVG(row, gap) {
  const w = 1.1;
  const flags = row.map((c, i) => (i === gap
    ? `<text x="${i * w + 0.55}" y="0.95" text-anchor="middle" font-size="1" font-weight="700" fill="#f59e0b" font-family="Fredoka, sans-serif">?</text>`
    : `<polygon points="${i * w + 0.1},0.1 ${i * w + 1},0.1 ${i * w + 0.55},1.15" fill="${COLOUR_HEX[c]}" stroke="#fff" stroke-width="0.08" stroke-linejoin="round"/>`)).join('');
  return `<svg viewBox="0 0 ${row.length * w} 1.25" height="0.5em" width="${(row.length * w * 0.5) / 1.25}em" aria-hidden="true">${flags}</svg>`;
}
