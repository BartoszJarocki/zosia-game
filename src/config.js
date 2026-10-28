// ------------------------------------------------------------
//  Parent settings. Edit these and reload the page.
// ------------------------------------------------------------
export const CONFIG = {
  pupName: 'Chase',
  childName: 'Zosia',        // letters, words and levels are in GAME.md
  childVocative: 'Zosiu',     // "Cześć, Zosiu!"
  childDative: 'Zosi',        // "Pomóż Zosi"
  pupNameSpoken: 'Czejs',     // how the Polish voice should say "Chase"
  pupDative: 'Czejsowi',      // "Daj Czejsowi"
  pupGenitive: 'Czejsa',      // "dotknij Czejsa"
  lowercase: false,         // true = show lowercase letters instead
  level: null,              // force every mission to level 1, 2 or 3 (null = earn levels with badges)
  goodRunsPerLevel: 2,      // runs with most answers right first time needed to unlock the next level
  // help when she goes quiet: the bubble bounces → short prompt → clue → answer pulses, then silence
  assistSeconds: { nudge: 6, shortPrompt: 10, hint: 17, reveal: 25 },
  // a play session: this many missions, then the Lookout as the finale, then free play (nothing is ever locked)
  session: { missions: 2, newAfterMinutes: 15 },
  // tiredness (0–1, from slower answers, random taps, silences, replays, more help): below `tired` the
  // finale comes next and nothing new is asked; below `finish` → "Jeszcze tylko jedno!", an easy one, goodbye
  attention: { tired: 0.6, finish: 0.35 },
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

// Picture words, [word, picture]. The first is the letter's own word ("Be jak banan!"); Pup Delivery uses all of
// them, so she hears a first sound in different words instead of learning pairs. A word starts with its letter's
// sound and then a vowel (not "sł", "gr"), is one thing ("pójdzie kaczka"), and is what she would call the picture.
export const WORDS = {
  A: [['arbuz', '🍉'], ['ananas', '🍍']],
  B: [['banan', '🍌'], ['balon', '🎈']],
  C: [['cytryna', '🍋'], ['cukierek', '🍬']],
  D: [['dom', '🏠'], ['dinozaur', '🦕']],
  E: [['Everest', '🏔️'], ['ekran', '📺']],
  F: [['foka', '🦭'], ['fala', '🌊']],
  G: [['gitara', '🎸'], ['góra', '⛰️']],
  H: [['hipopotam', '🦛'], ['helikopter', '🚁']],
  I: [['igła', '🪡']],
  J: [['jabłko', '🍎'], ['jajko', '🥚']],
  K: [['kot', '🐱'], ['kaczka', '🦆']],
  L: [['lew', '🦁'], ['lizak', '🍭']],
  M: [['miś', '🧸'], ['motyl', '🦋']],
  N: [['nosorożec', '🦏'], ['nos', '👃']],
  O: [['owca', '🐑'], ['ośmiornica', '🐙']],
  P: [['pies', '🐶'], ['pomidor', '🍅']],
  R: [['rower', '🚲'], ['ryba', '🐟']],
  S: [['ser', '🧀'], ['samolot', '✈️']],
  T: [['tort', '🎂'], ['telefon', '📱']],
  U: [['ucho', '👂'], ['uśmiech', '😊']],
  W: [['wąż', '🐍'], ['wilk', '🐺']],
  Z: [['zebra', '🦓'], ['zamek', '🏰']],
};

/**
 * A letter's own word, [word, picture]. Her letter's is her name: "Zet jak Zosia!" (said, never a picture to
 * name, so Pup Delivery keeps to WORDS). No such word for the pup: in Polish "Chase" starts with "cz", not C.
 */
export const letterWord = (l) => (CONFIG.childName && l === CONFIG.childName[0].toUpperCase() ? [CONFIG.childName, '👧'] : WORDS[l]?.[0] || ['', '']);

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
