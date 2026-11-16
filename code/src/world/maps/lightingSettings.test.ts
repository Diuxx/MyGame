import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ENVIRONMENT } from "./environmentSettings.ts";
import { defaultLighting, defaultMapLight, parseLightingSettings } from "./lightingSettings.ts";

test("legacy maps inherit environment lights without sharing mutable defaults", () => {
  const first = parseLightingSettings(undefined, DEFAULT_ENVIRONMENT);
  assert.deepEqual(first, defaultLighting(DEFAULT_ENVIRONMENT));
  first.world.sun.intensity = 0;
  first.map.lights.push(defaultMapLight("torch-1"));
  const second = parseLightingSettings(undefined, DEFAULT_ENVIRONMENT);
  assert.equal(second.world.sun.intensity, DEFAULT_ENVIRONMENT.sun.intensity);
  assert.equal(second.map.lights.length, 0);
});

test("world lighting can be disabled independently of local lighting", () => {
  const light = defaultMapLight("torch-1");
  const parsed = parseLightingSettings({
    world: { enabled: false },
    map: { enabled: true, lights: [light] },
  }, DEFAULT_ENVIRONMENT);
  assert.equal(parsed.world.enabled, false);
  assert.equal(parsed.world.ambient.color, DEFAULT_ENVIRONMENT.ambient.color);
  assert.equal(parsed.map.enabled, true);
  assert.deepEqual(parsed.map.lights[0].position, [0, 2.5, 0]);
  assert.equal(parsed.map.lights[0].shadows.enabled, false);
});

test("individual world lights and map lighting can be switched off", () => {
  const parsed = parseLightingSettings({
    world: {
      ambient: { enabled: false, groundColor: "#554433" },
      sun: { enabled: false, shadows: { resolution: 2048 } },
    },
    map: { enabled: false, lights: [] },
  }, DEFAULT_ENVIRONMENT);
  assert.equal(parsed.world.sun.shadows.resolution, 2048);
  assert.equal(parsed.world.sun.enabled, false);
  assert.equal(parsed.world.ambient.groundColor, "#554433");
  assert.equal(parsed.map.enabled, false);
});

test("invalid ids, duplicate lights, bad colors and shadow settings fail validation", () => {
  const light = defaultMapLight("same");
  const build = (lights: unknown[]) => ({
    map: { enabled: true, lights },
  });
  assert.throws(() => parseLightingSettings(build([light, light]), DEFAULT_ENVIRONMENT), /dupliqués/);
  assert.throws(() => parseLightingSettings(build([{ ...light, id: "../bad" }]), DEFAULT_ENVIRONMENT), /id/);
  assert.throws(() => parseLightingSettings(build([{ ...light, color: "red" }]), DEFAULT_ENVIRONMENT), /couleur/);
  assert.throws(() => parseLightingSettings(build([{ ...light, intensity: Infinity }]), DEFAULT_ENVIRONMENT), /intensity/);
  assert.throws(() => parseLightingSettings(build([{ ...light, direction: [0, 0, 0] }]), DEFAULT_ENVIRONMENT), /direction/);
  assert.throws(() => parseLightingSettings(build([{
    ...light, type: "hemispheric", shadows: { ...light.shadows, enabled: true },
  }]), DEFAULT_ENVIRONMENT), /HemisphericLight/);
  assert.throws(() => parseLightingSettings({
    world: { sun: { shadows: { resolution: 1536 } } },
  }, DEFAULT_ENVIRONMENT), /resolution/);
});

test("local light types preserve their editable properties", () => {
  const light = {
    ...defaultMapLight("spot-1", "spot"),
    position: [2, 3, 4],
    direction: [0, -1, 1],
    angle: 35,
    exponent: 3,
    range: 12,
    shadows: { enabled: true, resolution: 512, darkness: 0.4 },
  };
  const result = parseLightingSettings({ map: { lights: [light] } }, DEFAULT_ENVIRONMENT);
  assert.equal(result.map.lights[0].type, "spot");
  assert.equal(result.map.lights[0].angle, 35);
  assert.equal(result.map.lights[0].shadows.enabled, true);
  assert.deepEqual(result.map.lights[0].direction, [0, -1, 1]);
});
