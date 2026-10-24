# cult-frog-random-js
A lightweight JavaScript library for pseudo-random number generation and random utilities

```sh
pnpm add @cult-frog/random
```

## Usage

```ts
import { Random, random } from '@cult-frog/random';

const rng = new Random('abyssal-rebirth'); // same seed, same sequence, every platform

rng.next();                       // 0 (inclusive) to 1 (exclusive), like Math.random()
rng.int(1, 7);                    // whole number, 1 to 6
rng.float(-1, 1);                 // -1 (inclusive) to 1 (exclusive)
rng.chance(0.25);                 // true about a quarter of the time
rng.pick(['moss', 'stone', 'root']);
rng.weighted(['common', 'rare', 'legendary'], [90, 9, 1]);
rng.shuffle([1, 2, 3, 4]);        // in place

random.int(0, 10);                // a shared, randomly seeded instance
```

Ranges are always half-open: `min` is included and `max` isn't.

### Seeds

Seeds can be numbers or strings, and are reduced to 32 bits (strings are hashed with `hashString`). Leave the seed out to get a random one; it's still stored, so any run can be logged and replayed:

```ts
const rng = new Random();
console.log(`seed: ${rng.seed}`);
const replay = new Random(rng.seed); // same sequence as rng
```

### Streams

`fork(label)` gives an independent generator per system, so drawing more numbers in one place doesn't change another. A fork depends only on the parent's seed and the label: it never advances the parent, and the same label always gives the same stream.

```ts
const world = new Random(seed);
const terrain = world.fork('terrain');
const loot = world.fork('loot'); // adding particles elsewhere won't change the loot
```

### Saving and restoring

```ts
const saved = rng.getState();   // four uint32s, safe to JSON.stringify
rng.setState(saved);            // continue from exactly that point
const copy = rng.clone();       // same point, advances independently
```

### Passing it around

`next` is an arrow function, so it works on its own wherever a `() => number` is expected:

```ts
const { next } = rng;
someNoise(next);
```

## Algorithm

[sfc32](https://pracrand.sourceforge.net/RNG_engines.txt) (128 bits of state, passes PractRand), seeded through splitmix32. It's fast and statistically good, but **not cryptographically secure**: use `crypto.getRandomValues` for anything secret.

Changing the algorithm or seeding changes every seeded sequence, so it's treated as a breaking change. A golden-value test guards against doing it by accident.
