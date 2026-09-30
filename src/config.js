// ------------------------------------------------------------
//  Parent settings. Edit these and reload the page.
// ------------------------------------------------------------
export const CONFIG = {
  pupName: 'Chase',
  childName: 'Zosia',
  childVocative: 'Zosiu',     // "Cześć, Zosiu!"
  childDative: 'Zosi',        // "Pomóż Zosi"
  pupNameSpoken: 'Czejs',     // how the Polish voice should say "Chase"
  pupDative: 'Czejsowi',      // "Daj Czejsowi"
  pupGenitive: 'Czejsa',      // "dotknij Czejsa"
  letters: 'ABCDEFGHIJKLMNOPRSTUWZ', // Polish letter pool (Q, V, X, Y left out)
  lowercase: false,         // true = show lowercase letters instead
  roundsPerMission: 5,
  level: null,              // force every mission to level 1, 2 or 3 (null = earn levels with badges)
  goodRunsPerLevel: 2,      // runs with most answers right first time needed to unlock the next level
  nameWords: ['MAMA', 'TATA', 'KOT', 'DOM'], // extra words for the Name Train (level 2: first two, level 3: all)
  idleRepeatSeconds: 12,    // repeat the question if nobody taps for this long
  // Voice: pre-recorded ElevenLabs clips (npm run voices), falling back to the iPad's Polish voice.
  voiceLang: 'pl-PL',
  speechRate: 0.85,
  voiceId: 'NacdHGUYR1k3M0FAbAia', // ElevenLabs "Hanna": native Polish, calm and soothing
  voiceModel: 'eleven_v3',
  // Changing voice, model or these settings re-records every clip.
  // v3 only takes stability: 0 creative · 0.5 natural · 1 robust. (v2 also takes similarity_boost, style, speed.)
  voiceSettings: { stability: 0.5 },
  voicePause: 350,          // ms of silence between spoken segments
  quality: 'auto',          // graphics: 'auto' | 'high' | 'medium' | 'low'

  // Her 3D look: blonde hair pulled back, green clips, pink flower T-shirt.
  avatar: {
    skin: '#ffcfb0',
    hair: '#e8c070',
    eyes: '#5b3a22',
    shirt: '#f78fab',
    pants: '#5a4a46',
    shoes: '#f1f5f9',
    clips: '#5fbf6a',
    clips2: '#d9e36a',
    tie: '#f78fab',
  },
};

// Polish letter names, so the voice says "be" and not "b".
export const LETTER_NAMES = {
  A: 'A', B: 'be', C: 'ce', D: 'de', E: 'E', F: 'ef', G: 'gie', H: 'ha', I: 'I',
  J: 'jot', K: 'ka', L: 'el', M: 'em', N: 'en', O: 'O', P: 'pe', Q: 'ku', R: 'er',
  S: 'es', T: 'te', U: 'U', V: 'fau', W: 'wu', X: 'iks', Y: 'igrek', Z: 'zet',
};

export const WORDS = {
  A: ['arbuz', '🍉'], B: ['banan', '🍌'], C: ['cytryna', '🍋'], D: ['dom', '🏠'], E: ['elf', '🧝'],
  F: ['foka', '🦭'], G: ['gruszka', '🍐'], H: ['hipopotam', '🦛'], I: ['indyk', '🦃'], J: ['jabłko', '🍎'],
  K: ['kot', '🐱'], L: ['lew', '🦁'], M: ['miś', '🧸'], N: ['nosorożec', '🦏'], O: ['owca', '🐑'],
  P: ['policja', '🚓'], R: ['rower', '🚲'], S: ['słoń', '🐘'], T: ['tort', '🎂'], U: ['ucho', '👂'],
  W: ['wieloryb', '🐳'], Z: ['zebra', '🦓'],
};

// Her own letter: "Zet jak Zosia!"
// (No override for the pup: in Polish "Chase" starts with a "cz" sound, not C.)
if (CONFIG.childName) WORDS[CONFIG.childName[0].toUpperCase()] = [CONFIG.childName, '👧'];

export const letterName = (l) => LETTER_NAMES[l.toUpperCase()] || l;
export const showLetter = (l) => (CONFIG.lowercase ? l.toLowerCase() : l);
export const kidName = () => CONFIG.childName || '';
export const pupSpoken = () => CONFIG.pupNameSpoken || CONFIG.pupName;
/** How to say a spelled word ("CHASE" → "Czejs", "MAMA" → "Mama"). */
export const sayWord = (w) => {
  const u = w.toUpperCase();
  if (CONFIG.pupName && u === CONFIG.pupName.toUpperCase()) return pupSpoken();
  return u.charAt(0) + u.slice(1).toLowerCase();
};
