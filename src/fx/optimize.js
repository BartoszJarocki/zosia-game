// Cut draw calls (the main CPU cost on iPad) without changing how anything looks.
//  1. bakeStatic: everything that never moves is merged, per material, into one world-space mesh.
//  2. mergeSiblings: inside things that do move (characters, truck, train…), meshes that share a
//     material and ride on the same parent are merged, so the parent still animates them together.
// "Never moves" = the mesh and all its parents have no userData (no tick/sway/onTap/idle/…).
// Mark anything moved by code without such data with userData.dynamic = true.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const hasData = (o) => Object.keys(o.userData).length > 0;
const hasFns = (o) => Object.values(o.userData).some((v) => typeof v === 'function');
const texKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap'];

function mergeable(o) {
  return o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material)
    && o.children.length === 0 && !hasData(o) && !o.material.transparent && o.geometry && !o.geometry.morphAttributes?.position;
}

/** Normalise a geometry so it can be merged with others for this material. */
function prep(mesh, matrix) {
  const mat = mesh.material;
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const keep = new Set(['position', 'normal']);
  if (texKeys.some((k) => mat[k])) keep.add('uv');
  if (mat.vertexColors) keep.add('color');
  for (const name of Object.keys(g.attributes)) if (!keep.has(name)) g.deleteAttribute(name);
  const n = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (keep.has('uv') && !g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (keep.has('color') && !g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  g.morphAttributes = {};
  g.clearGroups();
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0) flipWinding(g); // mirrored parts would otherwise render inside-out
  return g;
}

function flipWinding(g) {
  for (const attr of Object.values(g.attributes)) {
    const a = attr.array, s = attr.itemSize;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < s; k++) { const t = a[(i + 1) * s + k]; a[(i + 1) * s + k] = a[(i + 2) * s + k]; a[(i + 2) * s + k] = t; }
    }
    attr.needsUpdate = true;
  }
}

const key = (m) => `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;

function mergeInto(parent, meshes, useWorld) {
  const geos = meshes.map((m) => prep(m, useWorld ? m.matrixWorld : m.matrix));
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (!merged) return false;
  const out = new THREE.Mesh(merged, meshes[0].material);
  out.castShadow = meshes[0].castShadow;
  out.receiveShadow = meshes[0].receiveShadow;
  out.renderOrder = meshes[0].renderOrder;
  meshes.forEach((m) => m.removeFromParent());
  parent.add(out);
  return true;
}

/** Is this mesh (and everything above it) static? */
function isStatic(mesh, root) {
  for (let o = mesh; o && o !== root; o = o.parent) if (hasData(o)) return false;
  return true;
}

export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!mergeable(o) || !isStatic(o, root) || o.parent === null) return;
    const k = key(o);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  });
  let removed = 0;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    if (mergeInto(root, meshes, true)) removed += meshes.length - 1;
  }
  return removed;
}

export function mergeSiblings(root) {
  let removed = 0;
  const groups = [];
  root.traverse((o) => { if (o.children.length > 1 && (!hasFns(o) || o.userData.mergeOK)) groups.push(o); });
  for (const g of groups) {
    const buckets = new Map();
    for (const c of g.children) {
      if (!mergeable(c)) continue;
      const k = key(c);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(c);
    }
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      if (mergeInto(g, meshes, false)) removed += meshes.length - 1;
    }
  }
  return removed;
}

/** Bake the static contents of a moving group (e.g. a street that scrolls) into group-local meshes. */
export function bakeInside(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  group.traverse((o) => {
    if (o === group || !mergeable(o) || !isStatic(o, group)) return;
    const k = key(o);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  });
  let removed = 0;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((mm) => prep(mm, new THREE.Matrix4().multiplyMatrices(inv, mm.matrixWorld)));
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const out = new THREE.Mesh(merged, meshes[0].material);
    out.castShadow = meshes[0].castShadow; out.receiveShadow = meshes[0].receiveShadow;
    meshes.forEach((mm) => mm.removeFromParent());
    group.add(out);
    removed += meshes.length - 1;
  }
  return removed;
}

/** Run all passes on a freshly built scene. */
export function optimizeScene(scene) {
  let n = bakeStatic(scene);
  const inside = [];
  scene.traverse((o) => { if (o.userData.bakeInside) inside.push(o); });
  for (const g of inside) n += bakeInside(g);
  n += mergeSiblings(scene);
  return n;
}

/** Merge every mesh under `group` into group-local meshes (one per material). For rigid sub-assemblies only. */
export function flatten(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  group.traverse((o) => {
    if (o === group || !o.isMesh || Array.isArray(o.material)) return;
    const k = key(o);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(o);
  });
  for (const meshes of buckets.values()) {
    const geos = meshes.map((mm) => prep(mm, new THREE.Matrix4().multiplyMatrices(inv, mm.matrixWorld)));
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const out = new THREE.Mesh(merged, meshes[0].material);
    out.castShadow = meshes[0].castShadow; out.receiveShadow = meshes[0].receiveShadow;
    meshes.forEach((mm) => mm.removeFromParent());
    group.add(out);
  }
  // drop now-empty sub-groups
  [...group.children].forEach((c) => { if (!c.isMesh && c.children.length === 0) c.removeFromParent(); });
}
