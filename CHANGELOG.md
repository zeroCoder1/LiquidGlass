# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0]

Initial release.

### Added

- **WebGL2 renderer** — one shared context draws every panel on a stage in a
  single instanced draw call. Analytic SDF-gradient normals, offscreen culling,
  adaptive-DPR budget, adaptive blur taps, and immutable texture storage for
  video/canvas backgrounds.
- **`glassify()` DOM renderer** — adopt existing DOM in place, refracting the
  live page via a baked SVG displacement map + `backdrop-filter`. Capability
  tiers `displacement` / `blur` / `flat`, exposed as `glass.tier`.
- **`detectDomCapabilities()`** for runtime feature detection.
- **Wrappers** — `<liquid-glass>` web component (`defineLiquidGlass()`) and a
  React `<LiquidGlassView>`.
- **Distribution** — ESM, CommonJS, an ES2015 IIFE global (`window.LiquidGlass`)
  for HTML5 TV / webOS / Tizen, and hand-written TypeScript definitions.

[Unreleased]: https://github.com/zeroCoder1/LiquidGlass/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zeroCoder1/LiquidGlass/releases/tag/v0.1.0
