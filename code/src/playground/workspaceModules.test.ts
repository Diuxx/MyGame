import assert from "node:assert/strict";
import test from "node:test";
import { WORKSPACE_AREAS, allWorkspaceModuleIds, modulesForArea } from "./workspaceModules.ts";

test("every existing Playground module belongs to exactly one workspace", () => {
  const ids = allWorkspaceModuleIds();
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [
    "actionsModule", "attackHitboxModule", "cameraModule", "collisionsModule",
    "controlsModule", "enemiesModule", "floatingTextModule", "mapsModule",
    "modelModule", "movementModule", "targetLockModule", "worldEditorModule",
  ].sort());
});

test("world editing and gameplay diagnostics remain available", () => {
  assert.deepEqual(WORKSPACE_AREAS.map((entry) => entry.id),
    ["world", "hero", "combat", "enemies", "effects", "debug"]);
  assert.equal(modulesForArea("world")[0].id, "worldEditorModule");
  assert.equal(modulesForArea("combat").length, 3);
  assert.deepEqual(modulesForArea("debug"), []);
});
