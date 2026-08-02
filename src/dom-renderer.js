// DOM displacement renderer — the default path when no background *texture* is
// supplied. It refracts the browser's own backdrop (the live page behind the
// panel) with `backdrop-filter: blur() saturate() brightness() url(#map)`,
// where the SVG filter's displacement map is a normal/height field baked once
// per panel geometry. Nothing is captured to a texture, so anything — text,
// scrolling lists, video, other components — can sit behind the glass.
//
// Three tiers, chosen by capability (see detectDomCapabilities):
//   'displacement' — full refraction via feDisplacementMap (Chromium, Safari).
//   'blur'         — backdrop-filter blur()+tint only (Firefox, older engines).
//   'flat'         — layered gradients, no backdrop-filter at all.
// The sheen, bevel highlight and edge lighting are CSS gradients + inset shadow
// in every tier, so the surface still reads as glass when refraction is absent.

let _idSeq = 0;

// The baked map never needs full panel resolution — feImage stretches it with
// preserveAspectRatio="none". Cap the long side so baking a fullscreen panel
// costs the same as baking a button.
const MAP_MAX = 256;

export function detectDomCapabilities() {
  const supports = (p, v) => {
    try { return CSS.supports(p, v); } catch { return false; }
  };
  const blur = supports('backdrop-filter', 'blur(4px)') ||
               supports('-webkit-backdrop-filter', 'blur(4px)');
  let displacement = blur &&
    (supports('backdrop-filter', 'url("#x")') || supports('-webkit-backdrop-filter', 'url("#x")'));

  // Some engines report url() support for backdrop-filter but never actually
  // resolve an SVG filter reference inside it. That's worse than unsupported:
  // an unresolved url() invalidates the WHOLE backdrop-filter, so the blur is
  // dropped too and the panel renders nothing. Downgrade these to the blur tier
  // so they still get a real frosted-glass look:
  //   • Firefox ignores SVG filter refs in backdrop-filter.
  //   • WebKit / Safari (and every browser on iOS, which are all WebKit) too —
  //     it advertises url() support but leaves the reference unresolved.
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const vendor = typeof navigator !== 'undefined' ? (navigator.vendor || '') : '';
  const isFirefox = /firefox/i.test(ua);
  const isWebKit = /apple/i.test(vendor); // Safari desktop + all iOS browsers; Blink/Gecko report other vendors
  if (isFirefox || isWebKit) displacement = false;

  return { blur, displacement, tier: displacement ? 'displacement' : blur ? 'blur' : 'flat' };
}

// --- displacement map baking ------------------------------------------------

const sdRoundRect = (px, py, bx, by, r) => {
  r = Math.min(r, Math.min(bx, by));
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};
const profileArc = (t) => {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
};

// Bake dx,dy = gradient of the same bevel height field the WebGL shader uses,
// encoded into R (x) and G (y) with 128 = no displacement. Returns a data URL.
function bakeMap(w, h, cornerRadius, zRadius, bevelMode) {
  const scale = Math.min(1, MAP_MAX / Math.max(w, h));
  const W = Math.max(2, Math.round(w * scale));
  const H = Math.max(2, Math.round(h * scale));
  // Work in the map's own pixel space; the panel's CSS geometry is scaled to it.
  const bx = W / 2, by = H / 2;
  const cr = cornerRadius * scale;
  const zr = Math.max(0.5, zRadius * scale);

  const height = (px, py) => {
    const inside = -sdRoundRect(px, py, bx, by, cr);
    if (inside <= 0) return 0;
    let t;
    if (bevelMode === 0) t = inside / zr;               // biconvex band
    else t = inside / Math.max(0.5, Math.min(Math.min(bx, by), zr)); // dome
    return profileArc(t);
  };

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(W, H);
  const d = im.data;
  const e = 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x - bx, py = y - by;
      // Central-difference gradient of the height field = surface slope. The
      // backdrop is pushed along the slope, bending most at the bevel rim and
      // not at all across the flat crown — the lens look.
      const gx = (height(px + e, py) - height(px - e, py)) * 0.5;
      const gy = (height(px, py + e) - height(px, py - e)) * 0.5;
      const p = (y * W + x) * 4;
      d[p]     = Math.max(0, Math.min(255, 128 + gx * 127));
      d[p + 1] = Math.max(0, Math.min(255, 128 + gy * 127));
      d[p + 2] = 128;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  return c.toDataURL('image/png');
}

// --- renderer ---------------------------------------------------------------

export class DomDisplacementRenderer {
  constructor() {
    const caps = detectDomCapabilities();
    this.tier = caps.tier;
    this._caps = caps;

    // Public surface node the owner slots into the panel's surface layer. This
    // is the element that carries the backdrop-filter; it must sit behind the
    // panel's foreground content.
    this.canvas = document.createElement('div');
    const s = this.canvas.style;
    s.position = 'absolute';
    s.inset = '0';
    s.width = '100%';
    s.height = '100%';
    s.pointerEvents = 'none';

    this._id = `lg-disp-${++_idSeq}`;
    this._mapKey = '';   // geometry signature of the currently-baked map
    this._svg = null;
    this._feImage = null;
    this._feDisp = null;

    if (this.tier === 'displacement') this._buildFilter();
  }

  // No texture to update — the live page *is* the backdrop.
  updateTexture() { return true; }
  resize() { /* CSS-driven */ }

  _buildFilter() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';

    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', this._id);
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '0');
    filter.setAttribute('y', '0');

    const feImage = document.createElementNS(NS, 'feImage');
    feImage.setAttribute('preserveAspectRatio', 'none');
    feImage.setAttribute('result', 'map');
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');

    const feDisp = document.createElementNS(NS, 'feDisplacementMap');
    feDisp.setAttribute('in', 'SourceGraphic');
    feDisp.setAttribute('in2', 'map');
    feDisp.setAttribute('xChannelSelector', 'R');
    feDisp.setAttribute('yChannelSelector', 'G');

    filter.append(feImage, feDisp);
    svg.append(filter);
    (document.body || document.documentElement).appendChild(svg);

    this._svg = svg;
    this._feImage = feImage;
    this._feDisp = feDisp;
  }

  // Re-bake the map only when panel size or a shape param actually changed.
  _syncMap(params, w, h) {
    const key = `${Math.round(w)}x${Math.round(h)}:${params.cornerRadius}:${params.zRadius}:${params.bevelMode}`;
    if (key === this._mapKey || w < 1 || h < 1) return;
    this._mapKey = key;
    const url = bakeMap(w, h, params.cornerRadius, params.zRadius, params.bevelMode);
    const f = this._feImage;
    f.setAttribute('href', url);
    f.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
    for (const el of [this._feImage, this._feDisp]) {
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(h));
    }
    this._svg.querySelector('filter').setAttribute('width', String(w));
    this._svg.querySelector('filter').setAttribute('height', String(h));
  }

  render(params, layout) {
    const s = this.canvas.style;
    const w = layout.panelW, h = layout.panelH;

    // Backdrop chain: blur + saturation + brightness, then (if supported) the
    // displacement lens. hover gently lifts brightness in button mode.
    const blurPx = (params.blurAmount * 24);
    const sat = (1 + params.saturation);
    const bright = (1 + params.brightness + (layout.hover || 0) * 0.09);
    const parts = [];
    if (blurPx > 0.01) parts.push(`blur(${blurPx.toFixed(2)}px)`);
    parts.push(`saturate(${sat.toFixed(3)})`);
    parts.push(`brightness(${bright.toFixed(3)})`);

    if (this.tier === 'displacement' && params.refraction > 0.001) {
      this._syncMap(params, w, h);
      // Displacement scale is in user-space px; drive it from refraction. The
      // press state flattens the lens, matching the WebGL renderer.
      const scale = params.refraction * 42 * (1 - (layout.pressed || 0) * 0.7);
      this._feDisp.setAttribute('scale', scale.toFixed(2));
      parts.push(`url(#${this._id})`);
    }

    const filter = parts.join(' ');
    s.borderRadius = params.cornerRadius + 'px';
    s.opacity = String(params.opacity);
    s.backdropFilter = filter;
    s.webkitBackdropFilter = filter;

    this._applySheen(params, layout);
  }

  // Bevel sheen + edge highlight + tint — CSS gradients and an inset ring, so
  // the surface reads as glass in every tier (including 'flat', where these are
  // the only cue). Mirrors the CSS fallback's look.
  _applySheen(params, layout) {
    const s = this.canvas.style;
    const edge = Math.min(1, params.edgeHighlight);
    const bevel = Math.max(2, params.zRadius);
    const tint = params.tintStrength;
    const press = layout.pressed || 0;
    const sheen = params.specular * 0.4 + params.fresnel * 0.12;

    s.background =
      `radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,${(0.18 * (1 - press) + sheen).toFixed(3)}), rgba(255,255,255,0) 45%),` +
      `linear-gradient(180deg, rgba(255,255,255,${(0.10 * (1 - press)).toFixed(3)}), rgba(255,255,255,0) ${bevel}px),` +
      `linear-gradient(0deg, rgba(0,0,0,${(0.08 * (1 - press)).toFixed(3)}), rgba(0,0,0,0) ${bevel}px),` +
      `linear-gradient(135deg, rgba(150,190,255,${(0.25 * tint).toFixed(3)}), rgba(120,160,255,${(0.10 * tint).toFixed(3)}))`;

    s.boxShadow =
      `inset 0 0 0 1px rgba(255,255,255,${(0.35 * edge).toFixed(3)}),` +
      `inset 0 1px 1px rgba(255,255,255,${(0.4 * edge).toFixed(3)})`;
  }

  destroy() {
    this._svg?.remove();
    this.canvas.remove();
  }
}

export default DomDisplacementRenderer;
