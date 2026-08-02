// GlassRenderPool — one shared WebGL2 context that renders *every* glass panel
// on a given stage in a single instanced draw call.
//
// Why this exists:
//   • Browsers cap active WebGL contexts (~8–16). One-context-per-panel dies
//     past ~16 panels. This pool uses exactly ONE context per stage.
//   • Every panel refracts the same page-behind background, so a single shared
//     texture is uploaded once (not one copy per panel).
//   • All panels are drawn with `drawArraysInstanced` — 1000 panels become one
//     draw of 1000 instances instead of 1000 separate draws.
//
// Panels register with the pool; each frame the pool batch-reads their layout,
// packs per-instance attributes, and issues a single draw. The pool self-cleans
// when its last panel unregisters.

import { INSTANCED_VERT_SRC, INSTANCED_FRAG_SRC } from './shaders.js';

// Per-instance attribute layout (5 × vec4 = 20 floats), matching the shader:
//   aRect  : x, y, w, h
//   aShape : cornerRadius, zRadius, bevelMode, opacity
//   aOptic : refraction, chrom, edgeHighlight, distortion
//   aLight : specular, fresnel, blur, saturation
//   aGrade : tint, brightness, pressed, hover
const FLOATS_PER_INSTANCE = 20;
const STRIDE = FLOATS_PER_INSTANCE * 4; // bytes

// Max shaded fragments per frame (sum of panel areas * dpr^2). The glass shader
// is expensive per pixel; exceeding this on weaker/software GPUs can drop the
// WebGL context. ~2.6M keeps a full-screen swarm safe while single panels stay
// at full device DPR.
const FRAGMENT_BUDGET = 2.6e6;

const _pools = new Map(); // stage element -> GlassRenderPool

/** Cheap one-off probe: can this browser give us a WebGL2 context at all? */
export function isWebGL2Available() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('Liquid Glass (instanced) shader compile error:\n' + log);
  }
  return sh;
}

/** Flush all live pools; returns true if any pool still needs animating. */
export function flushAllPools(time) {
  let needMore = false;
  for (const pool of _pools.values()) {
    if (pool.flush(time)) needMore = true;
  }
  return needMore;
}

export class GlassRenderPool {
  /** One pool per stage element, created on demand. */
  static forStage(stage, maxDpr = 2) {
    let pool = _pools.get(stage);
    if (!pool) {
      pool = new GlassRenderPool(stage, maxDpr);
      _pools.set(stage, pool);
    }
    return pool;
  }

  constructor(stage, maxDpr = 2) {
    this.stage = stage;
    this.maxDpr = maxDpr;
    this.panels = new Set();
    this._panelList = []; // scratch, reused each flush (see flush())
    this._dirty = true;
    this._dynamic = false;
    this._bg = null;
    this._bgSize = [1, 1];
    this._texReady = false;
    this._contextLost = false;
    this._destroyed = false;
    // Set by the owner (LiquidGlass) so the pool can wake the shared render
    // loop after the GPU context is restored.
    this.onNeedFlush = null;

    // Shared overlay canvas covering the stage; sits above the stage background
    // but below the glass DOM elements (which are appended after it).
    const canvas = document.createElement('canvas');
    this.canvas = canvas;
    const s = canvas.style;
    s.position = 'absolute';
    s.inset = '0';
    s.width = '100%';
    s.height = '100%';
    s.pointerEvents = 'none';
    s.zIndex = '0';
    if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
    stage.appendChild(canvas);

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;

    // A heavy batch (or GPU pressure) can make the browser drop the WebGL
    // context. Without handling, every later draw silently produces nothing —
    // the glass "disappears" until a full page reload. Recover automatically.
    this._onContextLost = (e) => {
      e.preventDefault();       // required so the browser *may* restore the context
      this._contextLost = true;
      this._texReady = false;
      // Many environments (software GPUs, some headless browsers) never fire
      // 'webglcontextrestored'. Proactively rebuild on a fresh canvas so the
      // glass comes back WITHOUT a page reload. Throttled to avoid a tight loop
      // if a redraw immediately re-loses the context.
      if (this._rebuildTimer == null) {
        this._rebuildTimer = setTimeout(() => { this._rebuildTimer = null; this._rebuild(); }, 250);
      }
    };
    this._onContextRestored = () => {
      if (this._rebuildTimer != null) { clearTimeout(this._rebuildTimer); this._rebuildTimer = null; }
      this._contextLost = false;
      this._initGL();
      if (this._bg) this._uploadTexture();
      this._dirty = true;
      this.onNeedFlush?.();      // wake the shared loop to repaint
    };
    canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);

    this._rebuildTimer = null;
    this._initGL();
  }

  /**
   * Replace the dead canvas + context with a fresh pair and repaint. Used when
   * the GPU context is lost and the browser does not fire a restore event.
   */
  _rebuild() {
    if (this._destroyed) return;
    const old = this.canvas;
    old.removeEventListener('webglcontextlost', this._onContextLost, false);
    old.removeEventListener('webglcontextrestored', this._onContextRestored, false);

    const canvas = document.createElement('canvas');
    canvas.style.cssText = old.style.cssText;
    old.replaceWith(canvas);
    this.canvas = canvas;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return; // no WebGL2 available on the rebuilt canvas; give up quietly
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);

    this._contextLost = false;
    this._initGL();
    if (this._bg) this._uploadTexture();
    this._dirty = true;
    this.onNeedFlush?.();
  }

  /** (Re)create all GL objects. Runs at construction and after context restore. */
  _initGL() {
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, INSTANCED_VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, INSTANCED_FRAG_SRC);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Liquid Glass (instanced) link error:\n' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = prog;

    this.uStageSize = gl.getUniformLocation(prog, 'uStageSize');
    this.uBgSize = gl.getUniformLocation(prog, 'uBgSize');
    this.uTime = gl.getUniformLocation(prog, 'uTime');
    this.uBg = gl.getUniformLocation(prog, 'uBg');

    // VAO with the 5 per-instance vec4 attributes (divisor 1). The quad itself
    // is generated from gl_VertexID, so there are no per-vertex attributes.
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ibo);
    for (let i = 0; i < 5; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, STRIDE, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);

    this.capacity = 0;
    this.data = new Float32Array(0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    this._setTexParams();
    // Immutable storage is (re)allocated lazily on first upload / size change.
    this._texW = null;
    this._texH = null;
  }

  _setTexParams() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  register(panel) {
    this.panels.add(panel);
    this._dirty = true;
  }

  unregister(panel) {
    this.panels.delete(panel);
    this._dirty = true;
    if (this.panels.size === 0) this.destroy();
  }

  markDirty() { this._dirty = true; }

  /** Set / replace the shared background texture for this stage. */
  setBackground(source, dynamic) {
    // Every panel on a stage shares ONE texture, so panels created together all
    // call this with the same source. Only (re)upload when the source actually
    // changes — uploading a full-resolution frame once per panel (e.g. 500× in
    // one burst) floods the GPU and can drop the WebGL context.
    const changed = source !== this._bg || !this._texReady;
    this._bg = source;
    this._dynamic = !!dynamic;
    if (changed) this._uploadTexture();
    this._dirty = true;
  }

  _uploadTexture() {
    const gl = this.gl;
    const src = this._bg;
    if (!src) return;
    const w = src.videoWidth || src.naturalWidth || src.width;
    const h = src.videoHeight || src.naturalHeight || src.height;
    if (!w || !h) return;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Immutable storage: allocate the GPU memory once per size with
    // texStorage2D, then push each frame in place with texSubImage2D. A video
    // background therefore never reallocates — the previous texImage2D path
    // freed and re-grew the texture on every single frame.
    if (this._texW !== w || this._texH !== h) {
      // texStorage2D may be called only once per texture object, so a genuine
      // size change (e.g. an adaptive-bitrate video switching resolution) needs
      // a fresh texture.
      if (this._texW != null) {
        gl.deleteTexture(this.texture);
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        this._setTexParams();
      }
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
      this._texW = w;
      this._texH = h;
    }
    try {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } catch {
      return; // tainted cross-origin source
    }
    this._bgSize = [w, h];
    this._texReady = true;
  }

  _ensureCapacity(n) {
    if (n <= this.capacity) return;
    const cap = Math.max(8, n, this.capacity * 2);
    this.data = new Float32Array(cap * FLOATS_PER_INSTANCE);
    this.capacity = cap;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
  }

  /** Render all panels in one instanced draw. Returns true while animating. */
  flush(time) {
    if (this._contextLost || this.gl.isContextLost()) return false;
    if (this.panels.size === 0) return false;
    if (!this._dirty && !this._dynamic) return false;
    const gl = this.gl;

    // Refresh a dynamic (video/canvas) background before drawing.
    if (this._dynamic && this._bg) {
      const isVideo = typeof HTMLVideoElement !== 'undefined' && this._bg instanceof HTMLVideoElement;
      if (!isVideo || this._bg.readyState >= 2) this._uploadTexture();
    }

    // --- Batch layout reads (no interleaved writes -> single reflow) --------
    const stageRect = this.stage.getBoundingClientRect();
    const stageW = stageRect.width;
    const stageH = stageRect.height;

    // Reuse one array across frames; a fresh [...set] every frame is pure
    // per-frame garbage on an animating stage.
    const panels = this._panelList;
    panels.length = 0;
    for (const pn of this.panels) panels.push(pn);
    const n = panels.length;
    this._ensureCapacity(n);
    const d = this.data;
    let sumArea = 0;
    let drawn = 0;
    for (let i = 0; i < n; i++) {
      const panel = panels[i];
      const r = panel.element.getBoundingClientRect();
      const left = r.left - stageRect.left;
      const top = r.top - stageRect.top;
      // Cull panels lying entirely outside the stage (e.g. scrolled out of a
      // list): they contribute nothing visible, so they must cost nothing and
      // must not inflate the adaptive-DPR budget for the panels that are shown.
      if (left + r.width < 0 || top + r.height < 0 || left > stageW || top > stageH) continue;
      const pr = panel.params;
      sumArea += r.width * r.height;
      const o = drawn * FLOATS_PER_INSTANCE;
      drawn++;
      d[o + 0] = left;
      d[o + 1] = top;
      d[o + 2] = r.width;
      d[o + 3] = r.height;
      d[o + 4] = pr.cornerRadius;
      d[o + 5] = pr.zRadius;
      d[o + 6] = pr.bevelMode;
      d[o + 7] = pr.opacity;
      d[o + 8] = pr.refraction;
      d[o + 9] = pr.chromAberration;
      d[o + 10] = pr.edgeHighlight;
      d[o + 11] = pr.distortion;
      d[o + 12] = pr.specular;
      d[o + 13] = pr.fresnel;
      d[o + 14] = pr.blurAmount;
      d[o + 15] = pr.saturation;
      d[o + 16] = pr.tintStrength;
      d[o + 17] = pr.brightness;
      d[o + 18] = panel._pressed || 0;
      d[o + 19] = panel._hover || 0;
    }

    // Adaptive resolution: the glass shader is fill-rate heavy, so many panels
    // at full devicePixelRatio can exceed the GPU's per-frame budget and drop
    // the WebGL context. Cap the effective DPR so the total shaded fragment
    // count (sum of panel areas * dpr^2) stays under a safe budget. A handful
    // of panels still render at full DPR; large swarms scale down gracefully.
    let dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    if (sumArea > 0) {
      dpr = Math.min(dpr, Math.max(0.6, Math.sqrt(FRAGMENT_BUDGET / sumArea)));
    }

    // --- Writes / draw ------------------------------------------------------
    const cw = Math.max(1, Math.round(stageW * dpr));
    const ch = Math.max(1, Math.round(stageH * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }

    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this._texReady && drawn > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ibo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, drawn * FLOATS_PER_INSTANCE);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.uBg, 0);
      gl.uniform2f(this.uStageSize, stageW, stageH);
      gl.uniform2f(this.uBgSize, this._bgSize[0], this._bgSize[1]);
      gl.uniform1f(this.uTime, time);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, drawn);
      gl.bindVertexArray(null);
    }

    this._dirty = false;
    return this._dynamic;
  }

  destroy() {
    this._destroyed = true;
    if (this._rebuildTimer != null) { clearTimeout(this._rebuildTimer); this._rebuildTimer = null; }
    _pools.delete(this.stage);
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored, false);
    try {
      gl.deleteTexture(this.texture);
      gl.deleteProgram(this.program);
      gl.deleteBuffer(this.ibo);
      gl.deleteVertexArray(this.vao);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch { /* context already lost */ }
    this.canvas.remove();
  }
}

export default GlassRenderPool;
