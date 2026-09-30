// Stylised water: two scrolling ripple layers (normal + clearcoat normal), shallow→deep colour,
// sun glints that bloom, and animated shore foam.
import * as THREE from 'three';

let normalTex = null;
/** Tileable ripple normal map made from a sum of wrapped sine waves. */
function rippleNormals() {
  if (normalTex) return normalTex;
  const S = 256;
  const h = new Float32Array(S * S);
  const waves = Array.from({ length: 9 }, () => ({
    kx: Math.round((Math.random() - 0.5) * 12), ky: Math.round((Math.random() - 0.5) * 12), p: Math.random() * 6.28, a: 0.4 + Math.random(),
  })).filter((w) => w.kx || w.ky);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p);
    h[y * S + x] = v;
  }
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const hy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    const n = new THREE.Vector3(-hx * 0.35, -hy * 0.35, 1).normalize();
    const i = (y * S + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  normalTex = new THREE.DataTexture(data, S, S);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.needsUpdate = true;
  return normalTex;
}

function gradientTex(stops, radial) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  const g = radial ? c.createRadialGradient(128, 128, 0, 128, 128, 128) : c.createLinearGradient(0, 0, 0, 256);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Water material. `stops` colours run centre→edge (radial) or top→bottom (linear).
 * Returns { material, update(dt) }.
 */
export function makeWater({ repeat = 8, flow = [0.02, 0.012], stops, radial = false, scale = 0.55 } = {}) {
  const n1 = rippleNormals().clone();
  const n2 = rippleNormals().clone();
  n1.repeat.set(repeat, repeat);
  n2.repeat.set(repeat * 1.7, repeat * 1.7);
  n1.needsUpdate = n2.needsUpdate = true;
  const material = new THREE.MeshPhysicalMaterial({
    map: gradientTex(stops || [[0, '#5fe0e6'], [0.5, '#27b3ea'], [1, '#1d78d6']], radial),
    roughness: 0.18, metalness: 0,
    normalMap: n1, normalScale: new THREE.Vector2(scale, scale),
    clearcoat: 1, clearcoatRoughness: 0.03, clearcoatNormalMap: n2, clearcoatNormalScale: new THREE.Vector2(scale * 0.7, scale * 0.7),
    envMapIntensity: 1.2,
  });
  const update = (dt) => {
    n1.offset.x += flow[0] * dt; n1.offset.y += flow[1] * dt;
    n2.offset.x -= flow[1] * dt * 1.3; n2.offset.y += flow[0] * dt * 0.8;
  };
  return { material, update };
}

let foamTex = null;
function foamTexture() {
  if (foamTex) return foamTex;
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 1024, 64);
  // break it up into bubbly blobs
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    c.beginPath();
    c.arc(Math.random() * 1024, Math.random() * 64, 3 + Math.random() * 9, 0, Math.PI * 2);
    c.fill();
  }
  foamTex = new THREE.CanvasTexture(cv);
  foamTex.wrapS = THREE.RepeatWrapping;
  return foamTex;
}

/** Ring of foam around an island of radius r. */
export function makeShoreFoam(r, width = 1.4) {
  const tex = foamTexture().clone();
  tex.repeat.set(6, 1);
  tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.RingGeometry(r - width * 0.3, r + width, 128, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
  m.rotation.x = -Math.PI / 2;
  // ring UVs are planar; remap so the texture runs around the ring
  const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (Math.atan2(y, x) / (Math.PI * 2) + 0.5), (Math.hypot(x, y) - (r - width * 0.3)) / (width * 1.3));
  }
  uv.needsUpdate = true;
  const update = (dt, t) => {
    tex.offset.x += dt * 0.004;
    m.scale.setScalar(1 + Math.sin(t * 1.2) * 0.006);
    m.material.opacity = 0.7 + Math.sin(t * 1.2) * 0.2;
  };
  return { mesh: m, update };
}
