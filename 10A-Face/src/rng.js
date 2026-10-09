// PRNG determinista (mulberry32): misma semilla → mismo resultado en vivo y en exportación
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.chance = (p) => next() < p;
  next.gauss = () => (next() + next() + next() + next() - 2) / 2; // ~N(0, ~0.58), acotada a [-1,1]
  return next;
}
