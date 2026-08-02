# Liquid Glass

A refracting glass material for the web. Two renderers, one API. Works in a
React app, plain HTML, a PWA, or on an HTML5 TV / webOS / Tizen set-top box.

## Install

**npm** (React, bundlers, modern browsers):

```bash
npm install liquid-glass
```

```js
import { LiquidGlass, glassify } from 'liquid-glass';
import { LiquidGlassView } from 'liquid-glass/react';       // React
import { defineLiquidGlass } from 'liquid-glass/web-component';
```

**CDN / `<script>` tag** (vanilla HTML, HTML5 TV, webOS, Tizen — no bundler, no
modules needed). The global build is transpiled to ES2015 for older TV engines
and exposes `window.LiquidGlass`:

```html
<script src="https://cdn.jsdelivr.net/npm/liquid-glass/dist/liquid-glass.global.min.js"></script>
<script>
  const glass = new LiquidGlass({ stage, background });
  LiquidGlass.glassify('.card', { refraction: 0.6 });
  LiquidGlass.defineLiquidGlass();            // registers <liquid-glass>
</script>
```

The distributed bundles live in [`dist/`](dist): `liquid-glass.esm.js` (import),
`liquid-glass.cjs` (require), `liquid-glass.global.min.js` (script tag),
`react.esm.js`, and TypeScript `.d.ts` types. Build them with `npm run build`.

## Two renderers

**DOM (default).** Refracts the browser's own backdrop with
`backdrop-filter: blur() url(#displacement)`, where the displacement map is a
normal field baked once per panel geometry. The thing being refracted is the
live page — text, scrolling lists, video, other components. Nothing is captured
to a texture, so anything can go behind the glass.

**WebGL.** Refracts a texture you supply (image, canvas or video), with full
per-pixel control: bevel normals, chromatic aberration, specular, Fresnel,
micro-distortion, GPU-drawn drop shadows. Every panel on a stage is drawn in a
single `drawArraysInstanced` call from one shared context, which is what makes
500 panels cost roughly what a handful cost.

`renderer: 'auto'` (the default) picks WebGL when you passed a `background`
texture, and DOM otherwise.

## Usage

```js
import { LiquidGlass, glassify } from 'liquid-glass';

// A new panel over live page content
const glass = new LiquidGlass({ stage, width: 320, height: 120, x: 40, y: 40 });
stage.appendChild(glass.element);
glass.set({ refraction: 0.6, blurAmount: 0.3 });

// Or turn markup you already wrote into glass, in place
glassify('.toolbar, .card', { refraction: 0.5, blurAmount: 0.35 });

// Or the GPU path, over a texture you own
new LiquidGlass({ stage, background: myCanvas, renderer: 'webgl' });
```

`glassify` keeps the element's children, layout and event handlers. It clears
the element's own background (pass `keepBackground: true` to keep it) — an
opaque background is otherwise exactly what you'd be looking at instead of the
page behind.

### Web component

```js
import { defineLiquidGlass } from 'liquid-glass/web-component';
defineLiquidGlass();
```

```html
<liquid-glass stage="#stage" refraction="0.5" width="320" height="120" button>
  Play
</liquid-glass>
```

Registration is an explicit call, not an import side effect.

### React

```jsx
import { LiquidGlassView } from 'liquid-glass/react';

<div ref={stageRef} style={{ position: 'relative' }}>
  <LiquidGlassView stage={stageRef} refraction={0.5} width={320} height={120} button>
    Play
  </LiquidGlassView>
</div>
```

React and react-dom are optional peer dependencies.

## Browser support

| | blur + tint + bevel | refraction | chromatic aberration |
|---|---|---|---|
| Chromium (DOM renderer) | yes | yes | yes |
| Safari / iOS (DOM renderer) | yes | no — WebKit leaves SVG filter refs in `backdrop-filter` unresolved | no |
| Firefox (DOM renderer) | yes | no — Firefox ignores SVG filter refs in `backdrop-filter` | no |
| Any WebGL2 browser (WebGL renderer) | yes | yes | yes |

Detected at runtime; read `glass.tier` for what you actually got
(`webgl`, `displacement`, `blur`, `flat`). WebKit and Firefox both *report*
`url()` support for `backdrop-filter` but don't resolve the reference — and an
unresolved `url()` would invalidate the whole filter and drop the blur too — so
they are served the `blur` tier (frosted glass without refraction). For full
refraction on those engines, pass a `background` texture to use the WebGL
renderer instead.

## Performance notes

- Blur is a Poisson-disk sample whose tap count scales with `blurAmount`: a
  single fetch at 0 (the default), three taps for a light blur, up to eight for
  a heavy one — you never pay for samples the blur strength can't show.
- Surface normals are computed analytically from the SDF gradient: one distance
  evaluation per fragment instead of the five a finite-difference normal costs.
- Background textures use immutable storage (`texStorage2D` + `texSubImage2D`),
  so a video background does not reallocate GPU memory every frame.
- Panels cache their layout and re-measure only when something moved them.
  Offscreen panels are culled and excluded from the adaptive-DPR budget.
- Drop shadows are drawn in the shader; 500 CSS `box-shadow`s are real
  compositor work, one extra ring of fragments is not.
- The RAF loop halts entirely when nothing is animating.

Panels re-measure whenever they redraw (a parameter change, resize, drag, or
animated background). If panels live in their own scroll container that moves
independently of the stage, trigger a redraw on scroll — e.g.
`el.addEventListener('scroll', () => glass.set({}))` — so they re-measure as
they move.

## License

MIT
