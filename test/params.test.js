// Pure-logic tests for the parameter system — no DOM/WebGL needed, so they run
// anywhere (CI included). Rendering is verified in the browser demos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coerceParam, normalizeParams, DEFAULTS, PARAM_DEFS } from '../src/params.js';

test('coerceParam clamps numbers to their range', () => {
  assert.equal(coerceParam('refraction', 5), 2);      // max 2
  assert.equal(coerceParam('refraction', -1), 0);     // min 0
  assert.equal(coerceParam('blurAmount', 0.5), 0.5);  // within range
  assert.equal(coerceParam('saturation', -3), -1);    // min -1
});

test('coerceParam parses numeric strings', () => {
  assert.equal(coerceParam('refraction', '0.7'), 0.7);
});

test('coerceParam falls back to default on non-finite input', () => {
  assert.equal(coerceParam('refraction', 'nope'), PARAM_DEFS.refraction.default);
});

test('coerceParam coerces booleans', () => {
  assert.equal(coerceParam('button', 'true'), true);
  assert.equal(coerceParam('button', ''), true);
  assert.equal(coerceParam('button', 0), false);
});

test('coerceParam validates enums', () => {
  assert.equal(coerceParam('bevelMode', 1), 1);
  assert.equal(coerceParam('bevelMode', 9), PARAM_DEFS.bevelMode.default);
});

test('normalizeParams merges a patch onto defaults and clamps', () => {
  const p = normalizeParams({ refraction: 9, unknown: 1 });
  assert.equal(p.refraction, 2);                    // clamped
  assert.equal(p.blurAmount, DEFAULTS.blurAmount);  // default kept
  assert.equal('unknown' in p, false);              // unknown dropped
});

test('DEFAULTS matches every PARAM_DEFS default and is frozen', () => {
  for (const [k, def] of Object.entries(PARAM_DEFS)) {
    assert.equal(DEFAULTS[k], def.default, `default for ${k}`);
  }
  assert.equal(Object.isFrozen(DEFAULTS), true);
});
