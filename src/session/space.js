import { ending, nextStep, suggestNext } from './director.js';

export function spaceDecision(session, attention) {
  if (ending(session) === 'goodnight' || attention === 'finish') return 'home';
  const step = nextStep(session);
  if (step === 'finale' || attention === 'tired') return 'invite';
  return step === 'mission' ? 'suggest' : 'none';
}

export function suggestSpace(session, road, here, visited, games = []) {
  const game = suggestNext(session, games);
  if (game) return game;
  const index = road.indexOf(here);
  const outward = [...road.slice(index + 1), ...road.slice(0, index).reverse()].filter((kind) => kind !== 'earth');
  return outward.find((kind) => !visited[kind])
    || outward.find((kind) => !session.visited?.[kind]) || null;
}
