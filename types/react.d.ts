// Type definitions for liquid-glass/react
import type * as React from 'react';
import type { GlassParams, BackgroundSource, RendererKind } from './liquid-glass';

export interface LiquidGlassViewProps extends GlassParams {
  /** The stage element or a ref to it. Defaults to the host's parent. */
  stage?: React.RefObject<HTMLElement> | HTMLElement;
  background?: BackgroundSource;
  renderer?: RendererKind;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** React wrapper around LiquidGlass. React and react-dom are optional peers. */
export function LiquidGlassView(props: LiquidGlassViewProps): React.ReactElement;
export default LiquidGlassView;
