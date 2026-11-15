import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../../ANIMATIONS.json" with { type: "json" };
import {
  createAnimationSettings, createAttackHits, parseAnimationManifest, serializeAnimationManifest,
} from "./animationSettings.ts";
import { consumeImpactWindow } from "./movement.ts";

function copyManifest(): Record<string, unknown> {
  return structuredClone(manifest) as Record<string, unknown>;
}

function tuning(value: Record<string, unknown>, name: string): Record<string, unknown> {
  return (value.settings as Record<string, Record<string, unknown>>)[name];
}

test("manifest imports the published cancellation and blending defaults", () => {
  const imported = parseAnimationManifest(copyManifest());
  assert.equal(imported.settings.dodge.cancel?.runFrom, 0.9);
  assert.equal(imported.settings.attack.cancel?.dodgeFrom, 0.65);
  assert.equal(imported.settings.dodge.blendOutSeconds, 0.1);
});

test("legacy tuning without interruption windows migrates to JSON defaults", () => {
  const old = copyManifest();
  delete tuning(old, "dodge").cancel;
  delete tuning(old, "dodge").blendOutSeconds;
  const imported = parseAnimationManifest(old);
  assert.deepEqual(imported.settings.dodge.cancel, createAnimationSettings().dodge.cancel);
  assert.equal(imported.settings.dodge.blendOutSeconds, 0.1);
});

test("invalid imported windows and blending are rejected rather than silently clamped", () => {
  for (const [key, value] of [["runFrom", -0.1], ["runFrom", 1.1], ["runFrom", Number.NaN]] as const) {
    const source = copyManifest();
    (tuning(source, "dodge").cancel as Record<string, unknown>)[key] = value;
    assert.throws(() => parseAnimationManifest(source), /cancel\.runFrom/);
  }
  const source = copyManifest();
  tuning(source, "attack").blendOutSeconds = 5;
  assert.throws(() => parseAnimationManifest(source), /blendOutSeconds/);
});

test("manifest export preserves metadata and persists new action timing settings", () => {
  const settings = createAnimationSettings();
  settings.dodge.cancel!.runFrom = 0.75;
  const serialized = JSON.parse(serializeAnimationManifest(settings, { move: 0.17, idle: 0.15, slowDown: 0.12 }));
  assert.deepEqual(serialized.animations, manifest.animations);
  const imported = parseAnimationManifest(serialized);
  assert.equal(imported.settings.dodge.cancel?.runFrom, 0.75);
  assert.equal(imported.transitions.move, 0.17);
});

test("interrupted attacks never replay the same hit window", () => {
  const impact = createAnimationSettings().attack.impact!;
  const [hit] = createAttackHits(impact);
  assert.equal(consumeImpactWindow(hit, 0, 0.95), true);
  assert.equal(consumeImpactWindow(hit, 0.95, 1), false);
});
