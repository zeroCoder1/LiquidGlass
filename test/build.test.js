// Build-integrity tests: the dist artifacts a consumer installs must exist, be
// non-empty, and parse. Run `npm run build` first (CI does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = (f) => join(root, 'dist', f);

const ARTIFACTS = [
  'liquid-glass.esm.js',
  'liquid-glass.cjs',
  'liquid-glass.global.js',
  'liquid-glass.global.min.js',
  'react.esm.js',
  'react.cjs',
  'liquid-glass.d.ts',
  'react.d.ts',
];

test('all published dist artifacts exist and are non-empty', () => {
  for (const f of ARTIFACTS) {
    assert.ok(existsSync(dist(f)), `missing dist/${f} — run npm run build`);
    assert.ok(statSync(dist(f)).size > 0, `empty dist/${f}`);
  }
});

test('JS bundles are syntactically valid', () => {
  for (const f of ARTIFACTS.filter((f) => /\.(js|cjs)$/.test(f))) {
    execFileSync(process.execPath, ['--check', dist(f)]);
  }
});

test('es2015 global build is transpiled (no optional chaining / nullish coalescing)', () => {
  const src = readFileSync(dist('liquid-glass.global.min.js'), 'utf8');
  assert.equal(src.includes('?.'), false, 'optional chaining leaked into es2015 build');
  assert.equal(src.includes('??'), false, 'nullish coalescing leaked into es2015 build');
});

test('the global build exposes LiquidGlass', () => {
  assert.match(readFileSync(dist('liquid-glass.global.js'), 'utf8'), /LiquidGlass\s*=/);
});
