import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { DEFAULT_ENVIRONMENT, parseEnvironmentSettings } from "./environmentSettings.ts";

test("missing environment is compatible with existing map JSON", () => {
  const parsed = parseEnvironmentSettings(undefined);
  assert.deepEqual(parsed, DEFAULT_ENVIRONMENT);
  assert.equal(parsed.fog.enabled, true);
  parsed.ambient.intensity = 0.25;
  assert.equal(DEFAULT_ENVIRONMENT.ambient.intensity, 0.7);
});

test("global fog is enabled in every map definition", () => {
  const mapsDirectory = new URL("../../../public/assets/maps/", import.meta.url);
  const maps = readdirSync(mapsDirectory).filter((file) => file.endsWith(".json"));
  assert.ok(maps.length > 0, "map definitions should exist");
  for (const file of maps) {
    const definition = JSON.parse(readFileSync(new URL(file, mapsDirectory), "utf8")) as {
      environment?: unknown;
    };
    assert.equal(parseEnvironmentSettings(definition.environment).fog.enabled, true, file);
  }
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
