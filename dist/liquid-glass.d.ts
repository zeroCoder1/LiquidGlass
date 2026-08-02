// Type definitions for liquid-glass

export interface GlassParams {
  /** Background blur strength, 0 (sharp) – 1 (max). */
  blurAmount?: number;
  /** How much the glass bends the image behind it, 0 – 2. */
  refraction?: number;
  /** Chromatic aberration / colour fringing at edges, 0 – 1. */
  chromAberration?: number;
  /** Edge glow / rim lighting intensity, 0 – 2. */
  edgeHighlight?: number;
  /** Specular highlight intensity (2-light Blinn-Phong), 0 – 2. */
  specular?: number;
  /** Fresnel reflection at grazing angles, 0 – 2. */
  fresnel?: number;
  /** Animated micro-distortion noise, 0 – 1. */
  distortion?: number;
  /** Corner radius in CSS pixels, 0 – 2000. */
  cornerRadius?: number;
  /** Bevel depth — curvature of the cross-section, 1 – 2000. */
  zRadius?: number;
  /** Overall panel opacity, 0 – 1. */
  opacity?: number;
  /** Saturation of the refracted image, -1 – 1. */
  saturation?: number;
  /** Cool blue glass tint strength, 0 – 1. */
  tintStrength?: number;
  /** Brightness of the refracted image, -0.5 – 0.5. */
  brightness?: number;
  /** Drop shadow opacity, 0 – 1. */
  shadowOpacity?: number;
  /** Drop shadow spread in CSS pixels, 0 – 200. */
  shadowSpread?: number;
  /** Drop shadow vertical offset in CSS pixels, -200 – 200. */
  shadowOffsetY?: number;
  /** Enable drag-to-move via Pointer Events. */
  floating?: boolean;
  /** Button mode — hover brightens; press flattens the bevel and deepens the shadow. */
  button?: boolean;
  /** 0 = biconvex pill (default). 1 = dome / plano-convex. */
  bevelMode?: 0 | 1;
}

export type BackgroundSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | string;

export type RendererKind = 'auto' | 'webgl' | 'dom' | 'css';

/** What the runtime actually rendered with. */
export type GlassTier = 'webgl' | 'displacement' | 'blur' | 'flat';

export interface LiquidGlassOptions extends GlassParams {
  /** Container the glass lives in. Defaults to document.body. */
  stage?: HTMLElement;
  /** A texture to refract (image/video/canvas/URL). Selects the WebGL renderer under 'auto'. */
  background?: BackgroundSource;
  /** Force a renderer. 'auto' picks WebGL when a background is given, DOM otherwise. */
  renderer?: RendererKind;
  width?: number | string;
  height?: number | string;
  x?: number;
  y?: number;
  /** Cap the device pixel ratio for cost control. Default 2. */
  maxDpr?: number;
  /** Re-upload a canvas background every frame (for animated canvases). */
  dynamicCanvas?: boolean;
  /** Extra class name added to the panel element. */
  className?: string;
  /** (glassify) keep the adopted element's own background instead of clearing it. */
  keepBackground?: boolean;
  /** (glassify) adopt an existing element in place rather than creating a panel. */
  adopt?: HTMLElement;
}

export class LiquidGlass {
  constructor(options?: LiquidGlassOptions);
  /** The panel element. Append it to your stage. */
  readonly element: HTMLElement;
  /** Slot for foreground content (labels, icons), rendered above the glass. */
  readonly content: HTMLElement;
  readonly stage: HTMLElement;
  /** 'webgl' | 'dom'. */
  readonly mode: 'webgl' | 'dom';
  /** What you actually got: 'webgl' | 'displacement' | 'blur' | 'flat'. */
  readonly tier: GlassTier;
  /** Patch one or more parameters live. */
  set(patch: GlassParams): this;
  /** Read one parameter, or all of them. */
  get(): Required<GlassParams>;
  get(key: keyof GlassParams): number | boolean;
  /** Swap the WebGL background texture. */
  setBackground(src: BackgroundSource): Promise<void> | void;
  /** Move a constructed panel. */
  setPosition(x: number, y: number): this;
  /** Remove the panel and free GPU resources. */
  destroy(): void;
}

export default LiquidGlass;

/** Turn existing markup into glass in place. Returns the created instances. */
export function glassify(
  target: string | Element | NodeListOf<Element> | Element[],
  opts?: LiquidGlassOptions,
): LiquidGlass[];

/** Probe the DOM renderer's capabilities in the current browser. */
export function detectDomCapabilities(): { blur: boolean; displacement: boolean; tier: GlassTier };

/** Register the <liquid-glass> custom element (explicit; no import side effect). */
export function defineLiquidGlass(tag?: string): void;

export class LiquidGlassElement extends HTMLElement {
  readonly glass: LiquidGlass | null;
}

export const DEFAULTS: Required<GlassParams>;
export const PARAM_DEFS: Record<string, {
  type: 'number' | 'boolean' | 'enum';
  default: number | boolean;
  min?: number;
  max?: number;
  values?: number[];
  doc: string;
}>;
