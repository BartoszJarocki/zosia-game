// Drag and drop for little fingers. A draggable object follows the finger across a flat plane (y = height)
// and is dropped on release; a quick tap (barely moved) counts as a tap instead — the fallback for anyone who
// can't drag yet: the scene can then simply send the object where it should go.
//
//   stage.draggable(obj, { height, onDrop(obj, point) → true if accepted, onTap(obj), onPick(obj) })
//
// The engine starts a drag when a pointerdown lands on a draggable (engine.js), this module does the rest.
import * as THREE from 'three';

const TAP_PX = 12;     // moved less than this before letting go = a tap (however long she held it)

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
let active = null;

/** Where the pointer meets the horizontal plane y = height (world coords), or null. */
export function pointOnPlane(e, camera, dom, height) {
  const rect = dom.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  plane.constant = -height;
  return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
}

/** Begin dragging obj from this pointerdown. */
export function startDrag(obj, e, { camera, dom, isAlive }) {
  if (active) return;
  const d = obj.userData.drag;
  const start = { x: e.clientX, y: e.clientY };
  const from = obj.position.clone();
  const height = d.height ?? from.y;
  const grab = pointOnPlane(e, camera, dom, height);
  const offset = grab ? from.clone().sub(grab).setY(0) : new THREE.Vector3();
  let moved = false;
  active = obj;
  const lift = d.lift ?? 0.4;

  const move = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > TAP_PX) { moved = true; d.onPick?.(obj); }
    if (!moved || !isAlive()) return;
    const p = pointOnPlane(ev, camera, dom, height);
    if (p) obj.position.set(p.x + offset.x, height + lift, p.z + offset.z);
  };
  const up = (ev) => {
    if (ev.pointerId !== e.pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    active = null;
    if (!isAlive()) return;
    if (!moved) { d.onTap?.(obj); return; }
    const accepted = d.onDrop?.(obj, obj.position.clone().setY(height));
    if (!accepted) back(obj, from);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/** Not dropped anywhere useful: float back to where it was (no fuss). */
function back(obj, to) {
  const from = obj.position.clone();
  const t0 = performance.now(), ms = 300;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    obj.position.lerpVectors(from, to, 1 - (1 - k) * (1 - k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const dragging = () => active;
