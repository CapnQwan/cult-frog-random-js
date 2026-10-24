// src/__tests__/random.test.ts

import { hashString, Random, random } from '@cult-frog/random';
import { describe, expect, test } from 'vitest';

import type { RandomState } from '@cult-frog/random';

const DRAWS = 10_000;

/** The first `count` values of `draw`. */
function take<T>(count: number, draw: () => T): T[] {
  return Array.from({ length: count }, draw);
}

/** How often each value from `min` to `max - 1` comes up over `DRAWS` calls of `int`. */
function intCounts(rng: Random, min: number, max: number): number[] {
  const counts = new Array<number>(max - min).fill(0);
  for (let i = 0; i < DRAWS; i++) {
    const index = rng.int(min, max) - min;
    counts[index] = (counts[index] as number) + 1;
  }
  return counts;
}

/**
 * sfc32 exactly as published in Chris Doty-Humphrey's PractRand, ported to
 * JS, as an independent check that `nextUint32` is the real algorithm.
 */
function referenceSfc32(state: RandomState): () => number {
  let [a, b, c, d] = state.map((word) => word | 0) as [number, number, number, number];
  return () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
}

describe('seeding', () => {
  test('a seed always gives the same sequence', () => {
    // Golden values: if these change, every seeded sequence has changed, which
    // is a breaking change for anyone replaying a seed.
    const rng = new Random(42);
    expect(take(5, () => rng.nextUint32())).toEqual([
      1028872839, 2516511472, 400437680, 853279530, 1920286840,
    ]);
  });

  test('two generators with the same seed stay in step', () => {
    const a = new Random(7);
    const b = new Random(7);
    expect(take(100, a.next)).toEqual(take(100, b.next));
  });

  test('nearby seeds give unrelated sequences', () => {
    const a = new Random(1);
    const b = new Random(2);
    expect(take(10, a.next)).not.toEqual(take(10, b.next));
  });

  test('string seeds are hashed with hashString', () => {
    expect(new Random('abyssal-rebirth').seed).toBe(hashString('abyssal-rebirth'));
    expect(take(10, new Random('abc').next)).toEqual(take(10, new Random(hashString('abc')).next));
  });

  test('number seeds are reduced to 32 bits', () => {
    expect(new Random(-1).seed).toBe(0xffffffff);
    expect(new Random(2 ** 32 + 5).seed).toBe(5);
    expect(new Random(3.9).seed).toBe(3);
  });

  test('rejects non-finite seeds', () => {
    expect(() => new Random(Number.NaN)).toThrow(RangeError);
    expect(() => new Random(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  test('an unseeded generator keeps its seed, so it can be replayed', () => {
    const rng = new Random();
    expect(Number.isInteger(rng.seed)).toBe(true);
    const replay = new Random(rng.seed);
    expect(take(10, rng.next)).toEqual(take(10, replay.next));
  });

  test('unseeded generators get different seeds', () => {
    const seeds = new Set(take(20, () => new Random().seed));
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe('nextUint32', () => {
  test('matches the reference sfc32 from the same state', () => {
    const rng = new Random(123);
    const reference = referenceSfc32(rng.getState());
    expect(take(1000, () => rng.nextUint32())).toEqual(take(1000, reference));
  });

  test('stays within 0 to 2^32 - 1', () => {
    const rng = new Random(1);
    for (const value of take(DRAWS, () => rng.nextUint32())) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });
});

describe('next', () => {
  test('stays within [0, 1)', () => {
    const values = take(DRAWS, new Random(1).next);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  test('averages about 0.5', () => {
    const values = take(DRAWS, new Random(1).next);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });

  test('works detached from its instance', () => {
    const rng = new Random(9);
    const { next } = rng;
    const same = new Random(9);
    expect(take(10, next)).toEqual(take(10, same.next));
  });
});

describe('int', () => {
  test('includes min and excludes max', () => {
    const rng = new Random(2);
    expect(new Set(take(100, () => rng.int(0, 1)))).toEqual(new Set([0]));

    const rolls = new Set(take(DRAWS, () => rng.int(1, 7)));
    expect(rolls).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  test('handles negative ranges', () => {
    const rng = new Random(3);
    const values = new Set(take(DRAWS, () => rng.int(-3, 0)));
    expect(values).toEqual(new Set([-3, -2, -1]));
  });

  test('is roughly uniform', () => {
    const counts = intCounts(new Random(4), 0, 10);
    const expected = DRAWS / 10;
    for (const count of counts) {
      expect(Math.abs(count - expected)).toBeLessThan(expected * 0.15);
    }
  });

  test('handles the full 2^32 range', () => {
    const rng = new Random(5);
    for (const value of take(100, () => rng.int(0, 2 ** 32))) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });

  test('rejects bad bounds', () => {
    const rng = new Random(6);
    expect(() => rng.int(5, 5)).toThrow(RangeError);
    expect(() => rng.int(5, 1)).toThrow(RangeError);
    expect(() => rng.int(0, 1.5)).toThrow(RangeError);
    expect(() => rng.int(0, Number.NaN)).toThrow(RangeError);
    expect(() => rng.int(0, 2 ** 32 + 1)).toThrow(RangeError);
  });
});

describe('float', () => {
  test('stays within [min, max)', () => {
    const rng = new Random(1);
    for (const value of take(DRAWS, () => rng.float(-2, 3))) {
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThan(3);
    }
  });
});

describe('chance', () => {
  test('0 is never true and 1 is always true', () => {
    const rng = new Random(1);
    expect(take(DRAWS, () => rng.chance(0)).some(Boolean)).toBe(false);
    expect(take(DRAWS, () => rng.chance(1)).every(Boolean)).toBe(true);
  });

  test('is true about p of the time', () => {
    const rng = new Random(2);
    const hits = take(DRAWS, () => rng.chance(0.25)).filter(Boolean).length;
    expect(hits / DRAWS).toBeCloseTo(0.25, 1);
  });
});

describe('pick', () => {
  test('returns every item eventually, and nothing else', () => {
    const rng = new Random(1);
    const items = ['moss', 'stone', 'root'];
    expect(new Set(take(1000, () => rng.pick(items)))).toEqual(new Set(items));
  });

  test('rejects an empty array', () => {
    expect(() => new Random(1).pick([])).toThrow(RangeError);
  });
});

describe('weighted', () => {
  test('picks in proportion to the weights', () => {
    const rng = new Random(1);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < DRAWS; i++) counts[rng.weighted(['a', 'b', 'c'] as const, [1, 2, 7])]++;
    expect(counts.a / DRAWS).toBeCloseTo(0.1, 1);
    expect(counts.b / DRAWS).toBeCloseTo(0.2, 1);
    expect(counts.c / DRAWS).toBeCloseTo(0.7, 1);
  });

  test('never picks a zero weight', () => {
    const rng = new Random(2);
    const picks = new Set(take(DRAWS, () => rng.weighted(['a', 'b', 'c', 'd'], [0, 1, 0, 1])));
    expect(picks).toEqual(new Set(['b', 'd']));
  });

  test('rejects mismatched or invalid weights', () => {
    const rng = new Random(3);
    expect(() => rng.weighted(['a', 'b'], [1])).toThrow(RangeError);
    expect(() => rng.weighted(['a', 'b'], [1, -1])).toThrow(RangeError);
    expect(() => rng.weighted(['a'], [Number.NaN])).toThrow(RangeError);
    expect(() => rng.weighted(['a'], [Number.POSITIVE_INFINITY])).toThrow(RangeError);
    expect(() => rng.weighted(['a', 'b'], [0, 0])).toThrow(RangeError);
    expect(() => rng.weighted([], [])).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  test('shuffles in place and keeps every item', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = new Random(1).shuffle(items);
    expect(result).toBe(items);
    expect([...items].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(items).not.toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  test('the same seed gives the same order', () => {
    const order = () => new Random(2).shuffle(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(order()).toEqual(order());
  });

  test('every ordering of three items comes up about equally often', () => {
    const rng = new Random(3);
    const counts = new Map<string, number>();
    for (let i = 0; i < DRAWS; i++) {
      const key = rng.shuffle(['a', 'b', 'c']).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const count of counts.values()) {
      expect(Math.abs(count - DRAWS / 6)).toBeLessThan((DRAWS / 6) * 0.15);
    }
  });

  test('handles empty and single-item arrays', () => {
    const rng = new Random(4);
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle(['only'])).toEqual(['only']);
  });
});

describe('fork', () => {
  test('the same label always gives the same stream', () => {
    const world = new Random(1);
    expect(take(10, world.fork('loot').next)).toEqual(take(10, world.fork('loot').next));
  });

  test('different labels give different streams', () => {
    const world = new Random(1);
    expect(take(10, world.fork('loot').next)).not.toEqual(take(10, world.fork('terrain').next));
  });

  test('does not advance the parent', () => {
    const forked = new Random(2);
    forked.fork('loot');
    expect(take(10, forked.next)).toEqual(take(10, new Random(2).next));
  });

  test("doesn't depend on how far the parent has got", () => {
    const fresh = new Random(3);
    const used = new Random(3);
    take(50, used.next);
    expect(take(10, used.fork('loot').next)).toEqual(take(10, fresh.fork('loot').next));
  });

  test('depends on the parent seed', () => {
    expect(take(10, new Random(4).fork('loot').next)).not.toEqual(
      take(10, new Random(5).fork('loot').next)
    );
  });
});

describe('clone', () => {
  test('continues from the same point, then advances independently', () => {
    const rng = new Random(1);
    take(25, rng.next);
    const copy = rng.clone();
    expect(copy.seed).toBe(rng.seed);
    expect(take(10, copy.next)).toEqual(take(10, rng.next));

    copy.next();
    expect(copy.getState()).not.toEqual(rng.getState());
  });
});

describe('getState and setState', () => {
  test('restoring a state replays the sequence from that point', () => {
    const rng = new Random(1);
    take(10, rng.next);
    const saved = rng.getState();
    const first = take(10, rng.next);
    rng.setState(saved);
    expect(take(10, rng.next)).toEqual(first);
  });

  test('a state can move between generators', () => {
    const a = new Random(1);
    const b = new Random(2);
    b.setState(a.getState());
    expect(take(10, b.next)).toEqual(take(10, a.next));
    expect(b.seed).toBe(2);
  });

  test('the snapshot is a copy', () => {
    const rng = new Random(3);
    const saved = rng.getState();
    rng.next();
    expect(rng.getState()).not.toEqual(saved);
  });

  test('rejects invalid states', () => {
    const rng = new Random(4);
    expect(() => rng.setState([1, 2, 3] as unknown as RandomState)).toThrow(RangeError);
    expect(() => rng.setState([1, 2, 3, -1])).toThrow(RangeError);
    expect(() => rng.setState([1, 2, 3, 2 ** 32])).toThrow(RangeError);
    expect(() => rng.setState([1, 2, 3, 0.5])).toThrow(RangeError);
  });
});

describe('hashString', () => {
  test('matches known FNV-1a values', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });
});

describe('random', () => {
  test('is a ready-made Random instance', () => {
    expect(random).toBeInstanceOf(Random);
    const value = random.next();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
