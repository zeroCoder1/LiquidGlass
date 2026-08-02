// React wrapper for the Liquid Glass framework.
//
// Uses React.createElement (no JSX) so it works as plain ESM without a build
// step, while remaining fully usable from JSX/TSX projects:
//
//   import React, { useRef } from 'react';
//   import { LiquidGlassView } from './react.js';
//
//   const stageRef = useRef(null);
//   <div ref={stageRef} style={{ position:'relative' }}>
//     <img src="/bg.jpg" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
//     <LiquidGlassView stage={stageRef} background="/bg.jpg"
//                      refraction={0.5} width={320} height={120} x={40} y={40} button>
//       Play
//     </LiquidGlassView>
//   </div>
//
// Requires React 16.8+ and react-dom provided by the host app.

import React from 'react';
import { createPortal } from 'react-dom';
import { LiquidGlass } from './liquid-glass.js';
import { PARAM_DEFS } from './params.js';

const { useRef, useEffect, useLayoutEffect, useState } = React;
const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const PARAM_KEYS = Object.keys(PARAM_DEFS);

export function LiquidGlassView(props) {
  const {
    stage, background, x = 0, y = 0, width, height,
    renderer, className, style, children, ...rest
  } = props;

  const hostRef = useRef(null);
  const glassRef = useRef(null);
  const contentRef = useRef(null);
  const [, forceRender] = useState(0);

  // Create / destroy the instance.
  useIso(() => {
    const host = hostRef.current;
    if (!host) return;
    const stageEl = (stage && (stage.current || stage)) || host.parentElement || document.body;

    const params = {};
    for (const k of PARAM_KEYS) if (rest[k] !== undefined) params[k] = rest[k];

    const glass = new LiquidGlass({
      stage: stageEl, x, y, width, height, renderer, className, ...params,
    });
    glassRef.current = glass;

    // Mount a React-controlled content node inside the glass surface.
    const contentHost = document.createElement('div');
    contentHost.style.width = '100%';
    contentHost.style.height = '100%';
    glass.content.appendChild(contentHost);
    contentRef.current = contentHost;

    host.appendChild(glass.element);
    if (background) glass.setBackground(background);
    forceRender((n) => n + 1); // publish the portal target

    return () => { glass.destroy(); glassRef.current = null; };
    // Intentionally create once; live updates handled in effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live parameter updates.
  useEffect(() => {
    const glass = glassRef.current;
    if (!glass) return;
    const patch = {};
    for (const k of PARAM_KEYS) if (rest[k] !== undefined) patch[k] = rest[k];
    glass.set(patch);
  }, PARAM_KEYS.map((k) => rest[k])); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { glassRef.current?.setPosition(x, y); }, [x, y]);
  useEffect(() => { if (background) glassRef.current?.setBackground(background); }, [background]);

  // Render children into the glass content layer via a portal.
  const portal = contentRef.current
    ? createPortal(children, contentRef.current)
    : null;

  return React.createElement(
    'div',
    { ref: hostRef, className, style: { display: 'contents', ...style } },
    portal
  );
}

export default LiquidGlassView;
