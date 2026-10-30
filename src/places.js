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
};

export const placesIn = (area) => Object.keys(PLACES).filter((k) => PLACES[k].area === area);
export const GAMES = Object.keys(PLACES).filter((k) => PLACES[k].game);
