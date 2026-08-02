// <liquid-glass> custom element wrapping the LiquidGlass framework.
//
//   <div id="stage"> ...background... </div>
//   <liquid-glass stage="#stage" background="/bg.jpg" refraction="0.5"
//                 width="320" height="120" x="40" y="40" floating button>
//     <span>Play</span>
//   </liquid-glass>
//
// Numeric/boolean params map 1:1 to attributes (camelCase → kebab-case),
// e.g. chromAberration → chrom-aberration, cornerRadius → corner-radius.

import { LiquidGlass } from './liquid-glass.js';
import { PARAM_DEFS } from './params.js';

const toKebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const PARAM_ATTRS = Object.fromEntries(Object.keys(PARAM_DEFS).map((k) => [toKebab(k), k]));

export class LiquidGlassElement extends HTMLElement {
  static get observedAttributes() {
    return [...Object.keys(PARAM_ATTRS), 'background', 'stage', 'x', 'y', 'width', 'height', 'renderer'];
  }

  connectedCallback() {
    if (this._glass) return;
    this.style.display = 'block';
    this.style.position = this.style.position || 'absolute';

    const stage = this._resolveStage();
    const opts = { stage, ...this._readParams() };
    const w = this.getAttribute('width');
    const h = this.getAttribute('height');
    if (w) opts.width = w.match(/\D/) ? w : Number(w);
    if (h) opts.height = h.match(/\D/) ? h : Number(h);
    opts.x = Number(this.getAttribute('x') || 0);
    opts.y = Number(this.getAttribute('y') || 0);
    if (this.hasAttribute('renderer')) opts.renderer = this.getAttribute('renderer');

    this._glass = new LiquidGlass(opts);

    // Move light-DOM children into the glass content layer.
    while (this.firstChild) this._glass.content.appendChild(this.firstChild);
    this.appendChild(this._glass.element);

    const bg = this.getAttribute('background');
    if (bg) this._glass.setBackground(bg);
  }

  disconnectedCallback() {
    this._glass?.destroy();
    this._glass = null;
  }

  attributeChangedCallback(name, _old, value) {
    if (!this._glass) return;
    if (name in PARAM_ATTRS) {
      this._glass.set({ [PARAM_ATTRS[name]]: value == null ? false : (value === '' ? true : value) });
    } else if (name === 'background') {
      this._glass.setBackground(value);
    } else if (name === 'x' || name === 'y') {
      this._glass.setPosition(Number(this.getAttribute('x') || 0), Number(this.getAttribute('y') || 0));
    } else if (name === 'stage') {
      // Re-parenting stages at runtime is uncommon; rebuild for correctness.
      const children = [...this._glass.content.childNodes];
      this._glass.destroy();
      this._glass = null;
      children.forEach((c) => this.appendChild(c));
      this.connectedCallback();
    }
  }

  /** Imperative access to the underlying instance. */
  get glass() { return this._glass; }

  _resolveStage() {
    const sel = this.getAttribute('stage');
    if (sel) {
      const found = document.querySelector(sel);
      if (found) return found;
    }
    return this.offsetParent || this.parentElement || document.body;
  }

  _readParams() {
    const out = {};
    for (const [attr, key] of Object.entries(PARAM_ATTRS)) {
      if (!this.hasAttribute(attr)) continue;
      const raw = this.getAttribute(attr);
      out[key] = raw === '' ? true : raw;
    }
    return out;
  }
}

/**
 * Register the <liquid-glass> custom element. Registration is an explicit call,
 * not an import side effect, so importing this module is tree-shakeable and you
 * choose the tag name. Call once, before the elements are parsed/upgraded.
 */
export function defineLiquidGlass(tag = 'liquid-glass') {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, LiquidGlassElement);
  }
}
