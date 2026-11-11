import test from 'node:test';
import assert from 'node:assert/strict';
import { mayUpdateNow } from '../src/app-update.js';

const where = {
  'on the start screen': { started: false, onIsland: true, busy: true },
  'on the island with nothing in flight': { started: true, onIsland: true, busy: false },
};
const away = {
  'on the island during the swoop, a drive or the grown-ups\' page': { started: true, onIsland: true, busy: true },
  'in a mission or its celebration': { started: true, onIsland: false, busy: false },
  'in a mission while a paw wipe runs': { started: true, onIsland: false, busy: true },
  'on a trip, whatever it is doing': { started: true, onIsland: false, busy: false },
};

for (const [name, state] of Object.entries(where)) test(`a new version goes in ${name}`, () => assert.equal(mayUpdateNow(state), true));
for (const [name, state] of Object.entries(away)) test(`a new version waits ${name}`, () => assert.equal(mayUpdateNow(state), false));
