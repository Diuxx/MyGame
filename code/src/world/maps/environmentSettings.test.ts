import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ENVIRONMENT, parseEnvironmentSettings } from "./environmentSettings.ts";

test("missing environment is compatible with existing map JSON", () => {
  const parsed = parseEnvironmentSettings(undefined);
  assert.deepEqual(parsed, DEFAULT_ENVIRONMENT);
  parsed.ambient.intensity = 0.25;
  assert.equal(DEFAULT_ENVIRONMENT.ambient.intensity, 0.7);
});

test("invalid light direction, shadow resolution and fog density are rejected", () => {
  const data = structuredClone(DEFAULT_ENVIRONMENT);
  data.sun.direction = [0, 0, 0];
  assert.throws(() => parseEnvironmentSettings(data), /direction/);
  data.sun.direction = [-1, -1, 0];
  data.sun.shadows.resolution = 1024;
  assert.equal(parseEnvironmentSettings(data).sun.shadows.resolution, 1024);
  assert.throws(() => parseEnvironmentSettings({ ...data, background: "red" }), /couleur/);
  assert.throws(() => parseEnvironmentSettings({ ...data, fog: { ...data.fog, density: Infinity } }), /density/);
});
