// Compile-only test: the public type surface must be usable. `npm run typecheck`
// (tsc --noEmit) fails if the shipped .d.ts drifts from the real API.
import LiquidGlass, {
  glassify, detectDomCapabilities, defineLiquidGlass, DEFAULTS,
} from '../types/liquid-glass';
import type { GlassParams, GlassTier, LiquidGlassOptions } from '../types/liquid-glass';

const opts: LiquidGlassOptions = {
  stage: document.body, background: 'bg.jpg', renderer: 'auto',
  width: 320, height: 120, refraction: 0.6, dynamicCanvas: true,
};

const g = new LiquidGlass(opts);
g.set({ blurAmount: 0.2 }).setPosition(10, 20);
const tier: GlassTier = g.tier;
const mode: 'webgl' | 'dom' = g.mode;
const one = g.get('refraction');
g.setBackground(document.createElement('canvas'));
g.destroy();

const panels = glassify('.card', { refraction: 0.5, keepBackground: true });
panels.forEach((p) => p.destroy());

defineLiquidGlass('my-glass');
const caps = detectDomCapabilities();
const gp: GlassParams = { chromAberration: 0.1, button: true, bevelMode: 1 };

void tier; void mode; void one; void caps; void gp; void DEFAULTS;
