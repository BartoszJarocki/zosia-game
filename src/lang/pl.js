// Everything the game says, in Polish.
// Each phrase returns a list of short segments; every segment is one pre-recorded clip.
// Mixing segments ("To jest em." + "Gdzie jest be?") keeps the clip count small.
import { CONFIG, WORDS, letterName, sayWord } from '../config.js';

const NUM = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć'];
const NUM_GEN = ['zera', 'jednego', 'dwóch', 'trzech', 'czterech', 'pięciu', 'sześciu', 'siedmiu', 'ośmiu', 'dziewięciu', 'dziesięciu'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const L = (l) => cap(letterName(l));
const word = (l) => (WORDS[l] || [''])[0];
/** 1 smakołyk, 2–4 smakołyki, 5+ smakołyków */
const treats = (n) => (n === 1 ? 'smakołyk' : n >= 2 && n <= 4 ? 'smakołyki' : 'smakołyków');

const voc = CONFIG.childVocative || CONFIG.childName;
const dat = CONFIG.childDative || CONFIG.childName;
const kid = CONFIG.childName;
const pup = CONFIG.pupNameSpoken || CONFIG.pupName;
const pupDat = CONFIG.pupDative || pup;
const pupGen = CONFIG.pupGenitive || pup;

export const PRAISE = ['Brawo!', 'Super!', 'Świetnie!', 'Hura!', 'Wspaniale!', 'Doskonale!'];

export const PLACE_LINES = {
  letters: 'Jedziemy do Kociego Parku!',
  balloons: 'Jedziemy na Balonową Łąkę!',
  name: 'Jedziemy do Literkowego Pociągu!',
  cones: 'Jedziemy na Pachołkową Drogę!',
  stones: 'Jedziemy nad rzekę!',
  lookout: 'Jedziemy do Bazy!',
  counting: 'Jedziemy do Domku ze Smakołykami!',
};

export const T = {
  number: (n) => [`${cap(NUM[n])}!`],
  praise: (i) => [PRAISE[i]],

  // hub
  greet: () => [`Cześć, ${voc}! ${pup} jest gotowy do akcji! Dokąd jedziemy? Dotknij miejsca na wyspie!`],
  hubAgain: () => ['Dokąd teraz jedziemy?', 'Wybierz nową misję!', 'Brawo! Gdzie teraz?'],
  hubIdle: () => ['Dotknij miejsca, żeby zacząć misję!'],
  tapGirl: () => [`To ${kid}!`, `Cześć, ${voc}!`, `${kid} i ${pup}, gotowi do akcji!`],
  tapPup: () => ['Hau, hau!', `${pup} rusza do akcji!`, 'Gotowy do akcji!'],
  go: (kind) => [PLACE_LINES[kind]],

  // end of every mission
  done: () => [`Udało się, ${voc}! Misja zakończona! Zdobywasz odznakę!`],
  levelUp: (lvl) => [`I nową gwiazdkę! Poziom ${NUM[lvl]}!`],

  // shared "wrong answer" feedback
  thatsLetter: (l) => [`To jest ${L(l)}.`],
  whereLetter: (l) => [`Gdzie jest ${L(l)}?`],
  findLetter: (l) => [`Znajdź ${L(l)}!`],
  thatsNumber: (n) => [`To jest numer ${NUM[n]}.`],
  whereNumber: (n) => [`Gdzie jest numer ${NUM[n]}?`],
  letter: (l) => [`${L(l)}!`],

  // Kitty Park
  kittyAsk: (l) => [`Kotek schował się za literą ${L(l)}! Znajdź ${L(l)}! ${L(l)} jak ${word(l)}!`],
  kittyFound: (l) => [`Znalazłaś kotka! ${L(l)} jak ${word(l)}!`],

  // Balloon Hill
  balloonAsk: (l) => [`Przebij balony z literą ${L(l)}! Ile ich znajdziesz?`],
  balloonDone: (l) => [`Wszystkie balony z literą ${L(l)}! ${L(l)} jak ${word(l)}!`],

  // Name Train
  spellStart: (w) => [`Ułóżmy słowo ${sayWord(w)}! ${sayWord(w)} zaczyna się na ${L(w[0])}. Znajdź ${L(w[0])}!`],
  spellNext: (l) => [`Teraz ${L(l)}!`],
  spellWord: (w) => [`${sayWord(w)}!`],

  yes: () => ['Tak!'],
  countTogether: () => ['Policzmy razem!'],

  // Cone Road
  conesFirst: (n) => [`Ojej! Pachołki na drodze! Dotknij pachołka z numerem ${NUM[n]}!`],
  conesMore: (n) => [`Więcej pachołków! Dotknij numeru ${NUM[n]}!`],
  conesDots: (first) => [first ? 'Ojej! Pachołki na drodze! Policz kropki i znajdź ten numer!' : 'Policz kropki! Który to numer?'],
  dots: (n) => [`${cap(NUM[n])} ${n === 1 ? 'kropka' : n <= 4 ? 'kropki' : 'kropek'}!`],

  // River
  riverFirst: () => [`Pomóż ${dat} przejść przez rzekę! Dotknij numeru jeden!`],
  riverAgain: () => ['Nowa rzeka! Zacznij od numeru jeden!'],
  riverNext: (n) => [`Teraz numer ${NUM[n]}!`],
  riverDone: (n) => [`Udało się! Policzyłaś do ${NUM_GEN[n]}!`],
  riverWhatNext: () => ['A teraz? Co jest dalej?'],
  riverFirstNext: () => [`Pomóż ${dat} przejść przez rzekę! Zacznij od jedynki, a potem po kolei!`],

  // Treat House
  treatsAsk: (n) => [`${pup} jest głodny! Daj mu ${NUM[n]} ${treats(n)}. Dotknij pudełka ze smakołykami!`],
  treatsDone: (n) => [`${cap(NUM[n])} ${treats(n)}!`],
  yum: () => ['Mniam, mniam! Dziękuję!'],

  // The Lookout (Baza): elevator + slide
  liftStart: () => ['Do Bazy! Wsiadamy do windy!'],
  liftGo: (n) => [`Jedziemy na piętro numer ${NUM[n]}! Wciśnij guzik z numerem ${NUM[n]}!`],
  liftPress: (n) => [`Wciśnij guzik z numerem ${NUM[n]}!`],
  liftRel: (cur, up) => [`Jesteśmy na piętrze numer ${NUM[cur]}. Jedź jedno piętro ${up ? 'wyżej' : 'niżej'}!`],
  liftArrived: (n) => [`Piętro numer ${NUM[n]}!`],
  liftTop: () => ['Jedziemy na samą górę! Psi Patrol, gotowi do akcji!'],
  slide: () => ['A teraz zjeżdżalnia! Juhuuu!'],
  howMany: () => [`Ile smakołyków ma ${pup}? Policz i dotknij numeru!`],
  giveThenTap: (n) => [`Daj ${pupDat} ${NUM[n]} ${treats(n)}, a potem dotknij ${pupGen}!`],
  tapPupWhenDone: () => [`Gotowe? Dotknij ${pupGen}!`],
  tooMany: () => ['Oj, za dużo! Jeden oddaję.'],
  tooFew: () => ['Za mało! Jeszcze!'],
};

/** Every segment the game can say (for the clip generator). */
export function allSegments() {
  const letters = new Set([...CONFIG.letters, ...(CONFIG.childName || '').toUpperCase(), ...CONFIG.nameWords.join('').toUpperCase()]
    .filter((c) => /[A-Z]/.test(c)));
  const words = [(CONFIG.childName || '').toUpperCase(), ...CONFIG.nameWords].filter(Boolean);
  const nums = Array.from({ length: 10 }, (_, i) => i + 1);
  const out = [];
  const add = (segs) => out.push(...segs);
  nums.slice(0, 7).forEach((n) => { add(T.liftGo(n)); add(T.liftPress(n)); add(T.liftArrived(n)); if (n < 7) add(T.liftRel(n, true)); if (n > 1) add(T.liftRel(n, false)); });
  nums.forEach((n) => { add(T.dots(n)); add(T.giveThenTap(n)); add(T.number(n)); add(T.thatsNumber(n)); add(T.whereNumber(n)); add(T.conesFirst(n)); add(T.conesMore(n)); add(T.riverNext(n)); add(T.riverDone(n)); add(T.treatsAsk(n)); add(T.treatsDone(n)); });
  PRAISE.forEach((_, i) => add(T.praise(i)));
  letters.forEach((l) => { add(T.thatsLetter(l)); add(T.whereLetter(l)); add(T.findLetter(l)); add(T.letter(l)); add(T.kittyAsk(l)); add(T.kittyFound(l)); add(T.balloonAsk(l)); add(T.balloonDone(l)); add(T.spellNext(l)); });
  words.forEach((w) => { add(T.spellStart(w)); add(T.spellWord(w)); });
  Object.keys(PLACE_LINES).forEach((k) => add(T.go(k)));
  [2, 3].forEach((l) => add(T.levelUp(l)));
  [T.greet, T.hubAgain, T.hubIdle, T.tapGirl, T.tapPup, T.done, T.riverFirst, T.riverAgain, T.yum, T.yes, T.countTogether,
    T.riverWhatNext, T.riverFirstNext, T.howMany, T.tapPupWhenDone, T.tooMany, T.tooFew, T.liftStart, T.liftTop, T.slide].forEach((f) => add(f()));
  add(T.conesDots(true)); add(T.conesDots(false));
  return [...new Set(out)];
}
