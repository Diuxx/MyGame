import test from 'node:test';
import assert from 'node:assert/strict';
import { floatingTextFrame } from './floatingTextAnimation.ts';
import { createFloatingTextConfig } from './floatingTextConfig.ts';

test('messages grow, rise and fade before independent expiry', () => {
  const style = createFloatingTextConfig().actions.styles.attack;
  const start = floatingTextFrame(0, style);
  const middle = floatingTextFrame(400, style);
  const end = floatingTextFrame(900, style);
  assert.equal(start.alpha, 0);
  assert.equal(start.expired, false);
  assert.ok(middle.alpha > 0 && middle.scale > start.scale);
  assert.ok(middle.risePixels > 0);
  assert.equal(end.alpha, 0);
  assert.equal(end.expired, true);
});
