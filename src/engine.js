import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Post } from './fx/post.js';
import { windTime } from './world/nature.js';
import { optimizeScene } from './fx/optimize.js';
import { CONFIG } from './config.js';

// ---------- renderer ----------
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; // keeps cartoon colours vivid
renderer.toneMappingExposure = 1.0;
document.getElementById('game').appendChild(renderer.domElement);

export const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
export const post = new Post(renderer, camera, new URLSearchParams(location.search).get('q') || CONFIG.quality);

// Soft studio reflections for every material (made once).
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- tweens ----------
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

let tweens = new Set();
let clock = 0;

/** Run fn(progress) every frame for `ms`. Resolves when done. Cancelled (never resolves) on scene change. */
export function animate(ms, fn, easing = ease.inOut) {
  return new Promise((resolve) => {
    tweens.add({ start: clock || performance.now(), ms, fn, easing, resolve });
  });
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- stage base ----------
export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.tappables = [];
    this.updaters = [];
    this.ticks = [];
    this.sways = [];
    this.alive = true;
    this.view = { pos: new THREE.Vector3(0, 6, 12), look: new THREE.Vector3(0, 1, 0), minWidth: 12 };
    this.post = { tilt: 0.35, focus: 0.45, band: 0.22 };
    this.drift = 0.12; // gentle idle camera sway
    this.cameraPosition = camera.position;
  }
  tappable(obj, fn) { obj.userData.onTap = fn; if (!this.tappables.includes(obj)) this.tappables.push(obj); return obj; }
  untap(obj) { this.tappables = this.tappables.filter((o) => o !== obj); delete obj.userData.onTap; }
  onUpdate(fn) { this.updaters.push(fn); return () => { this.updaters = this.updaters.filter((f) => f !== fn); }; }
  /** Pick up everything in the scene that animates itself (userData.tick / userData.sway). */
  collect(root = this.scene) {
    root.traverse((o) => {
      if (o.userData.tick && !this.ticks.includes(o)) this.ticks.push(o);
      if (o.userData.sway && !this.sways.includes(o)) this.sways.push(o);
    });
  }
  update(dt, t) {
    for (const o of this.ticks) o.userData.tick(dt, t);
    for (const o of this.sways) {
      const s = o.userData.sway;
      o.rotation.z = Math.sin(t * 1.3 + s.phase) * s.amp;
      o.rotation.x = Math.cos(t * 1.05 + s.phase) * s.amp * 0.6;
    }
    for (const f of this.updaters) f(dt, t);
  }
  enter() {}
  exit() {}
}

let current = null;
export const getStage = () => current;

export function setStage(stage) {
  if (current) { current.alive = false; current.exit(); disposeScene(current.scene); }
  tweens = new Set();
  current = stage;
  frameCamera();
  stage.enter();
  stage.collect();
  const merged = optimizeScene(stage.scene); // fewer draw calls = much less CPU work per frame
  if (PERF) PERF.merged = merged;
  post.setScene(stage.scene, stage.post);
}

function disposeScene(scene) {
  scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
}

// Keep the important width in view on both landscape and portrait iPads.
export function frameCamera(t = 0) {
  if (!current) return;
  const { pos, look, minWidth } = current.view;
  const dir = pos.clone().sub(look);
  const base = dir.length();
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const need = minWidth / (2 * Math.tan(halfFov) * camera.aspect);
  dir.setLength(Math.max(base, need));
  camera.position.copy(look).add(dir);
  const d = current.drift;
  if (d) camera.position.add(new THREE.Vector3(Math.sin(t * 0.23) * d * 2, Math.sin(t * 0.31) * d, Math.cos(t * 0.19) * d));
  camera.lookAt(look);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  post.resize();
  frameCamera();
}
window.addEventListener('resize', resize);
resize();

// ---------- taps (forgiving for little fingers) ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmp = new THREE.Vector3();

function findTappable(obj) {
  while (obj) { if (obj.userData.onTap) return obj; obj = obj.parent; }
  return null;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!current) return;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const live = current.tappables.filter((o) => o.visible);
  const hits = ray.intersectObjects(live, true);
  let target = hits.length ? findTappable(hits[0].object) : null;
  if (!target) {
    // nearest tappable within a generous screen radius
    const maxD = Math.min(rect.width, rect.height) * 0.14;
    let best = maxD;
    for (const o of live) {
      o.getWorldPosition(tmp);
      tmp.y += (o.userData.tapHeight ?? 0.8) * o.scale.y;
      tmp.project(camera);
      const sx = (tmp.x + 1) / 2 * rect.width, sy = (1 - tmp.y) / 2 * rect.height;
      const d = Math.hypot(sx - (e.clientX - rect.left), sy - (e.clientY - rect.top));
      if (d < best) { best = d; target = o; }
    }
  }
  if (target) target.userData.onTap(target);
  else current.onMissTap?.(); // a tap that hit nothing: missions log it as a motor slip
});

// ---------- loop ----------
// Full 60 fps while something is happening (a tap, an animation); a calm 30 fps otherwise.
// Most of the time she is listening or thinking, so this roughly halves the steady CPU/GPU cost.
let last = performance.now();
let lastActive = 0;
window.addEventListener('pointerdown', () => (lastActive = performance.now()), true);
export const wakeUp = () => (lastActive = performance.now());
renderer.setAnimationLoop((now) => {
  const active = tweens.size > 0 || now - lastActive < 2500 || current?.smooth;
  if (!active && now - last < 30) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock = now;
  for (const tw of tweens) {
    const p = Math.min(1, (now - tw.start) / tw.ms);
    tw.fn(tw.easing(p));
    if (p >= 1) { tweens.delete(tw); tw.resolve(); }
  }
  if (current) {
    const t = now / 1000;
    windTime.value = t;
    const a = performance.now();
    current.update(dt, t);
    frameCamera(t);
    const b = performance.now();
    if (PERF) renderer.info.reset();
    post.render(dt);
    if (PERF) {
      const c = performance.now(), k = 0.05;
      PERF.update += ((b - a) - PERF.update) * k;
      PERF.render += ((c - b) - PERF.render) * k;
      PERF.calls = renderer.info.render.calls;
      PERF.tris = renderer.info.render.triangles;
      PERF.frames++;
    }
  }
});
// ?perf in the URL: collect per-frame stats in window.__perf
const PERF = /[?&]perf/.test(location.search) ? (window.__perf = { update: 0, render: 0, calls: 0, tris: 0, frames: 0 }) : null;
if (PERF) renderer.info.autoReset = false;

// ---------- shared scenery helpers ----------
export function addSkyAndLights(scene, { top = '#3a8ef0', horizon = '#cfeeff', fog = true, fogNear = 55, fogFar = 170, shadowSize = 14, sunPos = [10, 18, 12], sunColor = '#fff1d6', sunIntensity = 2.7 } = {}) {
  scene.background = new THREE.Color(horizon);
  scene.environment = envMap;
  scene.environmentIntensity = 0.5;
  if (fog) scene.fog = new THREE.Fog(horizon, fogNear, fogFar);
  const sunDir = new THREE.Vector3(...sunPos).normalize();
  // gradient sky dome with a soft sun glow
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(240, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, sunDir: { value: sunDir }, sunCol: { value: new THREE.Color('#fff5d0') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position,1.0)).xyz,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float h = clamp(d.y * 1.5, 0.0, 1.0);
          vec3 c = mix(horizon, top, pow(h, 0.75));
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (pow(s, 400.0) * 3.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  sky.userData.tick = () => sky.position.copy(camera.position);
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#eaf5ff', '#5f9a4c', 1.0));
  const sun = new THREE.DirectionalLight(sunColor, sunIntensity);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  const hi = post.tier === 'high';
  sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); // 4x fewer shadow pixels below 'high'
  sun.shadow.radius = hi ? 4 : 2.5;
  sun.shadow.blurSamples = hi ? 10 : 6;
  const s = sun.shadow.camera;
  s.left = s.bottom = -shadowSize;
  s.right = s.top = shadowSize;
  s.near = 1; s.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  // cool rim light from behind makes characters pop
  const rim = new THREE.DirectionalLight('#bfe3ff', 0.9);
  rim.position.set(-sunPos[0], sunPos[1] * 0.6, -sunPos[2]);
  scene.add(rim);
  return sun;
}

/** Hop with a little squash & stretch. Ignored while already hopping (so it never drifts upward). */
export function hop(obj, height = 0.6, ms = 450) {
  if (obj.userData.hopping) return obj.userData.hopping;
  const y0 = obj.position.y;
  const s0 = obj.scale.clone();
  obj.userData.hopping = animate(ms, (t) => {
    const k = Math.sin(t * Math.PI);
    obj.position.y = y0 + k * height;
    const st = t < 0.12 ? -Math.sin((t / 0.12) * Math.PI) * 0.1 : k * 0.08; // crouch, then stretch
    obj.scale.set(s0.x * (1 - st * 0.5), s0.y * (1 + st), s0.z * (1 - st * 0.5));
  }, ease.linear).then(() => {
    obj.position.y = y0;
    obj.scale.copy(s0);
    obj.userData.hopping = null;
  });
  return obj.userData.hopping;
}

export function wiggle(obj, ms = 500) {
  if (obj.userData.wiggling) return obj.userData.wiggling;
  const r0 = obj.rotation.z;
  obj.userData.wiggling = animate(ms, (t) => { obj.rotation.z = r0 + Math.sin(t * Math.PI * 6) * 0.25 * (1 - t); }, ease.linear)
    .then(() => { obj.rotation.z = r0; obj.userData.wiggling = null; });
  return obj.userData.wiggling;
}
