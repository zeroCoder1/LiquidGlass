// Package entry point. Re-exports the full public API so bundlers and
// `import` consumers get everything from `liquid-glass`.
export {
  LiquidGlass as default,
  LiquidGlass,
  glassify,
  detectDomCapabilities,
  DEFAULTS,
  PARAM_DEFS,
} from './liquid-glass.js';
export { defineLiquidGlass, LiquidGlassElement } from './web-component.js';
