import assert from "node:assert/strict";
import test from "node:test";
import { WORKSPACE_AREAS, allWorkspaceModuleIds, createWorkspaceNavigation, createWorkspacePanelState, modulesForArea, setWorkspaceEditingState } from "./workspaceModules.ts";

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

test("switching areas restores each area's last module", () => {
  const navigation = createWorkspaceNavigation();
  assert.equal(navigation.area, "world");
  assert.equal(navigation.module, "worldEditorModule");

  assert.equal(navigation.showModule("lightingModule"), true);
  assert.equal(navigation.changeArea("combat"), true);
  assert.equal(navigation.module, "targetLockModule");
  assert.equal(navigation.showModule("collisionsModule"), true);

  assert.equal(navigation.changeArea("world"), true);
  assert.equal(navigation.module, "lightingModule");
  assert.equal(navigation.changeArea("combat"), true);
  assert.equal(navigation.module, "collisionsModule");
});

test("reselecting the current area does not reset or reopen a module", () => {
  const navigation = createWorkspaceNavigation();
  navigation.showModule("cameraModule");

  assert.equal(navigation.changeArea("world"), false);
  assert.equal(navigation.module, "cameraModule");
  assert.equal(navigation.closeModule("cameraModule"), true);
  assert.equal(navigation.module, undefined);
  assert.equal(navigation.changeArea("world"), false);
  assert.equal(navigation.module, undefined);

  assert.equal(navigation.showModule("cameraModule"), true);
  assert.equal(navigation.module, "cameraModule");
  assert.equal(navigation.closeModule("cameraModule"), true);
  navigation.changeArea("hero");
  navigation.changeArea("world");
  assert.equal(navigation.module, "cameraModule");
});

test("closing stale modules does not affect navigation; Debug preserves other areas", () => {
  const navigation = createWorkspaceNavigation();
  navigation.showModule("mapsModule");
  assert.equal(navigation.closeModule("worldEditorModule"), false);
  assert.equal(navigation.module, "mapsModule");

  navigation.changeArea("debug");
  assert.equal(navigation.module, undefined);
  assert.equal(navigation.changeArea("debug"), false);
  assert.throws(() => navigation.showModule("cameraModule"), /n'appartient pas/);

  navigation.changeArea("world");
  assert.equal(navigation.module, "mapsModule");
  assert.throws(() => navigation.showModule("collisionsModule"), /n'appartient pas/);
});

test("changing gameplay mode does not reset navigation state", () => {
  const navigation = createWorkspaceNavigation();
  navigation.changeArea("combat");
  navigation.showModule("attackHitboxModule");
  const input = { checked: true, dispatchEvent: (_event: Event) => true };

  assert.equal(setWorkspaceEditingState(input, false), true);
  assert.equal(setWorkspaceEditingState(input, true), true);
  assert.equal(navigation.area, "combat");
  assert.equal(navigation.module, "attackHitboxModule");
});

test("global tools can be opened without hiding desktop selection properties", () => {
  const navigation = createWorkspaceNavigation();
  const panels = createWorkspacePanelState();

  navigation.changeArea("world");
  navigation.showModule("lightingModule");
  panels.setToolsOpen(true, false);

  assert.equal(panels.toolsOpen, true);
  assert.equal(panels.inspectorOpen(false), true);
  assert.equal(navigation.module, "lightingModule");

  panels.setToolsOpen(false, false);
  assert.equal(panels.inspectorOpen(false), true);
  assert.equal(navigation.module, "lightingModule");
  panels.setInspectorOpen(false, false);
  panels.setToolsOpen(true, false);
  assert.equal(panels.inspectorOpen(false), false);
  assert.equal(panels.toolsOpen, true);
});

test("mobile tools and inspector overlays cannot be open simultaneously", () => {
  const panels = createWorkspacePanelState();
  assert.equal(panels.inspectorOpen(true), false);

  panels.setToolsOpen(true, true);
  assert.equal(panels.toolsOpen, true);
  assert.equal(panels.inspectorOpen(true), false);

  panels.setInspectorOpen(true, true);
  assert.equal(panels.inspectorOpen(true), true);
  assert.equal(panels.toolsOpen, false);

  panels.setToolsOpen(true, true);
  assert.equal(panels.inspectorOpen(true), false);
  assert.equal(panels.inspectorOpen(false), true);
  panels.setToolsOpen(false, true);
  assert.equal(panels.inspectorOpen(true), false);
});

test("opening contextual properties does not change active tools or selection", () => {
  const navigation = createWorkspaceNavigation();
  const panels = createWorkspacePanelState();
  const selection = [{ kind: "prefab", id: "wall-01" }];

  navigation.changeArea("combat");
  navigation.showModule("collisionsModule");
  panels.setToolsOpen(true, false);
  panels.setInspectorOpen(true, false);

  assert.deepEqual(selection, [{ kind: "prefab", id: "wall-01" }]);
  assert.equal(navigation.area, "combat");
  assert.equal(navigation.module, "collisionsModule");
  assert.equal(panels.toolsOpen, true);
  assert.equal(panels.inspectorOpen(false), true);
});

test("edit/test mode switching keeps independent panel states untouched", () => {
  const panels = createWorkspacePanelState();
  panels.setToolsOpen(true, false);
  const input = { checked: true, dispatchEvent: (_event: Event) => true };

  setWorkspaceEditingState(input, false);
  setWorkspaceEditingState(input, true);
  assert.equal(panels.toolsOpen, true);
  assert.equal(panels.inspectorOpen(false), true);
});
