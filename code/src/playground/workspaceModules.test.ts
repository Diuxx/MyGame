import assert from "node:assert/strict";
import test from "node:test";
import { WORKSPACE_AREAS, allWorkspaceModuleIds, modulesForArea, setWorkspaceEditingState } from "./workspaceModules.ts";

test("every existing Playground module belongs to exactly one workspace", () => {
  const ids = allWorkspaceModuleIds();
  assert.equal(ids.length, 13);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [
    "actionsModule", "attackHitboxModule", "cameraModule", "collisionsModule",
    "controlsModule", "enemiesModule", "floatingTextModule", "lightingModule", "mapsModule",
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

test("workspace mode switch dispatches exactly one native editor change", () => {
  const changes: boolean[] = [];
  const input = {
    checked: false,
    dispatchEvent(event: Event) {
      assert.equal(event.type, "change");
      assert.equal(event.bubbles, true);
      changes.push(this.checked);
      return true;
    },
  };
  assert.equal(setWorkspaceEditingState(input, true), true);
  assert.equal(input.checked, true);
  assert.equal(setWorkspaceEditingState(input, true), false);
  assert.equal(setWorkspaceEditingState(input, false), true);
  assert.deepEqual(changes, [true, false]);
});
