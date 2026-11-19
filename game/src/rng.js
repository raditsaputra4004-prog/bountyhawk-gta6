// A tiny deterministic random-number source. The world, the traffic and the
// staged screenshot scenes all draw from this, so one seed always builds
// the same city and the same frame.

export function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function rangeInt(rng, low, high) {
  return low + Math.floor(rng() * (high - low + 1));
}

export function chance(rng, p) {
  return rng() < p;
}

// Deterministic string hash, so a name or a seed word always maps to the
// same number (used for district colours and name plates).
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
