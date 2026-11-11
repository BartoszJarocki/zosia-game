import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer } from '../../src/input/answer.js';

function device() {
  let sounds = 0;
  const heard = [];
  return {
    heard,
    play: (what) => { sounds++; heard.push(what); },
    io: { sounds: () => sounds, tick: () => { sounds++; heard.push('tick'); }, bounce: () => heard.push('bounce') },
  };
}

test('a tap the scene cannot act on yet gets a tick and a bounce', () => {
  const d = device();
  answer(() => {}, d.io);
  assert.deepEqual(d.heard, ['tick', 'bounce']);
});

test('a tap that makes its own sound gets nothing more', () => {
  const d = device();
  answer(() => d.play('ding'), d.io);
  assert.deepEqual(d.heard, ['ding']);
});

test('a tap whose sound comes later (it waits its turn) is answered now', async () => {
  const d = device();
  const turn = answer(() => Promise.resolve().then(() => d.play('ding')), d.io);
  assert.deepEqual(d.heard, ['tick', 'bounce']);
  await turn;
  assert.deepEqual(d.heard, ['tick', 'bounce', 'ding']);
});
