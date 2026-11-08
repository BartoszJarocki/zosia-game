import { CONFIG } from './config.js';

export const PLACES = {
  letters: {
    area: 'island', game: true, domain: 'letters',
    badge: { label: 'ABC', color: '#ef4444' },
  },
  balloons: {
    area: 'island', game: true, domain: 'letters',
    badge: { label: '🎈', color: '#db2777' },
  },
  name: {
    area: 'island', game: true, domain: 'letters',
    badge: { label: (CONFIG.childName || 'A')[0].toUpperCase(), color: '#9333ea' },
  },
  cones: {
    area: 'island', game: true, domain: 'numbers',
    badge: { label: '123', color: '#2563eb' },
  },
  stones: {
    area: 'island', game: true, domain: 'numbers',
    badge: { label: '1·2·3', color: '#0891b2' },
  },
  counting: {
    area: 'island', game: true, domain: 'numbers',
    badge: { label: '🦴', color: '#f59e0b' },
  },
  lookout: {
    area: 'island', game: true, domain: 'numbers',
    badge: { label: '🐾', color: '#e23b3b' },
  },
  delivery: {
    area: 'island', game: true, domain: 'letters',
    badge: { label: '📦', color: '#b45309' },
  },
  picnic: {
    area: 'island', game: true, domain: 'numbers',
    badge: { label: '🧺', color: '#16a34a' },
  },
  garage: {
    area: 'island', game: true, domain: 'shapes',
    badge: { label: '🔧', color: '#ea580c' },
  },
  rocket: { area: 'island', game: false, domain: 'space', leadsTo: 'space' },
  sun: { area: 'space', game: false, domain: 'space' },
  mercury: { area: 'space', game: true, domain: 'numbers', badge: { label: '🪨', color: '#9ca3af' } },
  venus: { area: 'space', game: true, domain: 'shapes', badge: { label: '☁️', color: '#f59e0b' } },
  earth: { area: 'space', game: false, domain: 'space' },
  moon: { area: 'space', game: true, domain: 'numbers', badge: { label: '🌙', color: '#6366f1' } },
  mars: { area: 'space', game: true, domain: 'numbers', badge: { label: '🚙', color: '#c2410c' } },
  jupiter: { area: 'space', game: true, domain: 'shapes', badge: { label: '🟠', color: '#ea8a3c' } },
  saturn: { area: 'space', game: true, domain: 'shapes', badge: { label: '🪐', color: '#d4a14a' } },
  uranus: { area: 'space', game: false, domain: 'space' },
  neptune: { area: 'space', game: false, domain: 'space' },
  pluto: { area: 'space', game: true, domain: 'shapes', badge: { label: '🤍', color: '#f9a8d4' } },
  blackhole: { area: 'space', game: true, domain: 'numbers', badge: { label: '✨', color: '#7c3aed' } },
  comet: { area: 'space', game: true, domain: 'letters', badge: { label: '☄️', color: '#38bdf8' } },
  stars: { area: 'space', game: true, domain: 'numbers', badge: { label: '⭐', color: '#eab308' } },
  telescope: { area: 'space', game: true, domain: 'space', stop: false, badge: { label: '🔭', color: '#0d9488' } },
  lighthouse: { area: 'sea', game: true, domain: 'numbers', badge: { label: '🚨', color: '#0ea5e9' } },
};

export const placesIn = (area) => Object.keys(PLACES).filter((k) => PLACES[k].area === area);
export const GAMES = Object.keys(PLACES).filter((k) => PLACES[k].game);

export const homeArea = (stage) => stage?.area === 'space' ? 'space' : 'island';
