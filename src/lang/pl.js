// Everything the game says, in Polish.
// Each phrase returns a list of short segments; every segment is one pre-recorded clip.
// Mixing segments ("To jest em." + "Gdzie jest be?") keeps the clip count small.
import { CONFIG, WORDS, letterName, sayWord } from '../config.js';
import { gapCount } from '../levels/train.js';

const NUM = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć'];
const NUM_F = ['zero', 'jedna', 'dwie', ...NUM.slice(3)]; // feminine nouns: jedna kropka, dwie kropki
const NUM_GEN = ['zera', 'jednego', 'dwóch', 'trzech', 'czterech', 'pięciu', 'sześciu', 'siedmiu', 'ośmiu', 'dziewięciu', 'dziesięciu'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** A letter's sound, held: "mmmm", "ssss" (only letters you can hold, see levels/parse.js SOUNDABLE). */
const PHON = { A: 'aaaa', E: 'eeee', F: 'ffff', H: 'hhhh', I: 'iiii', L: 'llll', M: 'mmmm', N: 'nnnn', O: 'oooo', R: 'rrrr', S: 'ssss', U: 'uuuu', W: 'wwww', Z: 'zzzz' };
const ph = (l) => PHON[l.toUpperCase()] || l;
/** "jedną kropkę", "dwie kropki", "pięć kropek" (accusative: "ma … ") */
const dotsAcc = (n) => (n === 1 ? 'jedną kropkę' : n <= 4 ? `${NUM_F[n]} kropki` : `${NUM[n]} kropek`);
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

// The Garage. Colours agree with the noun: klocek and koszyk are masculine, flaga feminine (czerwony klocek,
// czerwona flaga, do czerwonego koszyka).
const COLOUR = { red: ['czerwony', 'czerwona', 'czerwonego'], blue: ['niebieski', 'niebieska', 'niebieskiego'], yellow: ['żółty', 'żółta', 'żółtego'], green: ['zielony', 'zielona', 'zielonego'] };
const SIZE = { big: ['duży', 'dużego'], small: ['mały', 'małego'] };
const SHAPE = { circle: 'koło', square: 'kwadrat', triangle: 'trójkąt' };
const SHAPE_CLUE = { circle: 'Koło jest okrągłe!', square: 'Kwadrat ma cztery rogi!', triangle: 'Trójkąt ma trzy rogi!' };
/** A block or basket by the rule she sorts by: colour or size (masculine forms). */
const sorted = (rule, v) => (rule === 'size' ? SIZE[v] : COLOUR[v]);

export const PRAISE = ['Brawo!', 'Super!', 'Świetnie!', 'Hura!', 'Wspaniale!', 'Doskonale!'];
/** After a wrong tap, before the question again ("Nie, to nie ten." "Gdzie jest Zet?"). Always starts with "Nie". */
export const NO = ['Nie, to nie ten.', 'Nie, nie ten.'];
/** A step done right, before what it was ("Tak! Dwa!"). */
export const YES_STEP = ['Tak!', 'Brawo!', 'Super!'];

/** Where each place is, as in "Jedziemy …" / "Może …?" */
const PLACE_TO = {
  letters: 'do Kociego Parku',
  balloons: 'na Balonową Łąkę',
  name: 'do Literkowego Pociągu',
  cones: 'na Pachołkową Drogę',
  stones: 'nad rzekę',
  lookout: 'do Bazy',
  counting: 'do Domku ze Smakołykami',
  delivery: 'na pocztę',
  picnic: 'na piknik',
  garage: 'do garażu',
};
export const PLACE_LINES = Object.fromEntries(Object.entries(PLACE_TO).map(([k, to]) => [k, `Jedziemy ${to}!`]));

export const T = {
  number: (n) => [`${cap(NUM[n])}!`],
  praise: (i) => [PRAISE[i]],

  // hub
  greet: () => [`Cześć, ${voc}! ${pup} gotowy do akcji! Dokąd jedziemy?`],
  hubAgain: () => ['Dokąd teraz jedziemy?', 'Wybierz nową misję!', 'Brawo! Gdzie teraz?'],
  hubIdle: () => ['Dotknij miejsca, żeby zacząć misję!'],
  suggest: (kind) => [`Może ${PLACE_TO[kind]}?`],
  finaleCall: () => ['Teraz wielka misja w Bazie! Dotknij Bazy!'],
  sessionDone: () => [`Wspaniała przygoda, ${voc}! Psi Patrol dziękuje!`, 'Możesz dalej się bawić!'],
  oneMore: () => [`Jeszcze tylko jedno, ${voc}!`],
  // Pup Delivery: first sounds
  deliveryStart: () => [`Poczta! ${pup} roznosi paczki!`],
  startsWith: (l) => [`Co zaczyna się na ${L(l)}?`],
  whichBox: (l) => [`Do której skrzynki pójdzie ${word(l).toLowerCase() === kid.toLowerCase() ? kid : word(l)}?`],
  // Pup Picnic: more, less, the same
  picnicStart: () => [`Piknik! ${pup} jest głodny!`],
  askMore: () => ['Gdzie jest więcej smakołyków?'],
  askLess: () => ['Gdzie jest mniej smakołyków?'],
  askSame: () => [`Gdzie jest tyle samo, co u ${pupGen}?`],
  yesMore: () => ['Tak! Tu jest więcej!'],
  yesLess: () => ['Tak! Tu jest mniej!'],
  yesSame: () => ['Tak! Tyle samo!'],
  noMore: () => ['Nie, tu jest więcej.'],
  noLess: () => ['Nie, tu jest mniej.'],
  lookCarefully: () => ['Popatrz uważnie!'],
  // Adventure Bay changes (said the first time the hub shows them)
  worldKitten: () => ['Zobacz! Uratowany kotek bawi się teraz koło parku!'],
  worldBridge: () => ['Zobacz! Nad rzeką stoi nowy most!'],
  worldTrain: () => ['Ciuch, ciuch! Pociąg jeździ teraz dookoła wyspy!'],
  worldBalloon: () => ['Nowy balonik przy Bazie!'],
  worldLights: () => ['Baza świeci kolorowymi światełkami!'],
  // hub events: little stories that point at a place
  eventKitten: () => ['Ojej! Kotek potrzebuje pomocy! Dotknij kotka!'],
  eventBalloons: () => ['Ojej! Baloniki uciekają! Dotknij balonika!'],
  eventAlarm: () => ['Alarm w Bazie! Psi Patrol, do akcji! Dotknij Bazy!'],
  restTime: () => [`Super się bawiliśmy, ${voc}! Teraz czas na odpoczynek. Psi Patrol dziękuje!`],
  tapGirl: () => [`To ${kid}!`, `Cześć, ${voc}!`, `${kid} i ${pup}, gotowi do akcji!`],
  tapPup: () => ['Hau, hau!', `${pup} rusza do akcji!`, 'Gotowy do akcji!'],
  go: (kind) => [PLACE_LINES[kind]],

  // end of every mission
  done: () => [`Udało się, ${voc}! Misja zakończona! Zdobywasz odznakę!`],
  levelUp: (lvl) => [`I nową gwiazdkę! Poziom ${NUM[lvl]}!`],

  // shared "wrong answer" feedback
  no: () => [NO[Math.floor(Math.random() * NO.length)]],
  noLookalike: (l) => [`Nie, to ${L(l)}.`],
  yesStep: () => [YES_STEP[Math.floor(Math.random() * YES_STEP.length)]],
  here: () => ['Tutaj!'], // the answer is pulsing (the last step of help)
  whereLetter: (l) => [`Gdzie jest ${L(l)}?`],
  findLetter: (l) => [`Znajdź ${L(l)}!`],
  whereNumber: (n) => [`Gdzie jest numer ${NUM[n]}?`],
  letter: (l) => [`${L(l)}!`],

  // Kitty Park
  kittyAsk: (l) => [`Kotek schował się za literą ${L(l)}! Znajdź ${L(l)}! ${L(l)} jak ${word(l)}!`],
  kittyFound: (l) => [`Znalazłaś kotka! ${L(l)} jak ${word(l)}!`],
  // Kitty Park V2: how each level asks
  kittyHid: () => ['Kotek się schował!'],
  kittyMatch: () => ['Kotek schował się za taką literką! Znajdź taką samą!'],
  findSame: () => ['Znajdź taką samą literkę!'],
  whichSound: (l) => [`Która literka robi: ${ph(l)}?`],
  soundLike: (l) => [`${cap(ph(l))}… jak ${word(l)}!`],
  soundIs: (l) => [`${cap(ph(l))}… to ${L(l)}!`],

  // Balloon Hill
  balloonAsk: (l) => [`Przebij balony z literą ${L(l)}! Ile ich znajdziesz?`],
  balloonDone: (l) => [`Wszystkie balony z literą ${L(l)}! ${L(l)} jak ${word(l)}!`],

  // Name Train
  spellStart: (w) => [`Ułóżmy słowo ${sayWord(w)}! Znajdź ${L(w[0])}!`],
  spellNext: (l) => [`Teraz ${L(l)}!`],
  spellWord: (w) => [`${sayWord(w)}!`],
  syllable: (s) => [`${cap(s.toLowerCase())}!`], // the finale claps the word: "Zo!" "Sia!" then "Zosia!"
  // what a finished word turns into (Name Train): her name, a thing, or a kiss for whoever it is (whose: "mamy")
  wordPicture: (w, whose) => ({ KOT: ['Kot mówi: miau!'], DOM: ['Dom! Tu mieszkamy!'] })[w]
    || (w === CONFIG.childName.toUpperCase() ? [`To ty, ${voc}! Twoje imię!`] : whose ? [`Buziaczek dla ${whose}!`] : []),
  // Name Train V2
  wordStart: (w) => [`Ułóżmy słowo ${sayWord(w)}! Pierwsza literka!`],
  whichNow: () => ['Która teraz?'], // (word mode: the next wagon glows)
  lookAtWord: () => ['Popatrz na słowo!'],
  missingAsk: (w, gaps) => [`Pociąg wiezie słowo ${sayWord(w)}. ${gaps > 1 ? 'Których literek' : 'Której literki'} brakuje?`],
  whichMissing: () => ['Której literki brakuje?'],
  // Name Train "whose": find the train with her name (whose: the name as in "pociąg Zosi")
  trainsCame: () => ['Przyjechały pociągi!'],
  whoseAsk: (whose) => [`Który pociąg jest ${whose}?`],
  whoseIs: (whose) => [`To pociąg ${whose}!`],

  yes: () => ['Tak!'],
  letterLike: (l) => [`${L(l)} jak ${word(l)}!`],
  howManyShort: () => ['Ile smakołyków?'],
  tapTheBox: () => ['Dotknij pudełka!'],
  countTogether: () => ['Policzmy razem!'],

  // Cone Road
  conesFirst: (n) => [`Ojej! Pachołki na drodze! Dotknij pachołka z numerem ${NUM[n]}!`],
  conesMore: (n) => [`Więcej pachołków! Dotknij numeru ${NUM[n]}!`],
  conesWhich: (n, first) => [...(first ? ['Ojej! Pachołki na drodze!'] : []), `Który pachołek ma ${dotsAcc(n)}?`],
  conesDots: (first) => [first ? 'Ojej! Pachołki na drodze! Policz kropki i znajdź ten numer!' : 'Policz kropki! Który to numer?'],
  dots: (n) => [`${cap(NUM_F[n])} ${n === 1 ? 'kropka' : n <= 4 ? 'kropki' : 'kropek'}!`],

  // River
  riverFirst: () => [`Pomóż ${dat} przejść przez rzekę! Dotknij numeru jeden!`],
  riverAgain: () => ['Nowa rzeka! Zacznij od numeru jeden!'],
  riverNext: (n) => [`Teraz numer ${NUM[n]}!`],
  riverDone: (n) => [`Udało się! Policzyłaś do ${NUM_GEN[n]}!`],
  riverWhatNext: () => ['A teraz? Co jest dalej?'],
  riverMissing: () => ['Ojej! Brakuje jednego kamienia! Który numer pasuje?'],
  whichFits: () => ['Który numer pasuje?'],
  riverFirstNext: () => [`Pomóż ${dat} przejść przez rzekę! Zacznij od jedynki, a potem po kolei!`],

  // Treat House
  treatsDone: (n) => [`${cap(NUM[n])} ${treats(n)}!`],
  yum: () => ['Mniam, mniam! Dziękuję!'],

  // The Lookout (Baza): elevator + slide
  liftStart: () => ['Do Bazy! Wsiadamy do windy!'],
  finaleStart: () => ['Alarm w Bazie! Szybko, wsiadamy do windy!'],
  finaleDone: () => [`Hura! Psi Patrol uratował dzień! Brawo, ${voc}!`],
  liftGo: (n) => [`Jedziemy na piętro numer ${NUM[n]}! Wciśnij guzik z numerem ${NUM[n]}!`],
  liftPress: (n) => [`Wciśnij guzik z numerem ${NUM[n]}!`],
  liftRel: (cur, up) => [`Jesteśmy na piętrze numer ${NUM[cur]}. Jedź jedno piętro ${up ? 'wyżej' : 'niżej'}!`],
  liftArrived: (n) => [`Piętro numer ${NUM[n]}!`],
  liftTop: () => ['Jedziemy na samą górę! Psi Patrol, gotowi do akcji!'],
  // the Lookout's lost kittens: one waits on a floor each ride, and they all come down the slide at the end
  kittensStart: () => ['Kotki zgubiły się w Bazie!'],
  kittenAt: (n) => [`Kotek czeka na piętrze ${NUM[n]}! Wciśnij ${NUM[n]}!`],
  kittenWhere: () => ['Na którym piętrze czeka kotek? Wciśnij ten numer!'],
  kittenLook: () => ['Zobacz numer obok kotka!'],
  kittenIn: () => ['Hop! Kotek wsiada do windy!', 'Miau! Kotek jest z nami!', 'Hop! Jedziemy razem!'], // (variants: the scene picks one)
  kittensAll: () => ['Wszystkie kotki są z nami! Jedziemy na samą górę!'],
  slide: () => ['A teraz zjeżdżalnia! Juhuuu!'],
  howMany: () => [`Ile smakołyków ma ${pup}? Policz i dotknij numeru!`],
  giveThenTap: (n) => [`Daj ${pupDat} ${NUM[n]} ${treats(n)}, a potem dotknij ${pupGen}!`],
  tapPupWhenDone: () => [`Gotowe? Dotknij ${pupGen}!`],
  treatsGive: (n) => [`${pup} jest głodny! Daj mu ${NUM[n]} ${treats(n)}!`],
  dragTreat: () => [`Przesuń smakołyk do ${pupGen}!`],
  tapTreat: () => ['Dotknij smakołyka!'], // (the clue: a tap is enough, it hops over by itself)
  tooMany: () => ['Oj, za dużo! Jeden oddaję.'],
  tooFew: () => ['Za mało! Jeszcze!'],
  // Treat House "share": everyone gets one
  shareStart: (n) => [`${pup} i ${n === 2 ? 'kotek' : 'kotki'} są głodne! Każdy dostaje jeden smakołyk!`], // (animals: the non-personal plural)
  shareRule: () => ['Każdy dostaje jeden smakołyk!'],
  shareWho: () => ['Kto jeszcze nie ma smakołyka?'],
  shareHasOne: () => ['Nie, ten już ma!'],
  shareDone: () => ['Każdy ma jeden!'],
  shareYum: () => ['Mniam, mniam! Dziękujemy!'],

  // The Garage: the cruiser's door (shapes), the flags (patterns), the blocks (sorting)
  doorBroken: () => ['Ojej! Drzwi radiowozu są zepsute!'],
  shapeFits: () => ['Który kształt pasuje?'],
  shape: (s) => [`${cap(SHAPE[s])}!`],
  whereShape: (s) => [`Gdzie jest ${SHAPE[s]}?`],
  shapeClue: (s) => [SHAPE_CLUE[s]],
  noShape: (s) => [`Nie, to ${SHAPE[s]}.`],
  shapeLast: (s) => [`I ${SHAPE[s]}!`],
  doorFixed: () => ['Drzwi naprawione!'],
  flagsStart: () => ['Wieszamy flagi!'],
  flagNext: () => ['Jaka flaga teraz?'],
  flagGap: () => ['Jakiej flagi brakuje?'],
  flag: (c) => [`${cap(COLOUR[c][1])}!`],
  noFlag: (c) => [`Nie, ta jest ${COLOUR[c][1]}.`],
  blocksStart: () => ['Sprzątamy klocki!'],
  block: (rule, v) => [`${cap(sorted(rule, v)[0])} klocek!`],
  whichBasket: () => ['Do którego koszyka?'],
  into: (rule, v) => [`${cap(sorted(rule, v)[0])} do ${sorted(rule, v).at(-1)}!`],
  noBasket: (rule, v) => [`Nie, ten koszyk jest ${sorted(rule, v)[0]}.`],
  sortSwitch: () => ['Teraz duże i małe!', 'Duży do dużego, mały do małego!'],
  tidied: () => ['Posprzątane!'],
};

/**
 * Every segment the game can say, for the clip generator. Derived from the level data (GAME.md),
 * so adding words, letters, floors or levels there automatically adds what needs recording.
 */
export function allSegments(levels, allLetters) {
  const words = [...new Set(levels.name.flatMap((l) => l.words))];
  const letters = new Set(allLetters);
  const nums = Array.from({ length: 10 }, (_, i) => i + 1);
  const floors = Math.max(...levels.lookout.map((l) => l.max));
  const maxLevels = Math.max(...Object.values(levels).map((l) => l.length));
  const out = [];
  const add = (segs) => out.push(...segs);
  nums.slice(0, floors).forEach((n) => { add(T.liftGo(n)); add(T.liftPress(n)); add(T.liftArrived(n)); add(T.kittenAt(n)); if (n < floors) add(T.liftRel(n, true)); if (n > 1) add(T.liftRel(n, false)); });
  nums.forEach((n) => { add(T.dots(n)); add(T.giveThenTap(n)); add(T.number(n)); add(T.whereNumber(n)); add(T.conesFirst(n)); add(T.conesMore(n)); add(T.conesWhich(n, true)); add(T.conesWhich(n, false)); add(T.riverNext(n)); add(T.riverDone(n)); add(T.treatsGive(n)); add(T.treatsDone(n)); });
  [2, 3, 4].forEach((n) => add(T.shareStart(n)));
  PRAISE.forEach((_, i) => add(T.praise(i)));
  letters.forEach((l) => { add(T.letterLike(l)); add(T.noLookalike(l)); add(T.whereLetter(l)); add(T.findLetter(l)); add(T.letter(l)); add(T.kittyFound(l)); add(T.balloonAsk(l)); add(T.balloonDone(l)); add(T.spellNext(l)); });
  // letter sounds, for Kitty Park levels that ask "Która literka robi: mmm?"
  const sounds = new Set(levels.letters.filter((l) => l.ask === 'sound').flatMap((l) => [...l.pool]));
  sounds.forEach((l) => { add(T.whichSound(l)); add(T.soundLike(l)); add(T.soundIs(l)); });
  // Pup Delivery: every letter its levels can ask
  new Set((levels.delivery || []).flatMap((l) => [...l.pool])).forEach((l) => { add(T.startsWith(l)); add(T.whichBox(l)); add(T.letterLike(l)); });
  // Name Train: each row's words, their syllables, and whose they are; letters only names use (Y) get the train's lines
  new Set(words.join('')).forEach((l) => { if (!letters.has(l)) { add(T.letter(l)); add(T.findLetter(l)); add(T.spellNext(l)); } });
  levels.name.forEach((row) => row.words.forEach((w) => {
    if (row.mode === 'whose') { if (row.whose[w]) { add(T.whoseAsk(row.whose[w])); add(T.whoseIs(row.whose[w])); } return; }
    if (row.mode === 'missing') add(T.missingAsk(w, gapCount(w, row.gaps)));
    else add([...T.spellStart(w), ...(row.mode === 'word' ? T.wordStart(w) : [])]); // (a gentler run of the others is ghost)
    add(T.spellWord(w)); add(T.wordPicture(w, row.whose[w]));
    row.syllables[w].forEach((s) => add(T.syllable(s)));
  }));
  Object.keys(PLACE_LINES).forEach((k) => { add(T.go(k)); add(T.suggest(k)); });
  for (let l = 2; l <= maxLevels; l++) add(T.levelUp(l));
  [T.greet, T.hubAgain, T.hubIdle, T.tapGirl, T.tapPup, T.done, T.riverFirst, T.riverAgain, T.yum, T.yes, T.countTogether,
    T.riverWhatNext, T.riverFirstNext, T.howMany, T.tapPupWhenDone, T.tooMany, T.tooFew, T.liftStart, T.liftTop, T.slide, T.tapTreat, T.shareRule, T.shareWho, T.shareHasOne, T.shareDone, T.shareYum, T.kittensStart, T.kittenWhere, T.kittenLook, T.kittenIn, T.kittensAll,
    T.howManyShort, T.tapTheBox, T.finaleCall, T.sessionDone, T.oneMore, T.restTime,
    T.worldKitten, T.worldBridge, T.worldTrain, T.worldBalloon, T.worldLights,
    T.eventKitten, T.eventBalloons, T.eventAlarm, T.finaleStart, T.finaleDone, T.kittyHid, T.kittyMatch, T.findSame, T.whichNow, T.lookAtWord, T.trainsCame, T.whichMissing, T.dragTreat, T.riverMissing, T.whichFits,
    T.deliveryStart, T.picnicStart, T.askMore, T.askLess, T.askSame, T.yesMore, T.yesLess, T.yesSame, T.noMore, T.noLess, T.lookCarefully, T.here].forEach((f) => add(f()));
  [...NO, ...YES_STEP].forEach((line) => add([line]));
  add(T.conesDots(true)); add(T.conesDots(false));
  // the Garage
  Object.keys(SHAPE).forEach((sh) => { add(T.shape(sh)); add(T.whereShape(sh)); add(T.shapeClue(sh)); add(T.noShape(sh)); add(T.shapeLast(sh)); });
  Object.keys(COLOUR).forEach((c) => { add(T.flag(c)); add(T.noFlag(c)); add(T.block('colour', c)); add(T.into('colour', c)); add(T.noBasket('colour', c)); });
  Object.keys(SIZE).forEach((sz) => { add(T.block('size', sz)); add(T.into('size', sz)); add(T.noBasket('size', sz)); });
  [T.doorBroken, T.shapeFits, T.doorFixed, T.flagsStart, T.flagNext, T.flagGap, T.blocksStart, T.whichBasket, T.sortSwitch, T.tidied].forEach((f) => add(f()));
  return [...new Set(out)];
}
