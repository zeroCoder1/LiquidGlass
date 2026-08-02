// Liquid Glass — main framework class.
//
//   const glass = new LiquidGlass({ stage, background, width, height, x, y, ...params });
//   stage.appendChild(glass.element);   // put foreground content inside glass.element
//   glass.set({ refraction: 0.4 });
//   glass.destroy();
//
// Background must be a provided texture source: an image/video/canvas element or
// an image URL. It is assumed to visually *cover* the `stage` element, and the
// panel refracts whatever sits behind it within that stage.

import { DEFAULTS, normalizeParams, coerceParam, PARAM_DEFS } from './params.js';
import { GlassRenderPool, flushAllPools, isWebGL2Available } from './glass-pool.js';
import { DomDisplacementRenderer, detectDomCapabilities } from './dom-renderer.js';

let _sharedRAF = null;
const _instances = new Set();

function tick(now) {
  const t = now / 1000;
  let needMore = false;
  for (const inst of _instances) {
    if (inst._frame(t)) needMore = true;
  }
  // One instanced draw per stage covers every panel on it.
  if (flushAllPools(t)) needMore = true;
  // Self-halting loop: stop entirely once no instance needs animating, so idle
  // glass panels cost zero CPU/GPU — exactly like a static CTA button.
  _sharedRAF = needMore ? requestAnimationFrame(tick) : null;
}
function ensureLoop() {
  if (_sharedRAF == null) _sharedRAF = requestAnimationFrame(tick);
}

async function resolveBackground(bg) {
  if (typeof bg === 'string') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = bg;
    if (img.decode) { try { await img.decode(); } catch { /* fall through */ } }
    else await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    return img;
  }
  return bg; // already an element
}

export class LiquidGlass {
  constructor(options = {}) {
    this.options = options;
    this.params = normalizeParams(options, DEFAULTS);

    this._maxDpr = options.maxDpr ?? 2;
    // renderer: 'auto' (default) uses WebGL when a background *texture* was
    // supplied (GPU refraction of that texture) and the DOM displacement
    // renderer otherwise (refracting the live page). 'webgl' | 'dom' | 'css'
    // force a path; 'css' is kept as an alias for the DOM renderer.
    this._renderer = options.renderer || 'auto';
    this._forceWebGL = this._renderer === 'webgl';
    this._forceDOM = this._renderer === 'dom' || this._renderer === 'css';

    // Adopt mode: turn an element already in the page into glass, in place.
    this._adopt = options.adopt || null;
    this._keepBackground = !!options.keepBackground;
    this._restoreStyle = null;
    this._tier = 'flat';

    this._dirty = true;
    this._hover = 0;
    this._pressed = 0;
    this._dragging = false;
    this._drag = { dx: 0, dy: 0 };
    this._x = options.x ?? 0;
    this._y = options.y ?? 0;
    this._destroyed = false;

    this.stage = options.stage || (this._adopt && this._adopt.offsetParent) || document.body;
    this._buildDOM(options);
    this._selectRenderer();
    this._attachInteractions();

    this._ro = new ResizeObserver(() => this._requestRender());
    this._ro.observe(this.element);
    this._ro.observe(this.stage);

    if (options.background) this.setBackground(options.background);

    _instances.add(this);
    this._requestRender();
  }

  /** Mark this panel as needing one render and wake the shared loop. */
  _requestRender() {
    this._dirty = true;
    ensureLoop();
  }

  _buildDOM(options) {
    return this._adopt ? this._adoptDOM(options) : this._createDOM(options);
  }

  _createDOM(options) {
    const el = document.createElement('div');
    el.className = 'liquid-glass' + (options.className ? ' ' + options.className : '');
    el.style.position = 'absolute';
    el.style.left = this._x + 'px';
    el.style.top = this._y + 'px';
    if (options.width != null) el.style.width = typeof options.width === 'number' ? options.width + 'px' : options.width;
    if (options.height != null) el.style.height = typeof options.height === 'number' ? options.height + 'px' : options.height;
    el.style.overflow = 'visible';
    el.style.touchAction = 'none';
    this.element = el;

    // Layer that holds the renderer surface (canvas or fallback div).
    this._surface = document.createElement('div');
    const ss = this._surface.style;
    ss.position = 'absolute';
    ss.inset = '0';
    ss.zIndex = '0';
    ss.pointerEvents = 'none';
    el.appendChild(this._surface);

    // Foreground content slot (labels, icons) rendered above the glass.
    this.content = document.createElement('div');
    const cs = this.content.style;
    cs.position = 'relative';
    cs.zIndex = '1';
    cs.width = '100%';
    cs.height = '100%';
    el.appendChild(this.content);

    this._applyShadow();
  }

  // Adopt an element already in the page: keep its children, layout and event
  // handlers, and slip a glass surface behind its content. The surface sits at
  // z-index -1 so existing children stay on top and stay interactive, while its
  // backdrop is whatever the element is laid over — the live page.
  _adoptDOM(options) {
    const el = this._adopt;
    if (!el.classList.contains('liquid-glass')) el.classList.add('liquid-glass');
    if (options.className) el.classList.add(options.className);
    this.element = el;
    this.content = el; // foreground = the element's existing content

    const cs = getComputedStyle(el);
    // Remember what we touch so destroy() can put the element back.
    this._restoreStyle = {
      position: el.style.position,
      background: el.style.background,
      borderRadius: el.style.borderRadius,
      boxShadow: el.style.boxShadow,
    };
    if (cs.position === 'static') el.style.position = 'relative';
    // An opaque background is exactly what you'd see instead of the page behind
    // the glass, so clear it unless the caller opted to keep it.
    if (!this._keepBackground) el.style.background = 'transparent';

    this._surface = document.createElement('div');
    const ss = this._surface.style;
    ss.position = 'absolute';
    ss.inset = '0';
    ss.zIndex = '-1';
    ss.pointerEvents = 'none';
    ss.borderRadius = 'inherit';
    el.insertBefore(this._surface, el.firstChild);

    this._applyShadow();
  }

  _selectRenderer() {
    // WebGL when forced, or when 'auto' was given a background texture to
    // refract on the GPU. The live-page DOM renderer is the default otherwise.
    const wantWebGL = this._forceWebGL ||
      (this._renderer === 'auto' && this._adopt == null && this.options.background != null);
    if (wantWebGL && !this._forceDOM && isWebGL2Available()) {
      try {
        // Share one context + one instanced draw across all panels on the stage.
        this._pool = GlassRenderPool.forStage(this.stage, this._maxDpr);
        // Let the pool wake the shared loop after a GPU context restore.
        this._pool.onNeedFlush = ensureLoop;
        this._pool.register(this);
        this.mode = 'webgl';
        this._tier = 'webgl';
        return;
      } catch (err) {
        console.warn('[LiquidGlass] WebGL pool init failed, falling back to DOM:', err);
      }
    }
    this.mode = 'dom';
    this.renderer = new DomDisplacementRenderer();
    this._tier = this.renderer.tier;
    if (this._tier === 'flat') {
      console.warn('[LiquidGlass] No backdrop-filter support; glass will render flat.');
    }
    this._surface.appendChild(this.renderer.canvas);
    this._surface.style.borderRadius = this.params.cornerRadius + 'px';
  }

  /** What the runtime actually gave you: 'webgl' | 'displacement' | 'blur' | 'flat'. */
  get tier() { return this._tier; }

  async setBackground(bg) {
    this._bg = await resolveBackground(bg);
    if (this._destroyed) return;
    this._isVideo = this._bg instanceof HTMLVideoElement;
    this._isDynamic = this._isVideo ||
      (typeof HTMLCanvasElement !== 'undefined' && this._bg instanceof HTMLCanvasElement && this.options.dynamicCanvas);
    if (this.mode === 'webgl') {
      this._pool.setBackground(this._bg, this._isDynamic);
    } else {
      this.renderer.updateTexture(this._bg);
    }
    this._requestRender();
  }

  /** Patch one or more parameters. */
  set(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (k in PARAM_DEFS) this.params[k] = coerceParam(k, v);
    }
    if ('shadowOpacity' in patch || 'shadowSpread' in patch || 'shadowOffsetY' in patch ||
        'button' in patch || 'cornerRadius' in patch) {
      this._applyShadow();
    }
    if (this.mode !== 'webgl' && 'cornerRadius' in patch) {
      this._surface.style.borderRadius = this.params.cornerRadius + 'px';
    }
    this._requestRender();
    return this;
  }

  get(key) { return key ? this.params[key] : { ...this.params }; }

  setPosition(x, y) {
    this._x = x; this._y = y;
    this.element.style.left = x + 'px';
    this.element.style.top = y + 'px';
    this._requestRender();
    return this;
  }

  _applyShadow() {
    const p = this.params;
    const press = this._pressed;
    const spread = p.shadowSpread * (1 + press * 0.8);
    const oy = p.shadowOffsetY + press * 4;
    const op = Math.min(1, p.shadowOpacity * (1 + press * 0.6));
    // Compositor box-shadow follows the rounded border box and stays cheap at
    // scale (the glass visual itself is transparent DOM drawn on the overlay).
    this.element.style.borderRadius = p.cornerRadius + 'px';
    this.element.style.boxShadow = `0 ${oy}px ${spread}px rgba(0,0,0,${op})`;
  }

  // --- interactions --------------------------------------------------------
  _attachInteractions() {
    const el = this.element;
    this._onEnter = () => { if (this.params.button) { this._hover = 1; this._requestRender(); } };
    this._onLeave = () => { this._hover = 0; this._pressed = 0; this._applyShadow(); this._requestRender(); };
    this._onDown = (e) => {
      if (this.params.button) { this._pressed = 1; this._applyShadow(); this._requestRender(); }
      if (this.params.floating) this._startDrag(e);
    };
    this._onUp = () => {
      if (this.params.button && this._pressed) { this._pressed = 0; this._applyShadow(); this._requestRender(); }
    };
    el.addEventListener('pointerenter', this._onEnter, { passive: true });
    el.addEventListener('pointerleave', this._onLeave, { passive: true });
    el.addEventListener('pointerdown', this._onDown, { passive: true });
    window.addEventListener('pointerup', this._onUp, { passive: true });
  }

  _startDrag(e) {
    this._dragging = true;
    this._drag.dx = e.clientX - this._x;
    this._drag.dy = e.clientY - this._y;
    const move = (ev) => {
      if (!this._dragging) return;
      this.setPosition(ev.clientX - this._drag.dx, ev.clientY - this._drag.dy);
    };
    const end = () => {
      this._dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    try { this.element.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  // --- render loop ---------------------------------------------------------
  _computeLayout() {
    const panelRect = this.element.getBoundingClientRect();
    const stageRect = this.stage.getBoundingClientRect();
    const dpr = Math.min(this._maxDpr, window.devicePixelRatio || 1);
    return {
      dpr,
      panelW: panelRect.width,
      panelH: panelRect.height,
      offsetX: panelRect.left - stageRect.left,
      offsetY: panelRect.top - stageRect.top,
      stageW: stageRect.width,
      stageH: stageRect.height,
      hover: this._hover,
      pressed: this._pressed,
    };
  }

  _frame(time) {
    if (this._destroyed) return false;
    // Only these sources need continuous animation; everything else renders once.
    const animating = this._isDynamic || this.params.distortion > 0.001 || this._dragging;

    if (this.mode === 'webgl') {
      // The pool does the actual (batched) drawing; here we only signal work.
      if (this._dirty || animating) this._pool.markDirty();
      this._dirty = false;
      return animating;
    }

    // CSS fallback: draw this panel directly.
    if (!this._dirty && !animating) return false;
    if (this._isDynamic && this._bg) {
      if (!this._isVideo || this._bg.readyState >= 2) this.renderer.updateTexture(this._bg);
    }
    const layout = this._computeLayout();
    this.renderer.render(this.params, layout, time);
    this._dirty = false;
    return animating;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    _instances.delete(this);
    if (_instances.size === 0 && _sharedRAF != null) {
      cancelAnimationFrame(_sharedRAF);
      _sharedRAF = null;
    }
    this._ro.disconnect();
    this.element.removeEventListener('pointerenter', this._onEnter);
    this.element.removeEventListener('pointerleave', this._onLeave);
    this.element.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointerup', this._onUp);
    if (this.mode === 'webgl') {
      this._pool.unregister(this);
      // Removing a panel changes what the pool must draw. Wake the shared loop
      // so surviving panels get one redraw (otherwise the overlay canvas keeps
      // the stale frame — e.g. clearing a swarm would leave ghosts / a blank).
      if (_instances.size > 0) ensureLoop();
    } else {
      this.renderer.destroy();
    }
    if (this._adopt) {
      // Adopted elements were the page's, not ours — put them back, don't remove.
      const r = this._restoreStyle || {};
      this._surface.remove();
      this.element.classList.remove('liquid-glass');
      this.element.style.position = r.position || '';
      this.element.style.background = r.background || '';
      this.element.style.borderRadius = r.borderRadius || '';
      this.element.style.boxShadow = r.boxShadow || '';
    } else {
      this.element.remove();
    }
  }
}

/**
 * Turn markup you already wrote into glass, in place. Accepts a selector
 * string, an Element, or a NodeList/array of Elements. Each element keeps its
 * children, layout and event handlers; its own background is cleared (pass
 * `keepBackground: true` to keep it) so the page behind shows through.
 * Returns an array of the created LiquidGlass instances.
 */
export function glassify(target, opts = {}) {
  return resolveTargets(target).map((el) => new LiquidGlass({ ...opts, adopt: el }));
}

function resolveTargets(target) {
  if (typeof target === 'string') return [...document.querySelectorAll(target)];
  if (target instanceof Element) return [target];
  if (target && typeof target.length === 'number') {
    return [...target].filter((x) => x instanceof Element);
  }
  return [];
}

export { DEFAULTS, PARAM_DEFS, detectDomCapabilities };
export default LiquidGlass;
