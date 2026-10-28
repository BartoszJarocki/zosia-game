import * as THREE from 'three';
import { Stage, addSkyAndLights, wait, hop, animate, ease, post, shakeNo } from '../engine.js';
import { mat, mesh } from '../models.js';
import { makeGirl, makePup } from '../characters.js';
import { groundMat } from '../scenery.js';
import { makeTree, makeCloud, makeHills, makeMeadowDetail, makeButterfly, makeBird, contactShadow } from '../world/nature.js';
import { sparkle, fireworks } from '../fx/particles.js';
import { CONFIG } from '../config.js';
import { T, PRAISE } from '../lang/pl.js';
import { say, sfx, hush } from '../audio.js';
import { settingsFor, isLookalike } from '../levels.js';
import { learning } from '../learning/events.js';
import { QuestionTracker } from '../learning/question.js';
import { createAssist, onIdle, onWrong, onActivity, TIMING } from '../learning/assist.js';
import { isBounce } from '../input/bounce.js';
import { levelFor, recordMission, recordItem, pickItem } from '../progress.js';
import { missionDone, replayed, checkAttention } from '../session/session.js';
import { onMissionComplete } from '../adventure/rewards.js';

/** Item mixes (see learning/scheduler.js): tired → nothing new; winding down → something she knows. */
const TIRED_MIX = { learning: 0.6, familiar: 0.4 };
export const EASY_MIX = { familiar: 1, learning: 0.15 };
import { maxLevel } from '../levels/data.js';
import * as ui from '../ui.js';
import { pick } from '../util.js';

/** How much grass the device can take. */
export const detail = () => ({ low: 0.3, medium: 0.6, high: 1 }[post.tier] ?? 0.6);

/**
 * Shared flow: N rounds → progress paws → optional outro → celebration + badge (+ level up).
 * Subclasses call this.miss() on a wrong tap and this.item('L:A') to name what the round was about;
 * the base class works out first-try accuracy for levelling and per-letter/number stats.
 */
export class Mission extends Stage {
  constructor(game, kind) {
    super();
    this.post = { tilt: 0.35, focus: 0.45, band: 0.3 };
    this.game = game;
    this.kind = kind;
    this.level = levelFor(kind);
    this.L = settingsFor(kind);
    this.rounds = this.L.rounds ?? 3; // GAME.md "rounds" column (Name Train: the word's letters)
    this.cheerUntil = 0;
    this.walking = false;
    this.prompt = '';
    this.firstTry = 0;
    this.learn = new QuestionTracker(learning); // turns this mission's taps into learning events
    this.roundIndex = 0;
    this.bubbleAt = 'middle'; // 'left' keeps the top middle of the scene in view
  }

  enter() {
    this.build();
    ui.missionHud({ rounds: this.rounds, level: this.level, total: maxLevel(this.kind), bubbleAt: this.bubbleAt, onHome: () => { hush(); this.game.hub(); } });
    this.onUpdate(() => this.tickAssist());
    this.onUpdate((dt, t) => {
      if (this.pup) this.pup.userData.idle(t);
      if (this.girl) {
        if (t < this.cheerUntil) this.girl.userData.cheer(t);
        else if (this.walking) this.girl.userData.walk(t);
        else this.girl.userData.idle(t);
      }
    });
    this.run();
  }

  exit() { this.aid = null; this.learn.cancel(); }

  async run() {
    await wait(500);
    for (let r = 0; r < this.rounds; r++) {
      if (!this.alive) return;
      this.missed = false;
      this.roundItem = null;
      this.roundIndex = r;
      await this.round(r);
      this.learn.cancel(); // anything left open in this round is dropped
      if (!this.alive) return;
      if (!this.missed) this.firstTry++;
      if (this.roundItem) recordItem(this.roundItem, !this.missed);
      this.stopIdle();
      ui.setProgress(r + 1);
      sfx.pop();
      await wait(450);
      if (this.alive) await this.checkAttention(r);
    }
    if (!this.alive) return;
    await this.outro();
    if (this.alive) this.finish();
  }

  async outro() {}

  /**
   * Between rounds (always right after a success): if she seems tired, ask nothing new; if it's time
   * to stop, the next round is the last one — an easy one, announced with "Jeszcze tylko jedno!".
   */
  async checkAttention(r) {
    const state = checkAttention();
    if (state === 'ok' || this.windingDown) return;
    if (state === 'tired') { this.easyMix ||= TIRED_MIX; return; }
    this.easyMix = EASY_MIX;
    if (r >= this.rounds - 1 || !this.canWindDown) return; // the mission ends now anyway (or can't be cut short)
    this.windingDown = true;
    this.rounds = r + 2;
    ui.setRounds(this.rounds);
    await this.say(T.oneMore());
  }
  /** Can this mission be cut short? (Name Train: the word has to be finished.) */
  get canWindDown() { return true; }

  async finish() {
    ui.hideBubble();
    const got = ui.badges.add(this.kind);
    // (a deliberately easy run, like the session finale, doesn't count towards the mission's level)
    const { level, levelUp } = this.countsForLevel === false ? { level: this.level, levelUp: false } : recordMission(this.kind, this.firstTry, this.rounds);
    const { finale } = missionDone(this.kind); // the session director counts it (the hub suggests what's next)
    onMissionComplete(this.kind, { completions: got[this.kind], finale }); // Adventure Bay changes (shown in the hub)
    sfx.fanfare();
    setTimeout(() => sfx.siren(2), 900);
    this.cheer(6);
    this.pup?.userData.setHappy(8);
    fireworks(this, this.view.look, { bursts: levelUp || this.bigFinish ? 9 : 6 });
    ui.celebrate({
      kind: this.kind,
      level,
      total: maxLevel(this.kind),
      levelUp,
      onHome: () => { hush(); this.game.hub(); },
      onAgain: () => { hush(); this.game.startMission(this.kind); },
    });
    await say([...(this.doneLine?.() || T.done()), ...(levelUp ? T.levelUp(level) : [])]);
    while (this.alive) {
      if (this.pup) await hop(this.pup, 0.6, 500);
      if (!this.alive) return;
      await wait(200);
    }
  }

  // ----- helpers for subclasses -----
  miss() { this.missed = true; }
  item(id) { this.roundItem = id; }

  // ----- learning events (see src/learning/) -----
  /** Choose what to ask next for a skill (adaptive). Numbers in, numbers out. */
  pick(skill, pool, opts) {
    const item = pickItem(skill, pool, { mix: this.easyMix, ...opts });
    return typeof pool[0] === 'number' ? Number(item) : item;
  }
  /**
   * What this round (or step) is asking. skill: one of SKILLS; item: e.g. 'B' or 4.
   * hooks (all optional) say how this mission helps (src/learning/assist.js):
   *   short     segments for the short prompt ("Gdzie jest Be?"), or a function returning them
   *   hint()    show a clue; may return segments to say ("Be jak banan!")
   *   simplify() make it easier (e.g. one wrong option leaves)
   *   reveal()  show the answer (e.g. this.hint(obj) pulses it); she still taps it herself
   */
  question(skill, item, hooks = {}) {
    const q = this.learn.current;
    if (q && q.skill === skill && q.item === String(item)) { Object.assign(this.aid?.hooks || {}, hooks); return; } // same question: keep timers
    this.learn.open({ mission: this.kind, skill, item, level: this.level, round: this.roundIndex });
    this.aid = { hooks: { ...hooks }, state: createAssist(), quietFrom: performance.now() };
  }
  /** She got it. */
  correct(chosen) { this.learn.correct({ chosen }); this.aid = null; }
  /**
   * She picked something else. A clear, kind "no" (a falling tone, the thing she tapped shakes its head and so
   * does Chase, "Nie, to nie ten."), then the question again or the next step of help.
   * said: a different "no" line (it must start with "Nie"). feedback:false when the scene answers in words itself.
   */
  wrong(chosen, { obj = null, said = null, feedback = true } = {}) {
    const at = performance.now();
    if (isBounce(this.lastWrong, chosen, at)) return; // the same finger landing twice: no sound, no count, no help
    this.lastWrong = { chosen, at };
    this.miss();
    this.learn.wrong({ chosen });
    sfx.no();
    if (obj) shakeNo(obj);
    if (this.pup) shakeNo(this.pup, { amp: 0.6 });
    if (!this.aid) return;
    const action = onWrong(this.aid.state);
    onActivity(this.aid.state);
    this.aid.quietFrom = performance.now();
    if (feedback) this.runAssist(action, said || T.no());
  }
  /** At levels that mix lookalikes on purpose, a lookalike mix-up gets named: "Nie, to Pe." */
  lookalikeNo(target, chosen) {
    return this.L.similar && isLookalike(target, chosen) ? T.noLookalike(chosen) : null;
  }
  /** A step done right: a bright chime, and "Tak!" to say before what it was ("Tak! Dwa!"). */
  yes() { sfx.yes(); return T.yesStep(); }

  // ----- help driver -----
  assistTiming() {
    const s = CONFIG.assistSeconds;
    return s ? { nudgeMs: s.nudge * 1000, shortPromptMs: s.shortPrompt * 1000, hintMs: s.hint * 1000, revealMs: s.reveal * 1000 } : TIMING;
  }
  /** Runs every frame: gives the next bit of help when she has been quiet long enough. */
  tickAssist() {
    if (!this.aid || !this.alive || this.speaking) return;
    const action = onIdle(this.aid.state, performance.now() - this.aid.quietFrom, this.assistTiming());
    if (!action) return;
    if (action === 'hint') this.learn.timeout(); // a long hesitation (for fatigue / mastery)
    this.runAssist(action);
  }
  /** Back from a locked iPad / another app: the help clock and her answer time skip the time away. */
  resumed(ms) {
    if (this.aid) this.aid.quietFrom = Math.min(this.aid.quietFrom + ms, performance.now());
    this.learn.paused(ms);
  }
  /**
   * Do one help action: visuals via the scene's hooks, plus a short spoken line (said first).
   * A hook may return segments to say instead of the short prompt, or a promise when it speaks itself.
   */
  runAssist(action, said = []) {
    const aid = this.aid;
    if (!aid) return;
    if (action === 'nudge') { ui.nudgeBubble(); if (this.pup && !this.pupRides) hop(this.pup, 0.3); return; }
    const h = aid.hooks;
    const short = (typeof h.short === 'function' ? h.short() : h.short) || this.prompt || [];
    if (action !== 'retry') this.helped(aid.state.level);
    const out = { hint: h.hint, simplify: h.simplify, reveal: h.reveal }[action]?.(said);
    if (out && typeof out.then === 'function') return;
    this.say([...said, ...(Array.isArray(out) ? out : short)]);
  }
  /** Say something (no help fires while speaking). A newer line cuts this one short. */
  say(segments) {
    const token = (this.sayToken = (this.sayToken || 0) + 1);
    this.speaking = true;
    return say(segments).then(() => { if (token === this.sayToken) this.speaking = false; });
  }
  /** Help was shown: 1 question repeated · 2 clue · 3 answer revealed. */
  helped(level) { this.learn.assist(level); }
  /** She tapped the speech bubble to hear the question again. */
  replay() { this.helped(1); replayed(); if (this.aid) onActivity(this.aid.state); this.ask(this.prompt); }
  /** A tap on the game that hit nothing (reported by the engine). Motor slip, not a wrong answer. */
  onMissTap() { this.learn.missTap(); }
  cheer(seconds = 1.5) { this.cheerUntil = performance.now() / 1000 + seconds; }
  praise() { return pick(PRAISE); }

  /** Everyone reacts to a right answer: sparkles, happy faces, a little camera push. */
  success(at, { big = false } = {}) {
    if (at) sparkle(this, at, { count: big ? 26 : 18 });
    this.cheer(big ? 2.2 : 1.5);
    this.girl?.userData.setHappy(2);
    this.pup?.userData.setHappy(2);
    if (this.pup && !this.pupRides) hop(this.pup, 0.55);
    this.push();
  }

  /** Heroes turn to look at something. */
  lookAt(obj) {
    const p = obj.isVector3 ? obj : obj.getWorldPosition(new THREE.Vector3());
    this.girl?.userData.lookAt(p);
    this.pup?.userData.lookAt(p);
  }

  /** Small camera push-in and back, for emphasis. */
  push(amount = 0.06, ms = 900) {
    if (this.pushing) return;
    this.pushing = true;
    const base = this.view.pos.clone(), look = this.view.look;
    animate(ms, (t) => {
      const k = Math.sin(t * Math.PI) * amount;
      this.view.pos.copy(base).lerp(look, k);
    }, ease.inOut).then(() => { this.view.pos.copy(base); this.pushing = false; });
  }

  /** Say the question now, and again whenever she goes quiet. */
  ask(segments) {
    this.prompt = segments;
    const q = this.learn.current;
    this.say(segments).then(() => {
      if (this.learn.current !== q) return;
      this.learn.promptEnded();                         // latency counts from here…
      if (this.aid) this.aid.quietFrom = performance.now(); // …and so does the quiet-time help
    });
  }
  /** She did something (a tap): the quiet-time help restarts from now. */
  poke() { if (this.aid) this.aid.quietFrom = performance.now(); }
  /** The question is over (solved / moving on): no more help for it. */
  stopIdle() { this.aid = null; this.prompt = ''; }

  // ----- shared world -----
  /**
   * Sky, lights, grassy ground with waving grass + flowers, trees, distant hills, clouds, butterflies.
   * clear: [x, z, r] spots to keep free (where the action happens).
   */
  meadow({ groundColor = '#5dbb4f', trees = true, flowers = true, hills = true, clear = [[0, 0, 7]], treeRing = [11, 20], behindOnly = true, grassRadius = 22 } = {}) {
    addSkyAndLights(this.scene, { shadowSize: 13 });
    this.scene.add(mesh(new THREE.CircleGeometry(160, 48), groundMat(groundColor, 60), { rx: -Math.PI / 2 }));
    const k = detail();
    if (flowers) this.scene.add(makeMeadowDetail({ radius: grassRadius, blades: Math.round(5000 * k), flowers: Math.round(140 * k) + 40, keepOut: clear }));
    if (hills) this.scene.add(makeHills({ radius: 75, count: 12, trees: k > 0.5 }));
    if (trees) {
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = behindOnly ? Math.PI * (0.05 + 0.9 * (i / (n - 1))) : (i / n) * Math.PI * 2;
        const r = treeRing[0] + Math.random() * (treeRing[1] - treeRing[0]);
        const x = Math.cos(a) * r, z = -Math.sin(a) * r * 0.75 - 2;
        if (clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr + 1.5)) continue;
        const t = makeTree({ scale: 1 + Math.random() * 0.7 });
        t.position.set(x, 0, z);
        this.scene.add(t);
      }
    }
    for (let i = 0; i < 6; i++) {
      const c = makeCloud({ scale: 2 + Math.random() * 1.5 });
      c.position.set(-60 + i * 24, 22 + Math.random() * 8, -55 - Math.random() * 20);
      c.userData.tick = (dt) => { c.position.x += dt * 0.5; if (c.position.x > 80) c.position.x = -80; };
      c.userData.mergeOK = true;
      this.scene.add(c);
    }
    for (let i = 0; i < 3; i++) this.scene.add(makeButterfly({ center: [(i - 1) * 6, -1 - i], radius: 3 + i, height: 1 + i * 0.4, color: ['#f472b6', '#fbbf24', '#60a5fa'][i] }));
    for (let i = 0; i < 3; i++) this.scene.add(makeBird({ radius: 30 + i * 6, height: 18 + i * 2, seed: i * 2.1 }));
  }

  addHeroes(girlPos, girlRot, pupPos, pupRot) {
    this.girl = makeGirl();
    this.girl.position.copy(girlPos);
    this.girl.rotation.y = girlRot;
    this.pup = makePup();
    this.pup.position.copy(pupPos);
    this.pup.rotation.y = pupRot;
    this.scene.add(this.girl, this.pup);
    this.shadowUnder(this.girl, 0.7);
    this.shadowUnder(this.pup, 0.85);
    this.girl.userData.tapHeight = 1.7;
    this.pup.userData.tapHeight = 1.5;
    this.tappable(this.pup, () => { sfx.bark(); hop(this.pup, 0.5); this.pup.userData.setHappy(1.2); });
    this.tappable(this.girl, () => { sfx.pop(); this.cheer(); hop(this.girl, 0.35); });
  }

  /** Soft contact shadow that follows an object and fades as it jumps. */
  shadowUnder(obj, radius = 0.8, opacity = 0.38) {
    const s = contactShadow(radius, opacity);
    this.scene.add(s);
    const p = new THREE.Vector3();
    const base = obj.scale.x || 1;
    this.onUpdate(() => {
      if (!obj.parent) { s.visible = false; return; }
      obj.getWorldPosition(p);
      s.position.set(p.x, 0.03, p.z);
      const h = Math.max(0, p.y);
      s.scale.setScalar((1 + h * 0.15) * Math.max(obj.scale.x / base, 0.001));
      s.material.opacity = opacity * Math.max(0.15, 1 - h * 0.35) * (obj.visible ? 1 : 0);
    });
    return s;
  }

  /** Pop an object in from above with a bounce. */
  dropIn(obj, y, delay = 0, ms = 750) {
    const y0 = y + 8;
    obj.position.y = y0;
    return wait(delay).then(() => animate(ms, (t) => { obj.position.y = y0 + (y - y0) * t; }, ease.bounce));
  }

  /** Help: take one wrong option away (it can't be tapped any more). */
  removeOption(obj) {
    if (!obj?.parent || obj.userData.gone) return;
    obj.userData.gone = true;
    this.untap(obj);
    sfx.whoosh();
    this.shrinkAway(obj, 450);
  }

  shrinkAway(obj, ms = 350) {
    const s0 = obj.scale.x;
    return animate(ms, (t) => obj.scale.setScalar(Math.max(0.001, s0 * (1 - t))), ease.in).then(() => obj.removeFromParent());
  }

  /** Arc-jump an object to a point. */
  jumpTo(obj, to, { height = 1.2, ms = 450 } = {}) {
    const from = obj.position.clone();
    return animate(ms, (t) => {
      obj.position.lerpVectors(from, to, t);
      obj.position.y += Math.sin(t * Math.PI) * height;
    }, ease.linear);
  }

  /** Pulse an object's scale after repeated misses. */
  hint(obj, isDone, target = obj) {
    this.helped(3); // the right answer pulses
    if (obj.userData.hinting) return;
    obj.userData.hinting = true;
    const base = target.scale.clone();
    const off = this.onUpdate((dt, t) => {
      if (isDone() || !obj.parent) { off(); obj.userData.hinting = false; if (obj.parent) target.scale.copy(base); return; }
      target.scale.copy(base).multiplyScalar(1 + Math.max(0, Math.sin(t * 7)) * 0.13);
    });
  }
}
