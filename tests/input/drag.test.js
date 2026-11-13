import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const listeners = new Map();
globalThis.window = {
  addEventListener: (type, fn) => listeners.set(type, fn),
  removeEventListener: (type) => listeners.delete(type),
};
globalThis.requestAnimationFrame = () => 0;
const { startDrag } = await import('../../src/input/drag.js');

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 6, 10);
camera.lookAt(0, 1, 0);
camera.updateMatrixWorld(true);
const dom = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) };
const finger = (x, y) => ({ clientX: x, clientY: y, pointerId: 1 });

/** Start a drag on a fresh object, move the finger through `path`, let go; returns what the object's drag hooks saw. */
function drag(hooks, path) {
  const obj = new THREE.Object3D();
  const seen = { moves: [], drops: [], taps: 0 };
  obj.userData.drag = {
    height: 1,
    onDrop: (o, point) => { seen.drops.push(point.clone()); return true; },
    onTap: () => { seen.taps++; },
    ...(hooks ? { onMove: (o) => seen.moves.push(o.position.clone()) } : {}),
  };
  startDrag(obj, finger(400, 500), { camera, dom, isAlive: () => true });
  for (const [x, y] of path) listeners.get('pointermove')(finger(x, y));
  listeners.get('pointerup')(finger(...path.at(-1)));
  return { obj, seen };
}

test('a drag tells the scene where the piece is after every move, so it can show where it would land', () => {
  const { obj, seen } = drag(true, [[400, 494], [400, 470], [380, 430]]);
  assert.equal(seen.moves.length, 2, 'the first small move is still a tap, the next two are the drag');
  assert.deepEqual(seen.moves.at(-1).toArray(), obj.position.toArray());
  assert.notDeepEqual(seen.moves[0].toArray(), seen.moves[1].toArray(), 'it follows the finger');
  assert.equal(seen.drops.length, 1);
});

test('a tap, or a move too short to be a drag, tells nobody anything', () => {
  const { seen } = drag(true, [[403, 498], [405, 495]]);
  assert.equal(seen.moves.length, 0);
  assert.equal(seen.taps, 1);
});

test('a draggable with no move hook drags and drops as before', () => {
  const { obj, seen } = drag(false, [[400, 460], [400, 420]]);
  assert.equal(seen.drops.length, 1);
  assert.ok(obj.position.y > 1, 'it was lifted and followed the finger');
});
