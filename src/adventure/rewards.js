// World rewards: the only place that changes Adventure Bay's saved state.
// Owns duplicate prevention (world.js), milestone interpretation (world.js) and persistence (progress.js).
// Scenes never touch the world directly: missions report "finished", the hub reads and shows.
import { getWorld, saveProgress } from '../progress.js';
import { applyReward, milestoneRewards } from './world.js';

/** Apply one reward by id ('kitten-2', 'bridge'…). Returns whether the world changed. */
export function applyWorldReward(id) {
  const w = getWorld();
  if (!applyReward(w, id)) return false;
  w.unseen.push(id); // the hub shows it next time
  saveProgress();
  return true;
}

/** A mission was finished. Returns the reward ids that changed the world. */
export function onMissionComplete(kind, { completions, finale = false } = {}) {
  return milestoneRewards(kind, { completions, finale }).filter(applyWorldReward);
}

/** Rewards the hub hasn't shown yet (and forget them: they are being shown now). */
export function takeUnseen() {
  const w = getWorld();
  if (!w.unseen.length) return [];
  const ids = w.unseen.splice(0);
  saveProgress();
  return ids;
}
