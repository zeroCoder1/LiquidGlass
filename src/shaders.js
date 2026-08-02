// GLSL (WebGL2 / GLSL ES 3.00) shaders for the Liquid Glass effect.
//
// Pipeline per fragment:
//   1. Signed-distance rounded-rectangle mask (anti-aliased with fwidth).
//   2. Height field from the bevel profile (biconvex pill or dome).
//   3. Surface normal from the analytic gradient of the height field.
//   4. Background sampled (cover-mapped) with normal-driven refraction,
//      chromatic aberration, optional multi-tap blur and micro-distortion.
//   5. Blinn-Phong specular (2 lights), Fresnel rim, edge highlight.
//   6. Colour grade: saturation, cool tint, brightness, hover/press.
//   7. Composite with panel opacity and the AA coverage mask.

// ---------------------------------------------------------------------------
// Instanced variant: one WebGL2 context draws *all* panels sharing a stage in a
// single `drawArraysInstanced` call. Per-instance data (rect + every param) is
// supplied via vertex attributes; the shared background is one texture. This is
// what scales to hundreds / thousands of glass panels on one page.
// ---------------------------------------------------------------------------

export const INSTANCED_VERT_SRC = /* glsl */ `#version 300 es
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
}`;

export const INSTANCED_FRAG_SRC = /* glsl */ `#version 300 es
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
// symmetric disk — that lets the tap count scale with blur strength without the
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
// gradient, rounded corners a radial one — matching the field exactly.
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
  // Each tap is a dependent texture fetch — the dominant cost once blur is on.
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

  // Surface normal from the analytic height-field gradient — one SDF-gradient
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
}`;
