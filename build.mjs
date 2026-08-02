// Build the distributable bundles with esbuild.
//
//   npm run build
//
// Outputs to dist/:
//   liquid-glass.esm.js       ESM, for bundlers / modern browsers (import)
//   liquid-glass.cjs          CommonJS (require)
//   liquid-glass.global.js    IIFE, window.LiquidGlass, es2015 — <script> / TV
//   liquid-glass.global.min.js  minified IIFE for CDN and set-top boxes
//   react.esm.js / react.cjs  React wrapper (react/react-dom stay external)
//   *.d.ts                    hand-written type definitions
//
// The es2015 target on the global build is what makes it safe on older TV
// engines (webOS, Tizen, HTML5 TV) that lack optional chaining / nullish
// coalescing and ES-module support.

import { build } from 'esbuild';
import { rmSync, mkdirSync, copyFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const banner = { js: '/*! liquid-glass — MIT licensed. https://github.com/zeroCoder1/LiquidGlass */' };
const shared = { bundle: true, sourcemap: true, banner, logLevel: 'info' };

await Promise.all([
  // Core — modern consumers
  build({ ...shared, entryPoints: ['src/index.js'], outfile: 'dist/liquid-glass.esm.js', format: 'esm', target: 'es2019' }),
  build({ ...shared, entryPoints: ['src/index.js'], outfile: 'dist/liquid-glass.cjs', format: 'cjs', target: 'es2019' }),

  // Global build for plain <script> tags — transpiled down for old TV engines
  build({ ...shared, entryPoints: ['src/global.js'], outfile: 'dist/liquid-glass.global.js', format: 'iife', target: 'es2015' }),
  build({ ...shared, entryPoints: ['src/global.js'], outfile: 'dist/liquid-glass.global.min.js', format: 'iife', target: 'es2015', minify: true }),

  // React wrapper — react/react-dom provided by the host app
  build({ ...shared, entryPoints: ['src/react.js'], outfile: 'dist/react.esm.js', format: 'esm', target: 'es2019', external: ['react', 'react-dom'] }),
  build({ ...shared, entryPoints: ['src/react.js'], outfile: 'dist/react.cjs', format: 'cjs', target: 'es2019', external: ['react', 'react-dom'] }),
]);

copyFileSync('types/liquid-glass.d.ts', 'dist/liquid-glass.d.ts');
copyFileSync('types/react.d.ts', 'dist/react.d.ts');

console.log('\n✔ build complete → dist/');
