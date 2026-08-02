// Central parameter definitions for the Liquid Glass framework.
// Each entry documents type, default and (for numbers) a sensible clamp range.

export const PARAM_DEFS = {
  blurAmount:     { type: 'number',  default: 0.0,  min: 0,    max: 1,    doc: 'Background blur strength (0 = sharp, 1 = maximum blur)' },
  refraction:     { type: 'number',  default: 0.69, min: 0,    max: 2,    doc: 'How much the glass bends the image behind it' },
  chromAberration:{ type: 'number',  default: 0.05, min: 0,    max: 1,    doc: 'Chromatic aberration / colour fringing at edges' },
  edgeHighlight:  { type: 'number',  default: 0.05, min: 0,    max: 2,    doc: 'Edge glow / rim lighting intensity' },
  specular:       { type: 'number',  default: 0.0,  min: 0,    max: 2,    doc: 'Specular highlight intensity (multi-light Blinn-Phong)' },
  fresnel:        { type: 'number',  default: 1.0,  min: 0,    max: 2,    doc: 'Fresnel reflection at grazing angles' },
  distortion:     { type: 'number',  default: 0.0,  min: 0,    max: 1,    doc: 'Micro-distortion noise strength' },
  cornerRadius:   { type: 'number',  default: 65,   min: 0,    max: 2000, doc: 'Corner radius in CSS pixels' },
  zRadius:        { type: 'number',  default: 40,   min: 1,    max: 2000, doc: "Bevel depth — controls the curvature of the pill's cross-section" },
  opacity:        { type: 'number',  default: 1.0,  min: 0,    max: 1,    doc: 'Overall glass panel opacity' },
  saturation:     { type: 'number',  default: 0.0,  min: -1,   max: 1,    doc: 'Saturation adjustment (-1 = grayscale, 0 = normal, 1 = vivid)' },
  tintStrength:   { type: 'number',  default: 0.0,  min: 0,    max: 1,    doc: 'Cool blue glass tint strength' },
  brightness:     { type: 'number',  default: 0.0,  min: -0.5, max: 0.5,  doc: 'Brightness adjustment (-0.5 to 0.5)' },
  shadowOpacity:  { type: 'number',  default: 0.30, min: 0,    max: 1,    doc: 'Drop shadow opacity' },
  shadowSpread:   { type: 'number',  default: 10,   min: 0,    max: 200,  doc: 'Drop shadow spread in CSS pixels' },
  shadowOffsetY:  { type: 'number',  default: 1,    min: -200, max: 200,  doc: 'Shadow vertical offset in CSS pixels' },
  floating:       { type: 'boolean', default: false,                       doc: 'Enable drag-to-move via Pointer Events' },
  button:         { type: 'boolean', default: false,                       doc: 'Button mode — hover brightens; press flattens bevel and deepens shadow' },
  bevelMode:      { type: 'enum',    default: 0, values: [0, 1],           doc: '0 = biconvex pill (default). 1 = dome / plano-convex (cornerRadius === zRadius → half-sphere magnifier)' },
};

export const DEFAULTS = Object.freeze(
  Object.fromEntries(Object.entries(PARAM_DEFS).map(([k, d]) => [k, d.default]))
);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Coerce + clamp a single value against its definition. */
export function coerceParam(key, value) {
  const def = PARAM_DEFS[key];
  if (!def) return undefined;
  switch (def.type) {
    case 'number': {
      const n = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!Number.isFinite(n)) return def.default;
      return clamp(n, def.min, def.max);
    }
    case 'boolean':
      return value === true || value === 'true' || value === '' || value === 1 || value === '1';
    case 'enum': {
      const n = Number(value);
      return def.values.includes(n) ? n : def.default;
    }
    default:
      return value;
  }
}

/** Merge a partial patch onto a full, validated params object. */
export function normalizeParams(patch = {}, base = DEFAULTS) {
  const out = { ...base };
  for (const key of Object.keys(PARAM_DEFS)) {
    if (key in patch && patch[key] !== undefined && patch[key] !== null) {
      out[key] = coerceParam(key, patch[key]);
    }
  }
  return out;
}
