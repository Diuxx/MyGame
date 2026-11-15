import test from 'node:test';
import assert from 'node:assert/strict';
import { createFloatingTextConfig } from './floatingTextConfig.ts';

test('floating text defaults are independent objects', () => {
  const first = createFloatingTextConfig();
  first.actions.labels.attack = 'SLASH';
  first.damage.normal.color = '#FF0000';
  const second = createFloatingTextConfig();
  assert.equal(second.actions.labels.attack, 'ATTACK');
  assert.equal(second.damage.normal.color, '#FFFFFF');
});

test('configuration validates saved numbers, colors, labels and caps', () => {
  const config = createFloatingTextConfig({
    enabled: false, actions: { style: { durationMs: -5, fontSize: Infinity }, labels: { attack: '' } },
    damage: { normal: { color: 'red', risePixels: 900 } },
    limits: { maxVisible: 9999, maxPerEntity: 0 },
  });
  assert.equal(config.enabled, false);
  assert.equal(config.actions.style.durationMs, 150);
  assert.equal(config.actions.style.fontSize, 18);
  assert.equal(config.actions.labels.attack, 'ATTACK');
  assert.equal(config.damage.normal.color, '#FFFFFF');
  assert.equal(config.damage.normal.risePixels, 160);
  assert.equal(config.limits.maxVisible, 150);
  assert.equal(config.limits.maxPerEntity, 1);
});
