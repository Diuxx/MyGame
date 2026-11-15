import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionTextStyle, createFloatingTextConfig,
  FLOATING_TEXT_PREFERENCE_KEY, FLOATING_TEXT_SETTINGS_KEY,
  loadFloatingTextConfig, loadPlaygroundFloatingTextConfig,
  parseFloatingTextManifest, serializeFloatingTextManifest,
} from './floatingTextConfig.ts';

test('versioned JSON provides quieter movement and a separate attack style', () => {
  const config = createFloatingTextConfig();
  assert.equal(config.version, 1);
  assert.equal(config.actions.styles.movement.fontSize, 11);
  assert.equal(config.actions.styles.movement.durationMs, 450);
  assert.equal(config.actions.styles.attack.fontSize, 11);
  assert.equal(config.actions.styles.attack.durationMs, 650);
  for (const id of ['walk', 'sprint', 'dodge'] as const) {
    assert.equal(actionTextStyle(config, id), config.actions.styles.movement);
  }
  assert.equal(actionTextStyle(config, 'attack'), config.actions.styles.attack);
});

test('the editable configuration does not mutate versioned JSON defaults', () => {
  const first = createFloatingTextConfig();
  first.actions.labels.attack = 'SLASH';
  first.actions.styles.movement.fontSize = 27;
  first.damage.normal.color = '#FF0000';
  const next = createFloatingTextConfig();
  assert.equal(next.actions.labels.attack, 'ATTACK');
  assert.equal(next.actions.styles.movement.fontSize, 11);
  assert.equal(next.damage.normal.color, '#FFFFFF');
});

test('temporary overrides are bounded and invalid values use JSON defaults', () => {
  const config = createFloatingTextConfig({
    enabled: false, actions: {
      styles: {
        movement: { durationMs: -5, fontSize: Infinity, color: 'wrong' },
        attack: { fontSize: 99, scaleEnd: 0 },
      },
      labels: { attack: '' },
    },
    damage: { normal: { color: 'red', risePixels: 900 } },
    limits: { maxVisible: 9999, maxPerEntity: 0 },
  });
  assert.equal(config.enabled, false);
  assert.equal(config.actions.styles.movement.durationMs, 150);
  assert.equal(config.actions.styles.movement.fontSize, 11);
  assert.equal(config.actions.styles.movement.color, '#D6DED7');
  assert.equal(config.actions.styles.attack.fontSize, 72);
  assert.equal(config.actions.styles.attack.scaleEnd, 1);
  assert.equal(config.actions.labels.attack, 'ATTACK');
  assert.equal(config.damage.normal.color, '#FFFFFF');
  assert.equal(config.damage.normal.risePixels, 160);
  assert.equal(config.limits.maxVisible, 150);
  assert.equal(config.limits.maxPerEntity, 1);
});

test('export returns a full manifest that can be imported without losing categories', () => {
  const config = createFloatingTextConfig();
  config.actions.styles.attack.fontSize = 19;
  config.actions.styles.movement.durationMs = 300;
  const serialized = serializeFloatingTextManifest(config);
  const parsed = parseFloatingTextManifest(JSON.parse(serialized));
  assert.ok(serialized.endsWith('\n'));
  assert.deepEqual(parsed, config);
  assert.throws(() => parseFloatingTextManifest({ ...parsed, version: 2 }), /version incompatible/);
  assert.throws(() => parseFloatingTextManifest({
    ...parsed, actions: { ...parsed.actions, styles: {
      ...parsed.actions.styles, movement: { ...parsed.actions.styles.movement, fontSize: -1 },
    } },
  }), /actions.styles.movement.fontSize/);
  assert.throws(() => parseFloatingTextManifest({
    ...parsed, actions: { ...parsed.actions, labels: { ...parsed.actions.labels, attack: '' } },
  }), /actions.labels.attack/);
});

test('gameplay ignores Playground overrides, but respects user visibility preference', () => {
  const stored = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
      removeItem: (key: string) => { stored.delete(key); },
    },
  });
  try {
    const overridden = createFloatingTextConfig();
    overridden.actions.styles.movement.fontSize = 28;
    stored.set(FLOATING_TEXT_SETTINGS_KEY, JSON.stringify(overridden));
    stored.set(FLOATING_TEXT_PREFERENCE_KEY, 'false');
    assert.equal(loadFloatingTextConfig().actions.styles.movement.fontSize, 11);
    assert.equal(loadFloatingTextConfig().enabled, false);
    assert.equal(loadPlaygroundFloatingTextConfig().actions.styles.movement.fontSize, 28);
    assert.equal(loadPlaygroundFloatingTextConfig().enabled, false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
