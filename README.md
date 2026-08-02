![Liquid Glass Preview Bottom](assests/Screenshot%202026-08-03%20at%2012.03.23%E2%80%AFAM.png)

A refracting glass material for the web. Two renderers, one API. Ships as ESM,
CommonJS, and a plain-`<script>` global — so it drops into a React app, a
vanilla HTML page, a PWA, or an HTML5 TV / webOS / Tizen set-top box.

### ▶ [See it live → zerocoder1.github.io/LiquidGlass](https://zerocoder1.github.io/LiquidGlass/)



The home page shows the effect and links to the interactive playground, the
implementation guide, and the demos.

## Which renderer do I use?

One question decides it: **is the thing behind the glass a texture, or the live
page?**

| Behind the glass is… | Use | Refraction |
|---|---|---|
| an image / video / canvas you can supply | `new LiquidGlass({ background })` → **WebGL** | **full — every browser (Firefox, Safari included)** |
| the live page (arbitrary scrolling DOM) | `glassify(selector)` → **DOM** | Chromium ✓ · Firefox / Safari get frosted blur |

`renderer: 'auto'` (the default) picks WebGL when you passed a `background`,
DOM otherwise. Force it with `renderer: 'webgl'` or `renderer: 'dom'`.

> **Why not "full refraction of any live element, everywhere"?** That's the
> iOS Liquid Glass trick, and it needs the OS compositor to sample the real
> backdrop in real time. The web has no such API — `backdrop-filter` is the
> closest, and only Chromium resolves the SVG displacement it needs. For
> cross-browser refraction, hand the glass a texture (WebGL). To adopt
> arbitrary live UI, use `glassify()` and accept blur off-Chromium.

## Install

**npm** — React, bundlers, modern browsers:

```bash
npm install liquid-glass
```

```js
import { LiquidGlass, glassify } from 'liquid-glass';
import { LiquidGlassView } from 'liquid-glass/react';
import { defineLiquidGlass } from 'liquid-glass/web-component';
```

**CDN / `<script>` tag** — vanilla HTML, PWAs, and TV platforms
(HTML5 TV / webOS / Tizen). No bundler needed; the global build is transpiled
to ES2015 and exposes `window.LiquidGlass`:

```html
<script src="https://cdn.jsdelivr.net/npm/liquid-glass/dist/liquid-glass.global.min.js"></script>
<script>
  const glass = new LiquidGlass({ stage, background });
  LiquidGlass.glassify('.card', { refraction: 0.6 });
  LiquidGlass.defineLiquidGlass();          // registers <liquid-glass>
</script>
```

Bundles in [`dist/`](dist): `liquid-glass.esm.js`, `liquid-glass.cjs`,
`liquid-glass.global.min.js`, `react.esm.js`, plus `.d.ts` types. Rebuild with
`npm run build`.

## Usage

### 1. WebGL — refracts a texture you supply (works everywhere)

```js
import { LiquidGlass } from 'liquid-glass';

const glass = new LiquidGlass({
  stage,                              // position: relative container
  background: imageOrVideoOrCanvas,   // covers the stage; can be a URL
  renderer: 'webgl',                  // (auto-picks WebGL when background is set)
  width: 320, height: 120, x: 40, y: 40,
  refraction: 0.7, chromAberration: 0.08, blurAmount: 0.1,
});
stage.appendChild(glass.element);
glass.content.textContent = 'Play';   // put labels/icons in glass.content
```

For an animated canvas, pass `dynamicCanvas: true` so it's re-uploaded every
frame. Video backgrounds are dynamic automatically.

### 2. `glassify()` — turn existing DOM into glass in place

```js
import { glassify } from 'liquid-glass';

// #topbar and .card are ordinary styled HTML already on the page
const panels = glassify('#topbar, .card', {
  refraction: 0.7, blurAmount: 0.14, edgeHighlight: 0.5,
});
```

`glassify()` keeps the element's children, layout, and click handlers, and
clears its opaque background (pass `keepBackground: true` to keep it). It
returns the created `LiquidGlass` instances so you can tune them live.

**Refraction on Chromium only.** Firefox and Safari (all iOS browsers) can't
resolve SVG displacement inside `backdrop-filter`, so they get frosted blur
plus the sheen/bevel/edge gradients. Read `glass.tier` to see what you got:
`'webgl'`, `'displacement'`, `'blur'`, or `'flat'`.

### 3. Web component

```js
import { defineLiquidGlass } from 'liquid-glass/web-component';
defineLiquidGlass();               // registers <liquid-glass> once
```

```html
<liquid-glass stage="#stage" background="/bg.jpg"
              refraction="0.5" width="320" height="120" button>
  Play
</liquid-glass>
```

Numeric / boolean params map to attributes (camelCase → kebab-case, e.g.
`chromAberration` → `chrom-aberration`). Registration is an explicit call, not
an import side effect.

### 4. React

```jsx
import { LiquidGlassView } from 'liquid-glass/react';

<div ref={stageRef} style={{ position: 'relative' }}>
  <LiquidGlassView stage={stageRef} background="/bg.jpg"
                   refraction={0.5} width={320} height={120} button>
    Play
  </LiquidGlassView>
</div>
```

React and react-dom are optional peer dependencies.

## API

```js
import { LiquidGlass, glassify, detectDomCapabilities } from 'liquid-glass';

const glass = new LiquidGlass({
  stage,                 // container (default: document.body)
  background,            // img / video / canvas / URL → auto-selects WebGL
  renderer: 'auto',      // 'auto' | 'webgl' | 'dom'  ('css' = alias for dom)
  width, height, x, y,   // geometry for a constructed panel
  maxDpr: 2,             // cap device-pixel-ratio for GPU cost control
  dynamicCanvas: false,  // re-upload a canvas background every frame
  className: '',         // extra class on the panel element
  keepBackground: false, // glassify: keep the adopted element's own background
  /* …any parameter from the table below… */
});

glass.set({ refraction: 0.4 }); // patch params live (throttled to next frame)
glass.get('refraction');        // read one — or glass.get() for all
glass.setBackground(src);       // swap the WebGL texture (image/canvas/video/URL)
glass.setPosition(x, y);        // move a constructed panel
glass.destroy();                // remove + free GPU resources

glass.element;   // the panel node — append it to your stage
glass.content;   // slot for foreground content (labels, icons)
glass.mode;      // 'webgl' | 'dom'
glass.tier;      // 'webgl' | 'displacement' | 'blur' | 'flat'

// Adopt existing DOM. Returns LiquidGlass[]. Accepts the same params.
const panels = glassify('.card', { refraction: 0.6, keepBackground: false });

// Probe capabilities before you commit — e.g. to pick a background strategy.
detectDomCapabilities(); // { blur, displacement, tier }
```

## Parameters

Pass any of these to the constructor, to `glassify()`, or live via
`glass.set({ … })`. Values are clamped to the ranges shown.

| param | default | range | what it does |
|---|---|---|---|
| `refraction` | 0.69 | 0 – 2 | how much the glass bends the image behind it |
| `blurAmount` | 0.0 | 0 – 1 | background blur (0 = sharp; tap count scales with strength) |
| `chromAberration` | 0.05 | 0 – 1 | colour fringing at the edges |
| `edgeHighlight` | 0.05 | 0 – 2 | rim light / edge glow |
| `specular` | 0.0 | 0 – 2 | specular highlight (2-light Blinn-Phong) |
| `fresnel` | 1.0 | 0 – 2 | reflection at grazing angles |
| `distortion` | 0.0 | 0 – 1 | animated micro-distortion noise |
| `cornerRadius` | 65 | 0 – 2000 | corner radius, CSS px |
| `zRadius` | 40 | 1 – 2000 | bevel depth — curvature of the cross-section |
| `bevelMode` | 0 | 0 or 1 | 0 = biconvex pill · 1 = dome / plano-convex |
| `opacity` | 1.0 | 0 – 1 | overall panel opacity |
| `tintStrength` | 0.0 | 0 – 1 | cool blue glass tint |
| `saturation` | 0.0 | -1 – 1 | saturation of the refracted image |
| `brightness` | 0.0 | -0.5 – 0.5 | brightness of the refracted image |
| `shadowOpacity` · `shadowSpread` · `shadowOffsetY` | 0.3 · 10 · 1 | — | drop shadow (CSS `box-shadow` on the panel) |
| `button` | `false` | bool | hover brightens; press flattens the bevel + deepens the shadow |
| `floating` | `false` | bool | drag-to-move via Pointer Events |

## Browser support

|  | blur · tint · bevel · sheen | refraction | chromatic aberration |
|---|---|---|---|
| **WebGL renderer** — any WebGL2 browser | ✅ | ✅ | ✅ |
| **`glassify()` on Chromium** — Chrome / Edge / Brave / Opera / Chromium PWAs | ✅ | ✅ | ✅ |
| **`glassify()` on Safari** — including all iOS browsers | ✅ | ❌ | ❌ |
| **`glassify()` on Firefox** | ✅ | ❌ | ❌ |
| **No `backdrop-filter` at all** | gradients only | ❌ | ❌ |

Safari and Firefox both *report* `url()` support for `backdrop-filter` but
don't resolve the reference — and an unresolved `url()` would invalidate the
whole filter and drop the blur too — so they're served the `blur` tier
(frosted glass without refraction). For full refraction on those engines, hand
the glass a `background` texture and use the WebGL renderer.

## What is *not* possible

- **Live-page refraction is Chromium-only.** Engine limit, not a bug.
- **WebGL can't sample arbitrary live DOM.** It refracts a texture you supply.
  To refract page content cross-browser you'd have to snapshot that content
  into a texture yourself (expensive, and not truly live).
- **Cross-origin media taints the texture.** An image/video/canvas from
  another origin without CORS can't be uploaded to WebGL — the panel silently
  renders without refraction. Serve same-origin or send CORS headers.
- **No true iOS-compositor parity.** The web has no API to sample the live
  rendered backdrop as a texture; the two renderers here are the closest the
  platform allows.

## Performance

- Every panel on the same stage shares **one** WebGL context and is drawn in a
  **single** `drawArraysInstanced` call — 500 panels cost about what a handful
  do. Panels scrolled offscreen are culled and excluded from the adaptive-DPR
  budget.
- Surface normals are computed analytically from the SDF gradient: one
  distance evaluation per fragment (a finite-difference normal costs five).
- Blur is a Poisson-disk sample whose tap count scales with `blurAmount`: a
  single fetch at 0, three taps for a light blur, up to eight for a heavy one.
- Background textures use immutable storage (`texStorage2D` + `texSubImage2D`),
  so a video background does not reallocate GPU memory every frame.
- The RAF loop halts entirely when nothing is animating.
- Panels re-measure whenever they redraw (a parameter change, resize, drag, or
  animated background). If they live in their own scroll container that moves
  independently of the stage, trigger a redraw on scroll — e.g.
  `el.addEventListener('scroll', () => glass.set({}))`.

## License

MIT — see [LICENSE](LICENSE).
