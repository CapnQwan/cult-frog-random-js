# Changelog

All notable changes to this package are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows [Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.1.0] - 2026-10-24

### Added

- `Random`, a seedable PRNG (sfc32 seeded through splitmix32) with `next`, `nextUint32`, `int`, `float`, `chance`, `pick`, `weighted`, `shuffle`, `fork`, `clone`, `getState` and `setState`.
- `random`, a shared, randomly seeded `Random` instance.
- `hashString`, the FNV-1a hash used for string seeds.
