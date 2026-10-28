// Post-processing: bloom (glowy stars, sirens, sparkles), tilt-shift (toy-diorama look),
// soft ambient occlusion on strong devices, and a final colour grade + vignette.
// Quality adapts to the device: it watches the frame rate and steps down if needed (fx/quality.js).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createWatch, judgeFrame } from './quality.js';

const TiltShader = {
  uniforms: { tDiffuse: { value: null }, delta: { value: new THREE.Vector2() }, focus: { value: 0.5 }, band: { value: 0.18 }, amount: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 delta; uniform float focus; uniform float band; uniform float amount; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - focus);
      float b = amount * smoothstep(band, band + 0.32, d);
      vec4 sum = vec4(0.0); float total = 0.0;
      for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        float w = 1.0 - abs(fi) / 5.0;
        sum += texture2D(tDiffuse, vUv + delta * fi * b) * w;
        total += w;
      }
      gl_FragColor = sum / total;
    }`,
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.12 }, contrast: { value: 1.04 }, warmth: { value: 0.015 }, vignette: { value: 0.28 } },
  vertexShader: TiltShader.vertexShader,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation; uniform float contrast; uniform float warmth; uniform float vignette; varying vec2 vUv;
    void main(){
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c.r += warmth; c.b -= warmth * 0.6;
      vec2 p = vUv - 0.5;
      c *= 1.0 - vignette * dot(p, p) * 1.6;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
    }`,
};

const TIERS = ['low', 'medium', 'high'];
// (-v2: the first watcher took the calm 30 fps for a slow device, so what it stored, its lock included, is dropped)
const QKEY = 'pup-patrol-quality-v2';

export class Post {
  constructor(renderer, camera, preferred = 'auto') {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = null;
    this.opts = { tilt: 0, focus: 0.5, band: 0.18, ao: true };
    this.auto = preferred === 'auto';
    let stored = null;
    try { stored = localStorage.getItem(QKEY); } catch {}
    this.tier = this.auto ? (stored || 'medium') : preferred;
    this.locked = !this.auto || stored === 'medium-locked';
    if (this.tier === 'medium-locked') this.tier = 'medium';
    this.watcher = createWatch();
    this.build();
  }

  build() {
    const r = this.renderer;
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio({ low: 1, medium: Math.min(dpr, 1.5), high: Math.min(dpr, 2) }[this.tier]);
    this.composer?.dispose?.();
    this.composer = null;
    const w = window.innerWidth, h = window.innerHeight;
    r.setSize(w, h);
    if (this.tier === 'low') return;

    const rt = new THREE.WebGLRenderTarget(w * r.getPixelRatio(), h * r.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 });
    const c = (this.composer = new EffectComposer(r, rt));
    this.renderPass = new RenderPass(null, this.camera);
    c.addPass(this.renderPass);
    this.aoPass = null; // (ambient occlusion removed: it re-rendered the scene every frame; contact shadows do the job)
    // high threshold: only truly bright things (stars, sparkles, lamps) glow
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.45, 0.35, 2.4);
    c.addPass(this.bloom);
    this.tiltH = new ShaderPass(TiltShader);
    this.tiltV = new ShaderPass(TiltShader);
    c.addPass(this.tiltH);
    c.addPass(this.tiltV);
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    this.setScene(this.scene, this.opts);
    this.resize();
  }

  setScene(scene, opts = {}) {
    this.scene = scene;
    this.opts = { ...this.opts, tilt: 0, focus: 0.5, band: 0.18, ...opts };
    if (!this.composer) return;
    this.renderPass.scene = scene;
    if (this.aoPass) { this.aoPass.scene = scene; this.aoPass.enabled = this.opts.ao !== false; }
    for (const p of [this.tiltH, this.tiltV]) {
      p.uniforms.amount.value = this.opts.tilt;
      p.uniforms.focus.value = this.opts.focus;
      p.uniforms.band.value = this.opts.band;
      p.enabled = this.opts.tilt > 0;
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (!this.composer) return;
    this.composer.setSize(w, h);
    this.aoPass?.setSize(w, h);
    const px = 3.2 / this.renderer.getPixelRatio();
    this.tiltH.uniforms.delta.value.set(px / w, 0);
    this.tiltV.uniforms.delta.value.set(0, px / h);
  }

  /** full: this frame and the one before were rendered at full rate (not the calm 30 fps). */
  render(dt, full) {
    if (!this.scene) return;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.watch(dt, full);
  }

  // adapt quality to the device (only in 'auto')
  watch(dt, full) {
    if (!this.auto || this.locked) return;
    const verdict = judgeFrame(this.watcher, dt, full);
    const i = TIERS.indexOf(this.tier);
    if (verdict === 'slow' && i > 0) {
      this.tier = TIERS[i - 1];
      this.locked = this.tier !== 'low' ? true : this.locked; // don't bounce back up
      this.store(this.locked && this.tier === 'medium' ? 'medium-locked' : this.tier);
      this.build();
    } else if (verdict === 'fast' && i < 2) { this.tier = TIERS[i + 1]; this.store(this.tier); this.build(); }
  }
  store(v) { try { localStorage.setItem(QKEY, v); } catch {} }
}
