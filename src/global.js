// IIFE / global build entry — for plain <script> tags on platforms without a
// bundler or ES-module support (HTML5 TV, webOS, Tizen, older PWAs). After the
// script loads, `window.LiquidGlass` is the class, with the rest of the API
// attached as static members:
//
//   <script src="liquid-glass.global.min.js"></script>
//   <script>
//     const g = new LiquidGlass({ stage, background });
//     LiquidGlass.glassify('.card', { refraction: 0.6 });
//     LiquidGlass.defineLiquidGlass();          // registers <liquid-glass>
//   </script>

import LiquidGlass, { glassify, detectDomCapabilities, DEFAULTS, PARAM_DEFS } from './liquid-glass.js';
import { defineLiquidGlass, LiquidGlassElement } from './web-component.js';

LiquidGlass.glassify = glassify;
LiquidGlass.detectDomCapabilities = detectDomCapabilities;
LiquidGlass.defineLiquidGlass = defineLiquidGlass;
LiquidGlass.LiquidGlassElement = LiquidGlassElement;
LiquidGlass.DEFAULTS = DEFAULTS;
LiquidGlass.PARAM_DEFS = PARAM_DEFS;

const _global = typeof globalThis !== 'undefined' ? globalThis
  : typeof window !== 'undefined' ? window
  : typeof self !== 'undefined' ? self : null;
if (_global) _global.LiquidGlass = LiquidGlass;

export default LiquidGlass;
