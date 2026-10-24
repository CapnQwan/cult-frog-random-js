/**
 * Seedable pseudo-random numbers for Cult Frog Studios.
 *
 * ```ts
 * import { Random, random } from '@cult-frog/random';
 *
 * const rng = new Random('abyssal-rebirth'); // same seed, same sequence
 * rng.int(1, 7);
 * rng.pick(['moss', 'stone', 'root']);
 *
 * random.chance(0.5); // a shared, randomly seeded instance
 * ```
 *
 * ## Conventions
 *
 * **Ranges are half-open.** `int(min, max)` and `float(min, max)` include
 * `min` and exclude `max`, like `next()` and `Math.random()`.
 *
 * **Seeds are 32 bits.** Numbers are reduced with `>>> 0` and strings are
 * hashed, and the result is kept in `seed` so every generator can be replayed.
 *
 * **Not for security.** The generator is predictable by design. Use
 * `crypto.getRandomValues` for anything secret.
 *
 * @packageDocumentation
 */

import { Random } from './random.js';

export { hashString } from './hash.js';
export { Random } from './random.js';

export type { RandomState } from './random.js';

/**
 * A shared, randomly seeded `Random`, for when reproducibility doesn't
 * matter. Create your own `Random` for anything that should replay.
 */
export const random = new Random();
