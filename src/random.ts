/**
 * The `Random` class: a seedable pseudo-random number generator.
 *
 * @module random
 */

import { hashString, splitmix32 } from './hash.js';

/**
 * A snapshot of a generator's internal state: four unsigned 32-bit words.
 *
 * Get one with `getState()` and restore it with `setState()` to pause and
 * resume a sequence exactly, for save games or rewinding a demo.
 */
export type RandomState = readonly [number, number, number, number];

/** 2^32, for scaling a uint32 into [0, 1). */
const UINT32_RANGE = 0x1_0000_0000;

/**
 * How many outputs to discard after seeding. splitmix32 already mixes the
 * state well, so this is belt and braces, as recommended for sfc32.
 */
const WARMUP_ROUNDS = 12;

/**
 * A seedable pseudo-random number generator.
 *
 * The same seed always gives the same sequence, on every platform. Pass a
 * number or a string; leave it out for a random seed, which is still stored in
 * `seed` so any run can be logged and replayed:
 *
 * ```ts
 * const rng = new Random();
 * console.log(`seed: ${rng.seed}`); // replay later with new Random(rng.seed)
 *
 * rng.int(1, 7); // a die roll, 1 to 6
 * rng.pick(['moss', 'stone', 'root']);
 * ```
 *
 * The algorithm is sfc32 (128 bits of state, passes PractRand), seeded through
 * splitmix32. It is fast and statistically good, but **not cryptographically
 * secure**: never use it for tokens, keys or anything an attacker could
 * predict.
 *
 * Changing the algorithm or the seeding changes every seeded sequence, so it
 * counts as a breaking change.
 */
export class Random {
  /**
   * The 32-bit seed this generator started from.
   *
   * Number seeds are reduced to 32 bits (`>>> 0`), and string seeds are
   * hashed with `hashString`, so `new Random(rng.seed)` always replays `rng`
   * from the start, whatever it was created with.
   */
  readonly seed: number;

  #a = 0;
  #b = 0;
  #c = 0;
  #d = 0;

  /**
   * @param seed - A number or string to seed from. Omit it for a random seed
   *   from `crypto.getRandomValues`.
   */
  constructor(seed?: number | string) {
    this.seed = resolveSeed(seed);
    const mix = splitmix32(this.seed);
    this.#a = mix();
    this.#b = mix();
    this.#c = mix();
    this.#d = mix();
    for (let i = 0; i < WARMUP_ROUNDS; i++) this.nextUint32();
  }

  /**
   * Returns the next unsigned 32-bit integer, from 0 to 2^32 - 1.
   *
   * This is the core step; every other method is built on it.
   */
  nextUint32(): number {
    // sfc32
    const t = (((this.#a + this.#b) | 0) + this.#d) | 0;
    this.#d = (this.#d + 1) | 0;
    this.#a = this.#b ^ (this.#b >>> 9);
    this.#b = (this.#c + (this.#c << 3)) | 0;
    this.#c = (this.#c << 21) | (this.#c >>> 11);
    this.#c = (this.#c + t) | 0;
    return t >>> 0;
  }

  /**
   * Returns the next number from 0 (inclusive) to 1 (exclusive), like
   * `Math.random()`.
   *
   * It's an arrow function, so it can be passed around on its own wherever a
   * `() => number` is expected: `points.sort(rng.next)` or `noise(rng.next)`.
   */
  readonly next = (): number => this.nextUint32() / UINT32_RANGE;

  /**
   * Returns a whole number from `min` (inclusive) to `max` (exclusive).
   *
   * Unbiased: every value in the range is exactly equally likely.
   *
   * @throws {RangeError} If either bound isn't a safe integer, if `max` isn't
   *   greater than `min`, or if the range is wider than 2^32.
   */
  int(min: number, max: number): number {
    if (!(Number.isSafeInteger(min) && Number.isSafeInteger(max))) {
      throw new RangeError(`int() bounds must be safe integers, got ${min} and ${max}`);
    }
    const range = max - min;
    if (range <= 0) throw new RangeError(`int() needs max > min, got ${min} and ${max}`);
    if (range > UINT32_RANGE) throw new RangeError(`int() range can't exceed 2^32, got ${range}`);

    // Rejection sampling: drop the top sliver of uint32s that would make
    // `x % range` favour low values. Almost always accepts on the first draw.
    const limit = UINT32_RANGE - (UINT32_RANGE % range);
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return min + (x % range);
  }

  /** Returns a number from `min` (inclusive) to `max` (exclusive). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns `true` with probability `p`.
   *
   * `chance(0.25)` is true about a quarter of the time. `p <= 0` is never true
   * and `p >= 1` is always true.
   */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Returns a random item from `items`.
   *
   * @throws {RangeError} If `items` is empty.
   */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick() needs at least one item');
    return items[this.int(0, items.length)] as T;
  }

  /**
   * Returns a random item from `items`, where each item's chance is its weight
   * divided by the total. A weight of `0` is never picked.
   *
   * ```ts
   * rng.weighted(['common', 'rare', 'legendary'], [90, 9, 1]);
   * ```
   *
   * @throws {RangeError} If the arrays differ in length, any weight is
   *   negative or not finite, or the weights add up to 0.
   */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length) {
      throw new RangeError(
        `weighted() needs one weight per item, got ${items.length} items and ${weights.length} weights`
      );
    }
    let total = 0;
    for (const weight of weights) {
      if (!(Number.isFinite(weight) && weight >= 0)) {
        throw new RangeError(`weighted() weights must be finite and non-negative, got ${weight}`);
      }
      total += weight;
    }
    if (total <= 0) throw new RangeError('weighted() needs at least one positive weight');

    let remaining = this.next() * total;
    let last = 0;
    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i] as number;
      if (weight === 0) continue;
      if (remaining < weight) return items[i] as T;
      remaining -= weight;
      last = i;
    }
    // Floating-point rounding can leave `remaining` a hair above the last
    // weight; that draw belongs to the last item that could be picked.
    return items[last] as T;
  }

  /**
   * Shuffles `items` in place (Fisher–Yates) and returns it.
   *
   * Every ordering is equally likely. Copy first (`rng.shuffle([...items])`)
   * to keep the original.
   */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const item = items[i] as T;
      items[i] = items[j] as T;
      items[j] = item;
    }
    return items;
  }

  /**
   * Returns a new, independent generator for the stream named `label`.
   *
   * The child's seed comes from this generator's `seed` and the label, never
   * from its current state, so:
   *
   * - forking never advances or disturbs this generator;
   * - the same label always gives the same stream, however far this
   *   generator has got and whichever other streams were forked first.
   *
   * Give each system its own stream, so adding a particle doesn't change the
   * loot:
   *
   * ```ts
   * const world = new Random(seed);
   * const terrain = world.fork('terrain');
   * const loot = world.fork('loot');
   * ```
   */
  fork(label: string): Random {
    return new Random(`${this.seed}:${label}`);
  }

  /**
   * Returns a copy at exactly the same point in the sequence. The copy and
   * the original then advance independently.
   */
  clone(): Random {
    const copy = new Random(this.seed);
    copy.setState(this.getState());
    return copy;
  }

  /** Returns a snapshot of the current state. See `RandomState`. */
  getState(): RandomState {
    return [this.#a >>> 0, this.#b >>> 0, this.#c >>> 0, this.#d >>> 0];
  }

  /**
   * Restores a state from `getState()`, so the sequence continues from that
   * point. `seed` is unchanged.
   *
   * @throws {RangeError} If `state` isn't four unsigned 32-bit integers.
   */
  setState(state: RandomState): void {
    if (state.length !== 4 || !state.every(isUint32)) {
      throw new RangeError('setState() needs four unsigned 32-bit integers');
    }
    const [a, b, c, d] = state;
    this.#a = a | 0;
    this.#b = b | 0;
    this.#c = c | 0;
    this.#d = d | 0;
  }
}

function resolveSeed(seed: number | string | undefined): number {
  if (typeof seed === 'string') return hashString(seed);
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) throw new RangeError(`Seed must be finite, got ${seed}`);
    return seed >>> 0;
  }
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}

function isUint32(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < UINT32_RANGE;
}
