/**
 * Small 32-bit hashing helpers used for seeding.
 *
 * @module hash
 */

/**
 * Hashes a string to an unsigned 32-bit integer using FNV-1a.
 *
 * This is what `new Random('some-seed')` uses to turn a string seed into a
 * number, so `new Random(hashString('abc'))` and `new Random('abc')` produce
 * the same sequence. It is fast and stable, not cryptographic.
 */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Returns a splitmix32 generator starting from `seed`.
 *
 * Used to expand one 32-bit seed into the four state words `Random` needs:
 * splitmix32 scrambles every bit, so nearby seeds such as `1` and `2` still
 * give unrelated states.
 *
 * @internal
 */
export function splitmix32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x9e3779b9) | 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}
