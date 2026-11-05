// Saturn's pieces as data: which kind comes next, and how big it is. Pure (rng passed in), so
// tests/levels/saturn.test.js checks the rules and scenes/saturn.js only draws what this decides.

export const KINDS = ['ice', 'rock'];

const shuffle = (a, random) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const sizeBag = (n, sizes, random) => (sizes === 'mixed'
  ? shuffle([...Array(Math.ceil(n / 2)).fill('big'), ...Array(Math.floor(n / 2)).fill('small')], random)
  : Array(n).fill('same'));

/**
 * The pieces in the order they float in: [{ kind, size }]. Both kinds always come, their counts differ
 * by at most one, and no three of a kind are ever in a row. With mixed sizes each kind gets its own
 * share of big and small, so size never tells her the answer.
 */
export function saturnPieces({ pieces, sizes }, random = Math.random) {
  const left = { ice: Math.ceil(pieces / 2), rock: Math.floor(pieces / 2) };
  const bags = Object.fromEntries(KINDS.map((kind) => [kind, sizeBag(left[kind], sizes, random)]));
  const order = [];
  const place = () => {
    if (order.length === pieces) return true;
    const last = order.at(-1), before = order.at(-2);
    const open = shuffle(KINDS.filter((kind) => left[kind] > 0 && !(last === kind && before === kind)), random);
    for (const kind of open) {
      order.push(kind);
      left[kind]--;
      if (place()) return true;
      order.pop();
      left[kind]++;
    }
    return false;
  };
  place();
  return order.map((kind) => ({ kind, size: bags[kind].pop() }));
}
