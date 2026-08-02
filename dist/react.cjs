/*! liquid-glass — MIT licensed. https://github.com/zeroCoder1/LiquidGlass */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react.js
var react_exports = {};
__export(react_exports, {
  LiquidGlassView: () => LiquidGlassView,
  default: () => react_default
});
module.exports = __toCommonJS(react_exports);
var import_react = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");

// src/params.js
var PARAM_DEFS = {
  blurAmount: { type: "number", default: 0, min: 0, max: 1, doc: "Background blur strength (0 = sharp, 1 = maximum blur)" },
  refraction: { type: "number", default: 0.69, min: 0, max: 2, doc: "How much the glass bends the image behind it" },
  chromAberration: { type: "number", default: 0.05, min: 0, max: 1, doc: "Chromatic aberration / colour fringing at edges" },
  edgeHighlight: { type: "number", default: 0.05, min: 0, max: 2, doc: "Edge glow / rim lighting intensity" },
  specular: { type: "number", default: 0, min: 0, max: 2, doc: "Specular highlight intensity (multi-light Blinn-Phong)" },
  fresnel: { type: "number", default: 1, min: 0, max: 2, doc: "Fresnel reflection at grazing angles" },
  distortion: { type: "number", default: 0, min: 0, max: 1, doc: "Micro-distortion noise strength" },
  cornerRadius: { type: "number", default: 65, min: 0, max: 2e3, doc: "Corner radius in CSS pixels" },
  zRadius: { type: "number", default: 40, min: 1, max: 2e3, doc: "Bevel depth \u2014 controls the curvature of the pill's cross-section" },
  opacity: { type: "number", default: 1, min: 0, max: 1, doc: "Overall glass panel opacity" },
  saturation: { type: "number", default: 0, min: -1, max: 1, doc: "Saturation adjustment (-1 = grayscale, 0 = normal, 1 = vivid)" },
  tintStrength: { type: "number", default: 0, min: 0, max: 1, doc: "Cool blue glass tint strength" },
  brightness: { type: "number", default: 0, min: -0.5, max: 0.5, doc: "Brightness adjustment (-0.5 to 0.5)" },
  shadowOpacity: { type: "number", default: 0.3, min: 0, max: 1, doc: "Drop shadow opacity" },
  shadowSpread: { type: "number", default: 10, min: 0, max: 200, doc: "Drop shadow spread in CSS pixels" },
  shadowOffsetY: { type: "number", default: 1, min: -200, max: 200, doc: "Shadow vertical offset in CSS pixels" },
  floating: { type: "boolean", default: false, doc: "Enable drag-to-move via Pointer Events" },
  button: { type: "boolean", default: false, doc: "Button mode \u2014 hover brightens; press flattens bevel and deepens shadow" },
  bevelMode: { type: "enum", default: 0, values: [0, 1], doc: "0 = biconvex pill (default). 1 = dome / plano-convex (cornerRadius === zRadius \u2192 half-sphere magnifier)" }
};
var DEFAULTS = Object.freeze(
  Object.fromEntries(Object.entries(PARAM_DEFS).map(([k, d]) => [k, d.default]))
);
var clamp = (v, min, max) => Math.min(max, Math.max(min, v));
function coerceParam(key, value) {
  const def = PARAM_DEFS[key];
  if (!def) return void 0;
  switch (def.type) {
    case "number": {
      const n = typeof value === "string" ? parseFloat(value) : Number(value);
      if (!Number.isFinite(n)) return def.default;
      return clamp(n, def.min, def.max);
    }
    case "boolean":
      return value === true || value === "true" || value === "" || value === 1 || value === "1";
    case "enum": {
      const n = Number(value);
      return def.values.includes(n) ? n : def.default;
    }
    default:
      return value;
  }
}
function normalizeParams(patch = {}, base = DEFAULTS) {
  const out = { ...base };
  for (const key of Object.keys(PARAM_DEFS)) {
    if (key in patch && patch[key] !== void 0 && patch[key] !== null) {
      out[key] = coerceParam(key, patch[key]);
    }
  }
  return out;
}

// src/shaders.js
var INSTANCED_VERT_SRC = (
  /* glsl */
  `#version 300 es
precision highp float;

uniform vec2 uStageSize;          // CSS px

layout(location = 0) in vec4 aRect;   // x, y, w, h  (stage CSS px, top-left origin)
layout(location = 1) in vec4 aShape;  // cornerRadius, zRadius, bevelMode, opacity
layout(location = 2) in vec4 aOptic;  // refraction, chrom, edgeHighlight, distortion
layout(location = 3) in vec4 aLight;  // specular, fresnel, blur, saturation
layout(location = 4) in vec4 aGrade;  // tint, brightness, pressed, hover

out vec2 vLocal;        // 0..panelSize in CSS px
out vec2 vPanelSize;
out vec2 vPanelOffset;  // panel top-left within stage
flat out vec4 vShape;
flat out vec4 vOptic;
flat out vec4 vLight;
flat out vec4 vGrade;

const vec2 QUAD[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
  vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0)
);

void main() {
  vec2 corner = QUAD[gl_VertexID];
  vec2 posPx = aRect.xy + corner * aRect.zw;
  vec2 ndc = vec2(posPx.x / uStageSize.x * 2.0 - 1.0,
                  1.0 - posPx.y / uStageSize.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);

  vLocal = corner * aRect.zw;
  vPanelSize = aRect.zw;
  vPanelOffset = aRect.xy;
  vShape = aShape;
  vOptic = aOptic;
  vLight = aLight;
  vGrade = aGrade;
}`
);
var INSTANCED_FRAG_SRC = (
  /* glsl */
  `#version 300 es
precision highp float;

uniform sampler2D uBg;
uniform vec2  uStageSize;
uniform vec2  uBgSize;
uniform float uTime;

in vec2 vLocal;
in vec2 vPanelSize;
in vec2 vPanelOffset;
flat in vec4 vShape;   // cornerRadius, zRadius, bevelMode, opacity
flat in vec4 vOptic;   // refraction, chrom, edgeHighlight, distortion
flat in vec4 vLight;   // specular, fresnel, blur, saturation
flat in vec4 vGrade;   // tint, brightness, pressed, hover

out vec4 fragColor;

const float NORMAL_Z   = 0.34;
const float REFRACT_PX = 130.0;
const int   BLUR_TAPS  = 8;

// Ordered as balanced pairs around the centre, so any prefix of the array is a
// symmetric disk \u2014 that lets the tap count scale with blur strength without the
// sample pattern going lop-sided. The full set is the same 8 points as before,
// so a full-strength blur is unchanged (summation order is irrelevant).
const vec2 POISSON[8] = vec2[8](
  vec2( 0.0,   0.0),                             // centre
  vec2( 0.707, 0.707), vec2(-0.707,-0.707),      // diagonal pair
  vec2(-0.707, 0.707), vec2( 0.707,-0.707),      // diagonal pair
  vec2( 1.0,   0.0),   vec2(-1.0,   0.0),         // axis pair
  vec2( 0.0,   1.0)                              // remaining axis
);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float sdRoundRect(vec2 p, vec2 b, float r) {
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
// Analytic gradient of the rounded-rect SDF: a unit vector pointing outward
// (direction of increasing distance). Straight edges give an axis-aligned
// gradient, rounded corners a radial one \u2014 matching the field exactly.
vec2 sdRoundRectGrad(vec2 p, vec2 b, float r) {
  r = min(r, min(b.x, b.y));
  vec2 s = sign(p);
  vec2 q = abs(p) - b + r;
  vec2 g = (max(q.x, q.y) > 0.0)
    ? normalize(max(q, vec2(0.0)))                     // edge / corner region
    : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));   // deep interior
  return s * g;
}
// dh/d(inside): slope of the bevel height profile h(t)=sqrt(1-(1-t)^2) with
// t = inside/band. max(inside,1.0) caps the rim slope at the same 1px
// resolution the old central difference had, so the lens edge looks identical.
float bevelSlope(float inside, float zR, vec2 gHalf, int bevel) {
  if (inside <= 0.0) return 0.0;
  float band = (bevel == 0)
    ? max(zR, 0.5)
    : max(min(min(gHalf.x, gHalf.y), zR), 0.5);
  float t = clamp(max(inside, 1.0) / band, 0.0, 1.0);
  float h = sqrt(max(1e-4, 1.0 - (1.0 - t) * (1.0 - t)));
  return (1.0 - t) / (h * band);
}
vec2 coverUV(vec2 sc) {
  vec2 uv = sc / uStageSize;
  float sa = uStageSize.x / uStageSize.y;
  float ta = uBgSize.x / uBgSize.y;
  if (ta > sa) { uv.x = (uv.x - 0.5) * (sa / ta) + 0.5; }
  else         { uv.y = (uv.y - 0.5) * (ta / sa) + 0.5; }
  return uv;
}
vec3 sampleBg(vec2 sc, float blur) {
  vec2 uv = coverUV(sc);
  if (blur <= 0.001) return texture(uBg, clamp(uv, 0.0, 1.0)).rgb;
  float radius = blur * 0.03;
  // Each tap is a dependent texture fetch \u2014 the dominant cost once blur is on.
  // A light blur is smooth with a few samples; only a heavy blur needs the full
  // disk, so scale the count with strength (min 3 = centre + one symmetric pair,
  // max 8 = the full set, i.e. identical to a full-strength blur).
  int taps = int(clamp(ceil(blur * float(BLUR_TAPS)), 3.0, float(BLUR_TAPS)));
  vec3 sum = vec3(0.0);
  for (int i = 0; i < BLUR_TAPS; i++) {
    if (i >= taps) break;
    sum += texture(uBg, clamp(uv + POISSON[i] * radius, 0.0, 1.0)).rgb;
  }
  return sum / float(taps);
}

void main() {
  float cornerR = vShape.x;
  float zR      = vShape.y;
  int   bevel   = int(vShape.z + 0.5);
  float opacity = vShape.w;
  float refraction = vOptic.x, chrom = vOptic.y, edgeHi = vOptic.z, distortion = vOptic.w;
  float specular = vLight.x, fresnel = vLight.y, blur = vLight.z, saturation = vLight.w;
  float tint = vGrade.x, brightness = vGrade.y, pressed = vGrade.z, hover = vGrade.w;

  vec2 panelCenter = vPanelSize * 0.5;
  vec2 gHalf = panelCenter - 1.0;
  vec2 localCss = vLocal;
  vec2 p = localCss - panelCenter;

  float sd = sdRoundRect(p, gHalf, cornerR);
  float aa = fwidth(sd) + 1e-4;
  float mask = 1.0 - smoothstep(-aa, aa, sd);
  if (mask <= 0.001) { fragColor = vec4(0.0); return; }

  float inside = -sd;
  float pressFlat = mix(1.0, 0.32, pressed);

  // Surface normal from the analytic height-field gradient \u2014 one SDF-gradient
  // evaluation instead of four finite-difference height samples. Since
  // grad(height) = dh/d(inside) * grad(inside) = -slope * grad(sd), the
  // refraction direction -N.xy points inward (convex lens). The factor 2.0
  // reproduces the old central-difference magnitude, so N is unchanged.
  float slope = bevelSlope(inside, zR, gHalf, bevel);
  vec2 nxy = 2.0 * slope * sdRoundRectGrad(p, gHalf, cornerR) * pressFlat;
  vec3 N = normalize(vec3(nxy, NORMAL_Z));

  vec2 stageCoord = vPanelOffset + localCss;

  vec2 distort = vec2(0.0);
  if (distortion > 0.001) {
    float n1 = valueNoise(p * 0.06 + uTime * 0.3);
    float n2 = valueNoise(p * 0.06 + 41.0 - uTime * 0.25);
    distort = (vec2(n1, n2) - 0.5) * distortion * 34.0;
  }

  vec2 refr   = -N.xy * refraction * REFRACT_PX + distort;
  vec2 radial = p / max(gHalf, vec2(1.0));
  vec2 caDir  = -N.xy * REFRACT_PX + radial * 40.0;
  vec2 ca     = caDir * chrom * 2.0;

  vec3 col;
  if (chrom > 0.001) {
    col.r = sampleBg(stageCoord + refr + ca, blur).r;
    col.g = sampleBg(stageCoord + refr, blur).g;
    col.b = sampleBg(stageCoord + refr - ca, blur).b;
  } else {
    col = sampleBg(stageCoord + refr, blur);
  }

  if (specular > 0.001) {
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L1 = normalize(vec3(-0.45, -0.75, 0.65));
    vec3 L2 = normalize(vec3( 0.55,  0.6,  0.8));
    vec3 H1 = normalize(L1 + V);
    vec3 H2 = normalize(L2 + V);
    vec3 spec = pow(max(dot(N, H1), 0.0), 64.0) * vec3(1.0);
    spec += pow(max(dot(N, H2), 0.0), 40.0) * vec3(0.85, 0.92, 1.0);
    col += spec * specular;
  }
  if (fresnel > 0.001) {
    float fres = pow(1.0 - clamp(N.z, 0.0, 1.0), 3.0) * fresnel;
    col += fres * vec3(0.82, 0.9, 1.0) * 0.6;
  }
  if (edgeHi > 0.001) {
    float rim = 1.0 - smoothstep(0.0, max(zR * 0.5, 4.0), inside);
    col += rim * edgeHi * vec3(1.0);
  }

  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.0 + saturation);
  col = mix(col, col * vec3(0.8, 0.9, 1.15), tint);
  col += brightness + hover * 0.09;

  float alpha = mask * opacity;
  fragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}`
);

// src/glass-pool.js
var FLOATS_PER_INSTANCE = 20;
var STRIDE = FLOATS_PER_INSTANCE * 4;
var FRAGMENT_BUDGET = 26e5;
var _pools = /* @__PURE__ */ new Map();
function isWebGL2Available() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
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
    throw new Error("Liquid Glass (instanced) shader compile error:\n" + log);
  }
  return sh;
}
function flushAllPools(time) {
  let needMore = false;
  for (const pool of _pools.values()) {
    if (pool.flush(time)) needMore = true;
  }
  return needMore;
}
var GlassRenderPool = class _GlassRenderPool {
  /** One pool per stage element, created on demand. */
  static forStage(stage, maxDpr = 2) {
    let pool = _pools.get(stage);
    if (!pool) {
      pool = new _GlassRenderPool(stage, maxDpr);
      _pools.set(stage, pool);
    }
    return pool;
  }
  constructor(stage, maxDpr = 2) {
    this.stage = stage;
    this.maxDpr = maxDpr;
    this.panels = /* @__PURE__ */ new Set();
    this._panelList = [];
    this._dirty = true;
    this._dynamic = false;
    this._bg = null;
    this._bgSize = [1, 1];
    this._texReady = false;
    this._contextLost = false;
    this._destroyed = false;
    this.onNeedFlush = null;
    const canvas = document.createElement("canvas");
    this.canvas = canvas;
    const s = canvas.style;
    s.position = "absolute";
    s.inset = "0";
    s.width = "100%";
    s.height = "100%";
    s.pointerEvents = "none";
    s.zIndex = "0";
    if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
    stage.appendChild(canvas);
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;
    this._onContextLost = (e) => {
      e.preventDefault();
      this._contextLost = true;
      this._texReady = false;
      if (this._rebuildTimer == null) {
        this._rebuildTimer = setTimeout(() => {
          this._rebuildTimer = null;
          this._rebuild();
        }, 250);
      }
    };
    this._onContextRestored = () => {
      var _a;
      if (this._rebuildTimer != null) {
        clearTimeout(this._rebuildTimer);
        this._rebuildTimer = null;
      }
      this._contextLost = false;
      this._initGL();
      if (this._bg) this._uploadTexture();
      this._dirty = true;
      (_a = this.onNeedFlush) == null ? void 0 : _a.call(this);
    };
    canvas.addEventListener("webglcontextlost", this._onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this._onContextRestored, false);
    this._rebuildTimer = null;
    this._initGL();
  }
  /**
   * Replace the dead canvas + context with a fresh pair and repaint. Used when
   * the GPU context is lost and the browser does not fire a restore event.
   */
  _rebuild() {
    var _a;
    if (this._destroyed) return;
    const old = this.canvas;
    old.removeEventListener("webglcontextlost", this._onContextLost, false);
    old.removeEventListener("webglcontextrestored", this._onContextRestored, false);
    const canvas = document.createElement("canvas");
    canvas.style.cssText = old.style.cssText;
    old.replaceWith(canvas);
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    });
    if (!gl) return;
    this.gl = gl;
    canvas.addEventListener("webglcontextlost", this._onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this._onContextRestored, false);
    this._contextLost = false;
    this._initGL();
    if (this._bg) this._uploadTexture();
    this._dirty = true;
    (_a = this.onNeedFlush) == null ? void 0 : _a.call(this);
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
      throw new Error("Liquid Glass (instanced) link error:\n" + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = prog;
    this.uStageSize = gl.getUniformLocation(prog, "uStageSize");
    this.uBgSize = gl.getUniformLocation(prog, "uBgSize");
    this.uTime = gl.getUniformLocation(prog, "uTime");
    this.uBg = gl.getUniformLocation(prog, "uBg");
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
  markDirty() {
    this._dirty = true;
  }
  /** Set / replace the shared background texture for this stage. */
  setBackground(source, dynamic) {
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
    if (this._texW !== w || this._texH !== h) {
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
      return;
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
    if (this._dynamic && this._bg) {
      const isVideo = typeof HTMLVideoElement !== "undefined" && this._bg instanceof HTMLVideoElement;
      if (!isVideo || this._bg.readyState >= 2) this._uploadTexture();
    }
    const stageRect = this.stage.getBoundingClientRect();
    const stageW = stageRect.width;
    const stageH = stageRect.height;
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
    let dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    if (sumArea > 0) {
      dpr = Math.min(dpr, Math.max(0.6, Math.sqrt(FRAGMENT_BUDGET / sumArea)));
    }
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
    if (this._rebuildTimer != null) {
      clearTimeout(this._rebuildTimer);
      this._rebuildTimer = null;
    }
    _pools.delete(this.stage);
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this._onContextLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this._onContextRestored, false);
    try {
      gl.deleteTexture(this.texture);
      gl.deleteProgram(this.program);
      gl.deleteBuffer(this.ibo);
      gl.deleteVertexArray(this.vao);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    } catch {
    }
    this.canvas.remove();
  }
};

// src/dom-renderer.js
var _idSeq = 0;
var MAP_MAX = 256;
function detectDomCapabilities() {
  const supports = (p, v) => {
    try {
      return CSS.supports(p, v);
    } catch {
      return false;
    }
  };
  const blur = supports("backdrop-filter", "blur(4px)") || supports("-webkit-backdrop-filter", "blur(4px)");
  let displacement = blur && (supports("backdrop-filter", 'url("#x")') || supports("-webkit-backdrop-filter", 'url("#x")'));
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const vendor = typeof navigator !== "undefined" ? navigator.vendor || "" : "";
  const isFirefox = /firefox/i.test(ua);
  const isWebKit = /apple/i.test(vendor);
  if (isFirefox || isWebKit) displacement = false;
  return { blur, displacement, tier: displacement ? "displacement" : blur ? "blur" : "flat" };
}
var sdRoundRect = (px, py, bx, by, r) => {
  r = Math.min(r, Math.min(bx, by));
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};
var profileArc = (t) => {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
};
function bakeMap(w, h, cornerRadius, zRadius, bevelMode) {
  const scale = Math.min(1, MAP_MAX / Math.max(w, h));
  const W = Math.max(2, Math.round(w * scale));
  const H = Math.max(2, Math.round(h * scale));
  const bx = W / 2, by = H / 2;
  const cr = cornerRadius * scale;
  const zr = Math.max(0.5, zRadius * scale);
  const height = (px, py) => {
    const inside = -sdRoundRect(px, py, bx, by, cr);
    if (inside <= 0) return 0;
    let t;
    if (bevelMode === 0) t = inside / zr;
    else t = inside / Math.max(0.5, Math.min(Math.min(bx, by), zr));
    return profileArc(t);
  };
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const im = ctx.createImageData(W, H);
  const d = im.data;
  const e = 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x - bx, py = y - by;
      const gx = (height(px + e, py) - height(px - e, py)) * 0.5;
      const gy = (height(px, py + e) - height(px, py - e)) * 0.5;
      const p = (y * W + x) * 4;
      d[p] = Math.max(0, Math.min(255, 128 + gx * 127));
      d[p + 1] = Math.max(0, Math.min(255, 128 + gy * 127));
      d[p + 2] = 128;
      d[p + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  return c.toDataURL("image/png");
}
var DomDisplacementRenderer = class {
  constructor() {
    const caps = detectDomCapabilities();
    this.tier = caps.tier;
    this._caps = caps;
    this.canvas = document.createElement("div");
    const s = this.canvas.style;
    s.position = "absolute";
    s.inset = "0";
    s.width = "100%";
    s.height = "100%";
    s.pointerEvents = "none";
    this._id = `lg-disp-${++_idSeq}`;
    this._mapKey = "";
    this._svg = null;
    this._feImage = null;
    this._feDisp = null;
    if (this.tier === "displacement") this._buildFilter();
  }
  // No texture to update — the live page *is* the backdrop.
  updateTexture() {
    return true;
  }
  resize() {
  }
  _buildFilter() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", this._id);
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    const feImage = document.createElementNS(NS, "feImage");
    feImage.setAttribute("preserveAspectRatio", "none");
    feImage.setAttribute("result", "map");
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    const feDisp = document.createElementNS(NS, "feDisplacementMap");
    feDisp.setAttribute("in", "SourceGraphic");
    feDisp.setAttribute("in2", "map");
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
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
    f.setAttribute("href", url);
    f.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
    for (const el of [this._feImage, this._feDisp]) {
      el.setAttribute("width", String(w));
      el.setAttribute("height", String(h));
    }
    this._svg.querySelector("filter").setAttribute("width", String(w));
    this._svg.querySelector("filter").setAttribute("height", String(h));
  }
  render(params, layout) {
    const s = this.canvas.style;
    const w = layout.panelW, h = layout.panelH;
    const blurPx = params.blurAmount * 24;
    const sat = 1 + params.saturation;
    const bright = 1 + params.brightness + (layout.hover || 0) * 0.09;
    const parts = [];
    if (blurPx > 0.01) parts.push(`blur(${blurPx.toFixed(2)}px)`);
    parts.push(`saturate(${sat.toFixed(3)})`);
    parts.push(`brightness(${bright.toFixed(3)})`);
    if (this.tier === "displacement" && params.refraction > 1e-3) {
      this._syncMap(params, w, h);
      const scale = params.refraction * 42 * (1 - (layout.pressed || 0) * 0.7);
      this._feDisp.setAttribute("scale", scale.toFixed(2));
      parts.push(`url(#${this._id})`);
    }
    const filter = parts.join(" ");
    s.borderRadius = params.cornerRadius + "px";
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
    s.background = `radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,${(0.18 * (1 - press) + sheen).toFixed(3)}), rgba(255,255,255,0) 45%),linear-gradient(180deg, rgba(255,255,255,${(0.1 * (1 - press)).toFixed(3)}), rgba(255,255,255,0) ${bevel}px),linear-gradient(0deg, rgba(0,0,0,${(0.08 * (1 - press)).toFixed(3)}), rgba(0,0,0,0) ${bevel}px),linear-gradient(135deg, rgba(150,190,255,${(0.25 * tint).toFixed(3)}), rgba(120,160,255,${(0.1 * tint).toFixed(3)}))`;
    s.boxShadow = `inset 0 0 0 1px rgba(255,255,255,${(0.35 * edge).toFixed(3)}),inset 0 1px 1px rgba(255,255,255,${(0.4 * edge).toFixed(3)})`;
  }
  destroy() {
    var _a;
    (_a = this._svg) == null ? void 0 : _a.remove();
    this.canvas.remove();
  }
};

// src/liquid-glass.js
var _sharedRAF = null;
var _instances = /* @__PURE__ */ new Set();
function tick(now) {
  const t = now / 1e3;
  let needMore = false;
  for (const inst of _instances) {
    if (inst._frame(t)) needMore = true;
  }
  if (flushAllPools(t)) needMore = true;
  _sharedRAF = needMore ? requestAnimationFrame(tick) : null;
}
function ensureLoop() {
  if (_sharedRAF == null) _sharedRAF = requestAnimationFrame(tick);
}
async function resolveBackground(bg) {
  if (typeof bg === "string") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = bg;
    if (img.decode) {
      try {
        await img.decode();
      } catch {
      }
    } else await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    return img;
  }
  return bg;
}
var LiquidGlass = class {
  constructor(options = {}) {
    var _a, _b, _c;
    this.options = options;
    this.params = normalizeParams(options, DEFAULTS);
    this._maxDpr = (_a = options.maxDpr) != null ? _a : 2;
    this._renderer = options.renderer || "auto";
    this._forceWebGL = this._renderer === "webgl";
    this._forceDOM = this._renderer === "dom" || this._renderer === "css";
    this._adopt = options.adopt || null;
    this._keepBackground = !!options.keepBackground;
    this._restoreStyle = null;
    this._tier = "flat";
    this._dirty = true;
    this._hover = 0;
    this._pressed = 0;
    this._dragging = false;
    this._drag = { dx: 0, dy: 0 };
    this._x = (_b = options.x) != null ? _b : 0;
    this._y = (_c = options.y) != null ? _c : 0;
    this._destroyed = false;
    this.stage = options.stage || this._adopt && this._adopt.offsetParent || document.body;
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
    const el = document.createElement("div");
    el.className = "liquid-glass" + (options.className ? " " + options.className : "");
    el.style.position = "absolute";
    el.style.left = this._x + "px";
    el.style.top = this._y + "px";
    if (options.width != null) el.style.width = typeof options.width === "number" ? options.width + "px" : options.width;
    if (options.height != null) el.style.height = typeof options.height === "number" ? options.height + "px" : options.height;
    el.style.overflow = "visible";
    el.style.touchAction = "none";
    this.element = el;
    this._surface = document.createElement("div");
    const ss = this._surface.style;
    ss.position = "absolute";
    ss.inset = "0";
    ss.zIndex = "0";
    ss.pointerEvents = "none";
    el.appendChild(this._surface);
    this.content = document.createElement("div");
    const cs = this.content.style;
    cs.position = "relative";
    cs.zIndex = "1";
    cs.width = "100%";
    cs.height = "100%";
    el.appendChild(this.content);
    this._applyShadow();
  }
  // Adopt an element already in the page: keep its children, layout and event
  // handlers, and slip a glass surface behind its content. The surface sits at
  // z-index -1 so existing children stay on top and stay interactive, while its
  // backdrop is whatever the element is laid over — the live page.
  _adoptDOM(options) {
    const el = this._adopt;
    if (!el.classList.contains("liquid-glass")) el.classList.add("liquid-glass");
    if (options.className) el.classList.add(options.className);
    this.element = el;
    this.content = el;
    const cs = getComputedStyle(el);
    this._restoreStyle = {
      position: el.style.position,
      background: el.style.background,
      borderRadius: el.style.borderRadius,
      boxShadow: el.style.boxShadow
    };
    if (cs.position === "static") el.style.position = "relative";
    if (!this._keepBackground) el.style.background = "transparent";
    this._surface = document.createElement("div");
    const ss = this._surface.style;
    ss.position = "absolute";
    ss.inset = "0";
    ss.zIndex = "-1";
    ss.pointerEvents = "none";
    ss.borderRadius = "inherit";
    el.insertBefore(this._surface, el.firstChild);
    this._applyShadow();
  }
  _selectRenderer() {
    const wantWebGL = this._forceWebGL || this._renderer === "auto" && this._adopt == null && this.options.background != null;
    if (wantWebGL && !this._forceDOM && isWebGL2Available()) {
      try {
        this._pool = GlassRenderPool.forStage(this.stage, this._maxDpr);
        this._pool.onNeedFlush = ensureLoop;
        this._pool.register(this);
        this.mode = "webgl";
        this._tier = "webgl";
        return;
      } catch (err) {
        console.warn("[LiquidGlass] WebGL pool init failed, falling back to DOM:", err);
      }
    }
    this.mode = "dom";
    this.renderer = new DomDisplacementRenderer();
    this._tier = this.renderer.tier;
    if (this._tier === "flat") {
      console.warn("[LiquidGlass] No backdrop-filter support; glass will render flat.");
    }
    this._surface.appendChild(this.renderer.canvas);
    this._surface.style.borderRadius = this.params.cornerRadius + "px";
  }
  /** What the runtime actually gave you: 'webgl' | 'displacement' | 'blur' | 'flat'. */
  get tier() {
    return this._tier;
  }
  async setBackground(bg) {
    this._bg = await resolveBackground(bg);
    if (this._destroyed) return;
    this._isVideo = this._bg instanceof HTMLVideoElement;
    this._isDynamic = this._isVideo || typeof HTMLCanvasElement !== "undefined" && this._bg instanceof HTMLCanvasElement && this.options.dynamicCanvas;
    if (this.mode === "webgl") {
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
    if ("shadowOpacity" in patch || "shadowSpread" in patch || "shadowOffsetY" in patch || "button" in patch || "cornerRadius" in patch) {
      this._applyShadow();
    }
    if (this.mode !== "webgl" && "cornerRadius" in patch) {
      this._surface.style.borderRadius = this.params.cornerRadius + "px";
    }
    this._requestRender();
    return this;
  }
  get(key) {
    return key ? this.params[key] : { ...this.params };
  }
  setPosition(x, y) {
    this._x = x;
    this._y = y;
    this.element.style.left = x + "px";
    this.element.style.top = y + "px";
    this._requestRender();
    return this;
  }
  _applyShadow() {
    const p = this.params;
    const press = this._pressed;
    const spread = p.shadowSpread * (1 + press * 0.8);
    const oy = p.shadowOffsetY + press * 4;
    const op = Math.min(1, p.shadowOpacity * (1 + press * 0.6));
    this.element.style.borderRadius = p.cornerRadius + "px";
    this.element.style.boxShadow = `0 ${oy}px ${spread}px rgba(0,0,0,${op})`;
  }
  // --- interactions --------------------------------------------------------
  _attachInteractions() {
    const el = this.element;
    this._onEnter = () => {
      if (this.params.button) {
        this._hover = 1;
        this._requestRender();
      }
    };
    this._onLeave = () => {
      this._hover = 0;
      this._pressed = 0;
      this._applyShadow();
      this._requestRender();
    };
    this._onDown = (e) => {
      if (this.params.button) {
        this._pressed = 1;
        this._applyShadow();
        this._requestRender();
      }
      if (this.params.floating) this._startDrag(e);
    };
    this._onUp = () => {
      if (this.params.button && this._pressed) {
        this._pressed = 0;
        this._applyShadow();
        this._requestRender();
      }
    };
    el.addEventListener("pointerenter", this._onEnter, { passive: true });
    el.addEventListener("pointerleave", this._onLeave, { passive: true });
    el.addEventListener("pointerdown", this._onDown, { passive: true });
    window.addEventListener("pointerup", this._onUp, { passive: true });
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
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {
    }
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
      pressed: this._pressed
    };
  }
  _frame(time) {
    if (this._destroyed) return false;
    const animating = this._isDynamic || this.params.distortion > 1e-3 || this._dragging;
    if (this.mode === "webgl") {
      if (this._dirty || animating) this._pool.markDirty();
      this._dirty = false;
      return animating;
    }
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
    this.element.removeEventListener("pointerenter", this._onEnter);
    this.element.removeEventListener("pointerleave", this._onLeave);
    this.element.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointerup", this._onUp);
    if (this.mode === "webgl") {
      this._pool.unregister(this);
      if (_instances.size > 0) ensureLoop();
    } else {
      this.renderer.destroy();
    }
    if (this._adopt) {
      const r = this._restoreStyle || {};
      this._surface.remove();
      this.element.classList.remove("liquid-glass");
      this.element.style.position = r.position || "";
      this.element.style.background = r.background || "";
      this.element.style.borderRadius = r.borderRadius || "";
      this.element.style.boxShadow = r.boxShadow || "";
    } else {
      this.element.remove();
    }
  }
};

// src/react.js
var { useRef, useEffect, useLayoutEffect, useState } = import_react.default;
var useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
var PARAM_KEYS = Object.keys(PARAM_DEFS);
function LiquidGlassView(props) {
  const {
    stage,
    background,
    x = 0,
    y = 0,
    width,
    height,
    renderer,
    className,
    style,
    children,
    ...rest
  } = props;
  const hostRef = useRef(null);
  const glassRef = useRef(null);
  const contentRef = useRef(null);
  const [, forceRender] = useState(0);
  useIso(() => {
    const host = hostRef.current;
    if (!host) return;
    const stageEl = stage && (stage.current || stage) || host.parentElement || document.body;
    const params = {};
    for (const k of PARAM_KEYS) if (rest[k] !== void 0) params[k] = rest[k];
    const glass = new LiquidGlass({
      stage: stageEl,
      x,
      y,
      width,
      height,
      renderer,
      className,
      ...params
    });
    glassRef.current = glass;
    const contentHost = document.createElement("div");
    contentHost.style.width = "100%";
    contentHost.style.height = "100%";
    glass.content.appendChild(contentHost);
    contentRef.current = contentHost;
    host.appendChild(glass.element);
    if (background) glass.setBackground(background);
    forceRender((n) => n + 1);
    return () => {
      glass.destroy();
      glassRef.current = null;
    };
  }, []);
  useEffect(() => {
    const glass = glassRef.current;
    if (!glass) return;
    const patch = {};
    for (const k of PARAM_KEYS) if (rest[k] !== void 0) patch[k] = rest[k];
    glass.set(patch);
  }, PARAM_KEYS.map((k) => rest[k]));
  useEffect(() => {
    var _a;
    (_a = glassRef.current) == null ? void 0 : _a.setPosition(x, y);
  }, [x, y]);
  useEffect(() => {
    var _a;
    if (background) (_a = glassRef.current) == null ? void 0 : _a.setBackground(background);
  }, [background]);
  const portal = contentRef.current ? (0, import_react_dom.createPortal)(children, contentRef.current) : null;
  return import_react.default.createElement(
    "div",
    { ref: hostRef, className, style: { display: "contents", ...style } },
    portal
  );
}
var react_default = LiquidGlassView;
//# sourceMappingURL=react.cjs.map
