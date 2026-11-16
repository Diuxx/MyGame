import {
  Color3, MeshBuilder, Plane, StandardMaterial, type AbstractMesh, type Scene, type TransformNode,
} from "@babylonjs/core";
import type { createMapSystem } from "../world/maps/mapSystem.ts";
import type { MapObject, MapPosition } from "../world/maps/types.ts";
import type { PrefabPlacement } from "../world/maps/prefabDefinitions.ts";
import { findTerrainCell } from "../world/maps/validation.ts";
import { fitWallToTerrain, isWallPrefab } from "../world/maps/wallPlacement.ts";
import type { TerrainVisual } from "../world/maps/zoneContent.ts";
import { createEditorCommands, groupEditorCommands, type EditorCommand } from "./editorCommands.ts";
import { copyPrefabs, pastePrefabs, type PrefabClipboard } from "./editorClipboard.ts";
import { resizeTerrain } from "./editorTerrain.ts";
import { createEditorDrafts } from "./editorDrafts.ts";
import { createEditorLayers, defaultLayerForObject, defaultLayerForPrefab } from "./editorLayers.ts";
import { gridSnap } from "./editorSnapping.ts";
import { prefabDimensions } from "./editorGeometry.ts";
import { createEditorGizmos, type EditorGizmoTool } from "./editorGizmos.ts";
import { requireElement } from "../ui/dom.ts";

type Active = NonNullable<ReturnType<typeof createMapSystem>["world"]>;
export type EditorSelectionRef = { kind: "prefab" | "object" | "enemy" | "interaction" | "practice"; id: string };

interface EditorContext {
  scene: Scene;
  canvas: HTMLCanvasElement;
  maps: ReturnType<typeof createMapSystem>;
  signal: AbortSignal;
  enabled(): boolean;
  selection(): readonly EditorSelectionRef[];
  select(kind: EditorSelectionRef["kind"], id: string): void;
  clearSelection(): void;
  updateSelection(): void;
  status: HTMLElement;
}

type Clipboard =
  | { kind: "prefab"; data: PrefabClipboard }
  | { kind: "object"; data: { items: readonly MapObject[]; origin: MapPosition } };

const EDITABLE_KINDS = new Set(["prefab", "object"]);
const isFormControl = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable ||
    !!target.closest("input, select, textarea, [contenteditable]"));

function cloneObjectClipboard(objects: readonly MapObject[]) {
  const items = structuredClone(objects);
  const origin: MapPosition = [
    items.reduce((sum, entry) => sum + entry.position[0], 0) / items.length,
    items.reduce((sum, entry) => sum + entry.position[1], 0) / items.length,
    items.reduce((sum, entry) => sum + entry.position[2], 0) / items.length,
  ];
  return { items, origin };
}

function uniqueId(base: string, used: ReadonlySet<string>): string {
  for (let index = 1; index <= 9999; index++) {
    const suffix = "-copy-" + index;
    const id = base.slice(0, 80 - suffix.length) + suffix;
    if (!used.has(id)) return id;
  }
  throw new Error("Plus aucun identifiant disponible.");
}

/** Editor additions are opt-in: every mutation goes through live map methods. */
export function bindWorldEditorV2(context: EditorContext) {
  const { maps, scene, canvas, signal, status } = context;
  const history = createEditorCommands();
  const gizmos = createEditorGizmos(scene);
  const layers = createEditorLayers();
  const storage = (() => {
    try { return window.localStorage; }
    catch {
      return {
        getItem: () => null,
        setItem: () => { throw new Error("Stockage local indisponible."); },
        removeItem: () => { throw new Error("Stockage local indisponible."); },
      };
    }
  })();
  const drafts = createEditorDrafts(storage);
  let current = maps.world;
  let originalFingerprint = current ? drafts.fingerprint(current.definition) : "";
  let saveTimer: number | undefined;
  let clipboard: Clipboard | undefined;
  let pendingPaste = false;
  let pasteGhosts: AbstractMesh[] = [];
  const previewMaterial = new StandardMaterial("editor-paste-preview", scene);
  previewMaterial.diffuseColor = Color3.FromHexString("#81C9CA");
  previewMaterial.alpha = 0.32;
  previewMaterial.wireframe = true;
  previewMaterial.disableLighting = true;

  const tool = requireElement<HTMLSelectElement>("worldEditorTool");
  const grid = requireElement<HTMLInputElement>("worldEditorSnap");
  const gridStep = requireElement<HTMLSelectElement>("worldEditorSnapStep");
  const rotationStep = requireElement<HTMLSelectElement>("worldEditorRotationSnap");
  const layerField = requireElement<HTMLSelectElement>("worldEditorObjectLayer");
  const layerList = requireElement<HTMLElement>("worldEditorLayerList");
  const sizeFields = ["worldEditorPrefabSizeX", "worldEditorPrefabSizeY", "worldEditorPrefabSizeZ"]
    .map((id) => requireElement<HTMLInputElement>(id));
  const draftState = requireElement<HTMLElement>("worldEditorDraftState");

  function active(): Active {
    if (!maps.world) throw new Error("Aucune map n'est chargée.");
    return maps.world;
  }

  function selectedEditable() {
    const items = context.selection();
    if (!items.length) throw new Error("Sélectionner un objet avant cette opération.");
    if (items.some(({ kind }) => !EDITABLE_KINDS.has(kind))) {
      throw new Error("Cette commande prend en charge les Prefabs et les décors de map.");
    }
    return items as readonly (EditorSelectionRef & { kind: "prefab" | "object" })[];
  }

  function currentEntry(kind: "prefab" | "object", id: string) {
    const world = active();
    return kind === "prefab"
      ? world.definition.prefabs?.find((item) => item.id === id)
      : world.definition.objects.find((item) => item.id === id);
  }

  function capture(): { ref: EditorSelectionRef & { kind: "prefab" | "object" }; data: PrefabPlacement | MapObject }[] {
    return selectedEditable().map((ref) => {
      const entry = currentEntry(ref.kind, ref.id);
      if (!entry) throw new Error("La sélection n'existe plus : " + ref.id);
      return { ref, data: structuredClone(entry) };
    });
  }

  function refreshControls(): void {
    requireElement<HTMLButtonElement>("worldEditorUndo").disabled = !history.canUndo || history.busy;
    requireElement<HTMLButtonElement>("worldEditorRedo").disabled = !history.canRedo || history.busy;
  }

  function noteChange(): void {
    if (current !== maps.world) return;
    draftState.textContent = "Modifications non exportées — brouillon local automatique.";
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      if (maps.world !== current || !current) return;
      try { drafts.save(current.definition, originalFingerprint); }
      catch (error) { status.textContent = "Brouillon non enregistré : " + String(error); }
    }, 750);
    refreshControls();
  }

  async function execute(command: EditorCommand): Promise<void> {
    await history.execute(command);
    noteChange();
  }

  async function undo(): Promise<void> {
    if (await history.undo()) {
      context.clearSelection();
      noteChange();
      syncTerrainFields();
    }
    refreshControls();
  }

  async function redo(): Promise<void> {
    if (await history.redo()) {
      context.clearSelection();
      noteChange();
      syncTerrainFields();
    }
    refreshControls();
  }

  function commandFor(ref: EditorSelectionRef & { kind: "prefab" | "object" },
                      data: PrefabPlacement | MapObject, remove: boolean, world: Active): EditorCommand {
    const insert = () => ref.kind === "prefab"
      ? world.editor.addPrefab(structuredClone(data) as PrefabPlacement)
      : world.editor.addObject(structuredClone(data) as MapObject);
    const erase = () => ref.kind === "prefab"
      ? world.editor.removePrefab(ref.id) : world.editor.removeObject(ref.id);
    return {
      label: remove ? "Supprimer " + ref.id : "Ajouter " + ref.id,
      run: remove ? erase : insert,
      undo: remove ? insert : erase,
    };
  }

  async function removeSelection(): Promise<void> {
    const world = active();
    const entries = capture();
    const commands = entries.map(({ ref, data }) => commandFor(ref, data, true, world));
    await execute(groupEditorCommands("Supprimer la sélection", commands));
    context.clearSelection();
  }

  function copy(): void {
    const world = active();
    const entries = capture();
    const kind = entries[0].ref.kind;
    if (entries.some((entry) => entry.ref.kind !== kind)) {
      throw new Error("Copie mixte : sélectionner uniquement des Prefabs ou des décors.");
    }
    if (kind === "prefab") {
      clipboard = { kind, data: copyPrefabs(entries.map(({ data }) => data as PrefabPlacement)) };
    } else {
      clipboard = { kind: "object", data: cloneObjectClipboard(entries.map(({ data }) => data as MapObject)) };
    }
    if (!world) throw new Error("Map inactive.");
    status.textContent = entries.length + " élément(s) copié(s).";
  }

  async function cut(): Promise<void> {
    copy();
    await removeSelection();
    status.textContent = "Sélection coupée. Ctrl+V pour coller.";
  }

  function clearGhosts(): void {
    for (const mesh of pasteGhosts) mesh.dispose();
    pasteGhosts = [];
  }

  function cancelPaste(): void {
    pendingPaste = false;
    clearGhosts();
    context.updateSelection();
  }

  function beginPaste(): void {
    if (!clipboard) throw new Error("Copier des éléments avant de coller.");
    pendingPaste = true;
    clearGhosts();
    const world = active();
    for (const [index, item] of clipboard.data.items.entries()) {
      const prefab = clipboard.kind === "prefab"
        ? world.assets.prefabs?.[(item as PrefabPlacement).prefab] : undefined;
      if (clipboard.kind === "prefab" && !prefab) {
        cancelPaste();
        throw new Error("Prefab absent de cette map.");
      }
      const size = prefab ? prefabDimensions(prefab) : [1, 1, 1] as MapPosition;
      const ghost = MeshBuilder.CreateBox("editor-copy-preview:" + index, {
        width: Math.max(0.2, size[0]),
        height: Math.max(0.2, size[1]),
        depth: Math.max(0.2, size[2]),
      }, scene);
      ghost.material = previewMaterial;
      ghost.isPickable = false;
      pasteGhosts.push(ghost);
    }
    status.textContent = "Positionner la copie avec la souris et cliquer pour valider. Échap pour annuler.";
  }

  function moveGhosts(position: MapPosition): void {
    if (!clipboard) return;
    clipboard.data.items.forEach((item, index) => {
      const offset = item.position.map((axis, i) => axis - clipboard!.data.origin[i]);
      let point = [position[0] + offset[0], position[1] + offset[1],
        position[2] + offset[2]] as MapPosition;
      if (clipboard?.kind === "prefab" && maps.world) {
        try {
          point = fitWallToTerrain(maps.world.definition, maps.world.assets.prefabs,
            { ...item as PrefabPlacement, position: point }).position;
        } catch {
          // The actual paste validates and reports an oversized wall explicitly.
        }
      }
      pasteGhosts[index]?.position.set(point[0], point[1] + 0.5, point[2]);
    });
  }

  async function pasteAt(position: MapPosition): Promise<void> {
    if (!clipboard) return;
    const world = active();
    const used = new Set(
      clipboard.kind === "prefab"
        ? (world.definition.prefabs ?? []).map(({ id }) => id)
        : world.definition.objects.map(({ id }) => id),
    );
    const items = clipboard.kind === "prefab"
      ? pastePrefabs(clipboard.data, position, used)
        .map((item) => fitWallToTerrain(world.definition, world.assets.prefabs, item))
      : clipboard.data.items.map((item) => {
        const id = uniqueId(item.id, used);
        used.add(id);
        return {
          ...structuredClone(item),
          id,
          position: position.map((axis, i) =>
            axis + item.position[i] - clipboard!.data.origin[i]) as unknown as MapPosition,
        };
      });
    if (items.some((entry) =>
      !findTerrainCell(world.definition, entry.position[0], entry.position[2]) ||
      (clipboard?.kind === "prefab" && !world.assets.prefabs?.[(entry as PrefabPlacement).prefab]) ||
      (clipboard?.kind === "object" && !world.assets.objects[(entry as MapObject).asset]))) {
      throw new Error("Collage hors du terrain : aucun objet créé.");
    }
    const kind = clipboard.kind;
    const commands = items.map((data) => commandFor({ kind, id: data.id }, data, false, world));
    await execute(groupEditorCommands("Coller des objets", commands));
    cancelPaste();
    context.select(kind, items[0].id);
    status.textContent = items.length + " élément(s) collé(s).";
  }

  function getSelectedLayer(ref: EditorSelectionRef): string | undefined {
    const world = maps.world;
    if (!world) return;
    if (ref.kind === "prefab") {
      const item = world.definition.prefabs?.find((entry) => entry.id === ref.id);
      return item ? defaultLayerForPrefab(item, world.assets.prefabs) : undefined;
    }
    if (ref.kind === "object") {
      const item = world.definition.objects.find((entry) => entry.id === ref.id);
      return item ? defaultLayerForObject(item) : undefined;
    }
    return "entities";
  }

  function isSelectable(ref: EditorSelectionRef): boolean {
    return layers.canSelect(getSelectedLayer(ref) ?? "entities");
  }

  function renderLayers(): void {
    layerList.replaceChildren();
    for (const layer of layers.all()) {
      const item = document.createElement("div");
      item.className = "enemy-fields";
      const name = document.createElement("strong");
      const world = maps.world;
      const count = (world?.definition.prefabs ?? []).filter((item) =>
        defaultLayerForPrefab(item, world?.assets.prefabs) === layer.id).length +
        (world?.definition.objects ?? []).filter((item) =>
          defaultLayerForObject(item) === layer.id).length;
      name.textContent = layer.id + " (" + count + ")";
      const visible = document.createElement("input");
      visible.type = "checkbox";
      visible.checked = layer.visible;
      visible.title = "Visibilité";
      const locked = document.createElement("input");
      locked.type = "checkbox";
      locked.checked = layer.locked;
      locked.title = "Verrouillage";
      visible.addEventListener("change", () => {
        layers.update(layer.id, { visible: visible.checked });
        if (maps.world) {
          maps.world.definition.editorLayerStates ??= {};
          maps.world.definition.editorLayerStates[layer.id] = {
            visible: visible.checked, locked: layers.all().find((item) => item.id === layer.id)!.locked,
          };
          noteChange();
        }
        maps.world?.editor.setPrefabLayerVisibility(layer.id, visible.checked);
        maps.world?.editor.setObjectLayerVisible(layer.id, visible.checked);
        if (!visible.checked) context.clearSelection();
      }, { signal });
      locked.addEventListener("change", () => {
        layers.update(layer.id, { locked: locked.checked });
        if (maps.world) {
          maps.world.definition.editorLayerStates ??= {};
          maps.world.definition.editorLayerStates[layer.id] = {
            visible: layers.all().find((item) => item.id === layer.id)!.visible,
            locked: locked.checked,
          };
          noteChange();
        }
        if (locked.checked) context.clearSelection();
      }, { signal });
      const vLabel = document.createElement("label");
      vLabel.append(visible, document.createTextNode(" Visible"));
      const lLabel = document.createElement("label");
      lLabel.append(locked, document.createTextNode(" Verrouillé"));
      item.append(name, vLabel, lLabel);
      layerList.append(item);
    }
    const existing = layerField.value;
    layerField.replaceChildren(...layers.all().map((item) => new Option(item.id, item.id)));
    if (layers.all().some(({ id }) => id === existing)) layerField.value = existing;
  }

  function syncSize(): void {
    const selection = context.selection();
    if (selection.length !== 1 || selection[0].kind !== "prefab") return;
    const world = maps.world;
    const item = world?.definition.prefabs?.find((entry) => entry.id === selection[0].id);
    const definition = item && world?.assets.prefabs?.[item.prefab];
    if (!item || !definition) return;
    const size = prefabDimensions(definition);
    sizeFields.forEach((field, i) => {
      field.value = String(Number((size[i] * item.scale * (item.scaleAxes?.[i] ?? 1)).toFixed(3)));
    });
    const layer = getSelectedLayer(selection[0]);
    if (layer) layerField.value = layer;
  }

  function moveCommand(ref: EditorSelectionRef, from: MapPosition, to: MapPosition, world: Active): EditorCommand {
    const move = (point: MapPosition) => {
      if (ref.kind === "practice") throw new Error("La cible temporaire n'est pas annulable.");
      world.editor.move(ref.kind, ref.id, point);
    };
    return { label: "Déplacer " + ref.id, run: () => move(to), undo: () => move(from) };
  }

  function recordMove(before: readonly { ref: EditorSelectionRef; position: MapPosition }[]): void {
    const world = maps.world;
    if (!world || world !== current || !before.length) return;
    const commands = before.flatMap(({ ref, position }) => {
      const actual = ref.kind === "prefab"
        ? world.definition.prefabs?.find((item) => item.id === ref.id)?.position
        : ref.kind === "object"
          ? world.definition.objects.find((item) => item.id === ref.id)?.position
          : ref.kind === "enemy"
            ? world.simulation.list().find((item) => item.spec.id === ref.id)?.spec.position
            : undefined;
      if (!actual || actual.every((n, i) => n === position[i])) return [];
      return [moveCommand(ref, position, [...actual], world)];
    });
    if (commands.length) {
      history.recordApplied(groupEditorCommands("Déplacer la sélection", commands));
      noteChange();
    }
  }

  const heightStep = requireElement<HTMLSelectElement>("worldEditorHeightStep");
  function refreshHeightTooltips(): void {
    const amount = heightStep.selectedOptions[0]?.textContent ?? heightStep.value;
    const label = heightStep.closest<HTMLLabelElement>(".world-editor-height-label");
    if (label) label.title = "Palier Y : " + amount + " unité(s)";
    heightStep.title = "Choisir le palier Y : " + amount + " unité(s)";
    requireElement<HTMLButtonElement>("worldEditorDown").title =
      "Descendre de " + amount + " unité(s) (PageDown)";
    requireElement<HTMLButtonElement>("worldEditorUp").title =
      "Monter de " + amount + " unité(s) (PageUp)";
  }
  heightStep.addEventListener("change", refreshHeightTooltips, { signal });
  refreshHeightTooltips();

  async function moveHeight(direction: number): Promise<void> {
    const world = active();
    const step = Number(requireElement<HTMLSelectElement>("worldEditorHeightStep").value);
    const entries = capture();
    const commands = entries.map(({ ref, data }) => {
      const from = [...data.position] as MapPosition;
      const to = [from[0], from[1] + direction * step, from[2]] as MapPosition;
      if (to[1] < -10 || to[1] > 50) throw new Error("Hauteur hors des limites.");
      return moveCommand(ref, from, to, world);
    });
    await execute(groupEditorCommands("Changer de palier", commands));
    context.updateSelection();
  }

  function syncTerrainFields(): void {
    const terrain = maps.world?.definition.terrain;
    requireElement<HTMLInputElement>("worldEditorTerrainWidth").value = terrain
      ? String(terrain.tiles[0].length * maps.world!.definition.tileSize) : "";
    requireElement<HTMLInputElement>("worldEditorTerrainDepth").value = terrain
      ? String(terrain.tiles.length * maps.world!.definition.tileSize) : "";
    requireElement<HTMLSelectElement>("worldEditorGroundStyle").value = terrain?.visual?.style ?? "flat";
    requireElement<HTMLInputElement>("worldEditorPlatformThickness").value =
      String(terrain?.visual?.thickness ?? 1.2);
    requireElement<HTMLInputElement>("worldEditorPlatformSideColor").value =
      terrain?.visual?.sideColor ?? "#d8d8d8";
  }

  async function resizeMap(): Promise<void> {
    const world = active();
    const size = {
      width: Number(requireElement<HTMLInputElement>("worldEditorTerrainWidth").value),
      depth: Number(requireElement<HTMLInputElement>("worldEditorTerrainDepth").value),
    };
    const anchor = requireElement<HTMLSelectElement>("worldEditorTerrainAnchor").value;
    if (anchor !== "center" && anchor !== "origin") throw new Error("Ancrage invalide.");
    const next = resizeTerrain(world.definition, size, anchor, world.assets.prefabs);
    const previous = structuredClone(world.definition.terrain);
    await execute({
      label: "Redimensionner le terrain",
      run: () => world.editor.resizeTerrain(next),
      undo: () => world.editor.resizeTerrain({ origin: previous.origin, tiles: previous.tiles }),
    });
    syncTerrainFields();
    status.textContent = "Dimensions du terrain actualisées.";
  }

  async function changeGroundStyle(): Promise<void> {
    const world = active();
    const style = requireElement<HTMLSelectElement>("worldEditorGroundStyle").value;
    const thickness = requireElement<HTMLInputElement>("worldEditorPlatformThickness").valueAsNumber;
    const sideColor = requireElement<HTMLInputElement>("worldEditorPlatformSideColor").value;
    if (style !== "flat" && style !== "platform") throw new Error("Style de terrain inconnu.");
    const previous = world.definition.terrain.visual
      ? structuredClone(world.definition.terrain.visual) : undefined;
    const next: TerrainVisual = style === "platform"
      ? { style, thickness, sideColor }
      : { style: "flat" };
    if (JSON.stringify(previous ?? { style: "flat" }) === JSON.stringify(next)) return;
    await execute({
      label: "Changer l'apparence du terrain",
      run: () => world.editor.setTerrainVisual(next),
      undo: () => world.editor.setTerrainVisual(previous),
    });
    syncTerrainFields();
  }

  async function resizePrefab(): Promise<void> {
    const ref = context.selection()[0];
    if (!ref || ref.kind !== "prefab" || context.selection().length !== 1) return;
    const world = active();
    const item = world.definition.prefabs?.find((entry) => entry.id === ref.id);
    const definition = item && world.assets.prefabs?.[item.prefab];
    if (!item || !definition) return;
    const dimensions = prefabDimensions(definition);
    const desired = sizeFields.map((field) => field.valueAsNumber);
    const axes = desired.map((size, i) => size / (dimensions[i] * item.scale)) as unknown as MapPosition;
    const previous: MapPosition = item.scaleAxes ? [...item.scaleAxes] : [1, 1, 1];
    await execute({
      label: "Redimensionner le prefab",
      run: () => world.editor.setPrefabScaleAxes(item.id, axes),
      undo: () => world.editor.setPrefabScaleAxes(item.id, previous),
    });
    syncSize();
  }

  async function changeLayer(): Promise<void> {
    const refs = selectedEditable();
    const world = active();
    const next = layerField.value;
    layers.ensure(next);
    const commands = refs.map((ref): EditorCommand => {
      const from = getSelectedLayer(ref) ?? "decoration";
      const update = (layer: string) => {
        if (ref.kind === "prefab") world.editor.setPrefabLayer(ref.id, layer);
        else world.editor.setObjectLayer(ref.id, layer);
        // Moving a block to an already-hidden layer must update the rendered view.
        for (const state of layers.all()) {
          world.editor.setPrefabLayerVisibility(state.id, state.visible);
          world.editor.setObjectLayerVisible(state.id, state.visible);
        }
      };
      return { label: "Changer de layer", run: () => update(next), undo: () => update(from) };
    });
    await execute(groupEditorCommands("Changer les layers", commands));
  }

  const toolModes = new Set<EditorGizmoTool>(["select", "move", "rotate", "scale"]);
  const gizmoBase = { position: [0, 0, 0] as MapPosition, rotation: 0, axes: [1, 1, 1] as MapPosition };
  let gizmoNode: TransformNode | undefined;
  let gizmoRef: EditorSelectionRef | undefined;
  function syncGizmo(): void {
    const ref = context.selection().length === 1 ? context.selection()[0] : undefined;
    const world = maps.world;
    const node = ref?.kind === "prefab" ? world?.editor.getPrefabRoot(ref.id)
      : ref?.kind === "object" ? world?.editor.getObjectRoot(ref.id) : undefined;
    gizmoNode = node;
    gizmoRef = node ? ref : undefined;
    gizmos.attach(context.enabled() ? node : undefined);
    if (node) {
      gizmoBase.position = [node.position.x, node.position.y, node.position.z];
      gizmoBase.rotation = node.rotation.y;
      gizmoBase.axes = [node.scaling.x, node.scaling.y, node.scaling.z];
    }
  }

  function finishGizmoDrag(): void {
    if (!context.enabled() || !gizmoNode || !gizmoRef || gizmos.tool === "select") return;
    const world = maps.world;
    if (!world || world !== current) return;
    const ref = gizmoRef;
    let currentPosition: MapPosition = [
      gizmoNode.position.x, gizmoNode.position.y, gizmoNode.position.z,
    ];
    const rotated = gizmoNode.rotation.y * 180 / Math.PI;
    const scaled: MapPosition = [gizmoNode.scaling.x, gizmoNode.scaling.y, gizmoNode.scaling.z];
    const before = structuredClone(gizmoBase);
    if (ref.kind === "prefab") {
      const placement = world.definition.prefabs?.find((item) => item.id === ref.id);
      if (placement && isWallPrefab(placement.prefab)) {
        try {
          const axes: MapPosition = scaled.map((value) => value / placement.scale) as unknown as MapPosition;
          currentPosition = fitWallToTerrain(world.definition, world.assets.prefabs, {
            ...placement, position: currentPosition, rotationY: rotated, scaleAxes: axes,
          }).position;
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : String(error);
          gizmoNode.position.set(...before.position);
          gizmoNode.rotation.y = before.rotation;
          gizmoNode.scaling.set(...before.axes);
          return;
        }
      }
    }
    const positionChanged = currentPosition.some((v, i) => v !== before.position[i]);
    const rotationChanged = Math.abs(rotated - before.rotation * 180 / Math.PI) > 0.0001;
    const scaleChanged = scaled.some((v, i) => Math.abs(v - before.axes[i]) > 0.0001);
    if (!positionChanged && !rotationChanged && !scaleChanged) return;
    if (!findTerrainCell(world.definition, currentPosition[0], currentPosition[2])) {
      status.textContent = "Gizmo : déplacement hors du terrain annulé.";
      gizmoNode.position.set(...gizmoBase.position);
      return;
    }
    // Restore the node before applying the map command so collision and JSON follow
    // the exact same canonical transformation path.
    gizmoNode.position.set(...before.position);
    gizmoNode.rotation.y = before.rotation;
    gizmoNode.scaling.set(...before.axes);
    const commands: EditorCommand[] = [];
    if (positionChanged) commands.push(moveCommand(ref, before.position, currentPosition, world));
    if (rotationChanged && ref.kind !== "practice" && ref.kind !== "interaction") {
      commands.push({
        label: "Rotation gizmo",
        run: () => world.editor.rotate(ref.kind as "object" | "prefab" | "enemy", ref.id, rotated),
        undo: () => world.editor.rotate(ref.kind as "object" | "prefab" | "enemy", ref.id, before.rotation * 180 / Math.PI),
      });
    }
    if (scaleChanged && ref.kind === "prefab") {
      const item = world.definition.prefabs?.find((p) => p.id === ref.id);
      if (item) {
        const beforeAxes: MapPosition = [
          before.axes[0] / item.scale, before.axes[1] / item.scale, before.axes[2] / item.scale,
        ];
        const afterAxes: MapPosition = [
          scaled[0] / item.scale, scaled[1] / item.scale, scaled[2] / item.scale,
        ];
        commands.push({
          label: "Échelle gizmo",
          run: () => world.editor.setPrefabScaleAxes(ref.id, afterAxes),
          undo: () => world.editor.setPrefabScaleAxes(ref.id, beforeAxes),
        });
      }
    }
    if (commands.length) {
      void execute(groupEditorCommands("Manipuler avec gizmo", commands)).then(() => {
        context.updateSelection();
        syncGizmo();
      }).catch((error) => { status.textContent = String(error); syncGizmo(); });
    }
  }

  function report(promise: Promise<unknown>): void {
    void promise.catch((error) => { status.textContent = error instanceof Error ? error.message : String(error); });
  }

  for (const [id, action] of [
    ["worldEditorUndo", undo], ["worldEditorRedo", redo], ["worldEditorCut", cut],
    ["worldEditorDelete", removeSelection],
    ["worldEditorUp", () => moveHeight(1)], ["worldEditorDown", () => moveHeight(-1)],
    ["worldEditorResizeTerrain", resizeMap],
  ] as const) {
    requireElement<HTMLButtonElement>(id).addEventListener("click", () => report(action()), { signal });
  }
  for (const id of ["worldEditorGroundStyle", "worldEditorPlatformThickness",
    "worldEditorPlatformSideColor"]) {
    requireElement<HTMLElement>(id).addEventListener("change", () => report(changeGroundStyle()), { signal });
  }
  requireElement("worldEditorCopy").addEventListener("click", () => {
    try { copy(); } catch (error) { status.textContent = String(error); }
  }, { signal });
  requireElement("worldEditorPaste").addEventListener("click", () => {
    try { beginPaste(); } catch (error) { status.textContent = String(error); }
  }, { signal });
  for (const field of sizeFields) {
    field.addEventListener("change", () => report(resizePrefab()), { signal });
  }
  layerField.addEventListener("change", () => report(changeLayer()), { signal });
  requireElement("worldEditorAddLayer").addEventListener("click", () => {
    try {
      const value = requireElement<HTMLInputElement>("worldEditorNewLayer").value.trim();
      layers.ensure(value);
      const world = maps.world;
      if (world) {
        world.definition.editorLayers ??= [];
        if (!world.definition.editorLayers.includes(value)) world.definition.editorLayers.push(value);
        noteChange();
      }
      renderLayers();
    } catch (error) { status.textContent = String(error); }
  }, { signal });
  tool.addEventListener("change", () => {
    const mode = tool.value as EditorGizmoTool;
    if (!toolModes.has(mode)) return;
    gizmos.setTool(mode);
    syncGizmo();
  }, { signal });
  window.addEventListener("pointerup", finishGizmoDrag, { signal });

  // Paste positioning is delegated to the existing editor ray/plane picking.
  canvas.addEventListener("pointermove", (event) => {
    if (!pendingPaste || !context.enabled()) return;
    const world = maps.world;
    if (!world) return;
    const bounds = canvas.getBoundingClientRect();
    const ray = scene.createPickingRay(event.clientX - bounds.left, event.clientY - bounds.top,
      null, scene.activeCamera);
    const y = world.definition.terrain.origin[1];
    const distance = ray.intersectsPlane(new Plane(0, 1, 0, -y));
    if (distance === null || distance < 0) return;
    const x = ray.origin.x + ray.direction.x * distance;
    const z = ray.origin.z + ray.direction.z * distance;
    const point: MapPosition = [
      grid.checked ? gridSnap(x, Number(gridStep.value)) : x, y,
      grid.checked ? gridSnap(z, Number(gridStep.value)) : z,
    ];
    moveGhosts(point);
  }, { signal });

  window.addEventListener("keydown", (event) => {
    if (!context.enabled() || isFormControl(event.target) || event.altKey) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && ["c", "v", "x", "z", "y", "d"].includes(key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (key === "c") { try { copy(); } catch (error) { status.textContent = String(error); } }
      else if (key === "v") { try { beginPaste(); } catch (error) { status.textContent = String(error); } }
      else if (key === "x") report(cut());
      else if (key === "z" && event.shiftKey || key === "y") report(redo());
      else if (key === "z") report(undo());
      else if (key === "d") {
        try {
          copy();
          const selection = capture();
          const point: MapPosition = [
            selection[0].data.position[0] + 1.5, selection[0].data.position[1],
            selection[0].data.position[2] + 1.5,
          ];
          report(pasteAt(point));
        } catch (error) { status.textContent = String(error); }
      }
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopImmediatePropagation();
      report(removeSelection());
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      event.stopImmediatePropagation();
      report(moveHeight(event.key === "PageUp" ? 1 : -1));
    } else if (event.key === "Escape") {
      cancelPaste();
    } else if (["g", "r", "s"].includes(key) && !mod) {
      tool.value = key === "g" ? "move" : key === "r" ? "rotate" : "scale";
      tool.dispatchEvent(new Event("change"));
    }
  }, { capture: true, signal });

  const original = (id: string) => requireElement<HTMLInputElement>(id);
  const saveDraft = () => {
    const world = active();
    drafts.save(world.definition, originalFingerprint);
    draftState.textContent = "Brouillon local enregistré.";
  };
  original("worldEditorSaveDraft").addEventListener("click", () => {
    try { saveDraft(); } catch (error) { status.textContent = String(error); }
  }, { signal });
  original("worldEditorRestoreDraft").addEventListener("click", () => {
    report((async () => {
      active();
      const source = originalMapSnapshot;
      if (!source) throw new Error("Aucune map source disponible.");
      const draft = drafts.read(source);
      if (!draft) throw new Error("Aucun brouillon disponible.");
      pendingRestoreSource = structuredClone(source);
      try {
        await maps.restoreMap(draft);
      } catch (error) {
        pendingRestoreSource = undefined;
        throw error;
      }
      // The world editor detects the new active session on its next render update.
      draftState.textContent = "Brouillon restauré. Exporter le JSON pour le conserver.";
    })());
  }, { signal });
  original("worldEditorRemoveDraft").addEventListener("click", () => {
    try { drafts.remove(active().definition.id); draftState.textContent = "Brouillon supprimé."; }
    catch (error) { status.textContent = String(error); }
  }, { signal });

  let originalMapSnapshot = current ? structuredClone(current.definition) : undefined;
  let pendingRestoreSource: typeof originalMapSnapshot;
  function onMapChanged(): void {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = undefined;
    cancelPaste();
    gizmos.detach();
    history.clear();
    current = maps.world;
    originalMapSnapshot = pendingRestoreSource ??
      (current ? structuredClone(current.definition) : undefined);
    pendingRestoreSource = undefined;
    originalFingerprint = originalMapSnapshot ? drafts.fingerprint(originalMapSnapshot) : "";
    layers.clearCustom();
    for (const id of current?.definition.editorLayers ?? []) layers.ensure(id);
    for (const [id, state] of Object.entries(current?.definition.editorLayerStates ?? {})) {
      layers.update(id, state);
      current?.editor.setPrefabLayerVisibility(id, state.visible);
      current?.editor.setObjectLayerVisible(id, state.visible);
    }
    for (const item of current?.definition.prefabs ?? []) {
      if (item.layer) layers.ensure(item.layer);
    }
    for (const item of current?.definition.objects ?? []) {
      if (item.layer) layers.ensure(item.layer);
    }
    syncTerrainFields();
    draftState.textContent = "Aucune modification locale.";
    renderLayers();
    refreshControls();
    syncSize();
  }

  onMapChanged();
  signal.addEventListener("abort", () => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    cancelPaste();
    gizmos.dispose();
    previewMaterial.dispose();
  }, { once: true });

  return {
    onMapChanged,
    onSelectionChanged() { syncSize(); syncGizmo(); },
    recordMove,
    get snapStep() { return grid.checked ? Number(gridStep.value) : 0; },
    get rotationSnap() { return Number(rotationStep.value); },
    isSelectable,
    get isPasting() { return pendingPaste; },
    get isPastingWall() {
      return pendingPaste && clipboard?.kind === "prefab" &&
        clipboard.data.items.every((item) => isWallPrefab(item.prefab));
    },
    async placePaste(position: MapPosition): Promise<void> { await pasteAt(position); },
    cancelPaste,
    onPlacement(kind: string, id: string | undefined): void {
      const world = maps.world;
      if (!world || !id || (kind !== "prefab" && kind !== "object")) return;
      const data = kind === "prefab"
        ? world.definition.prefabs?.find((item) => item.id === id)
        : world.definition.objects.find((item) => item.id === id);
      if (!data) return;
      const command = commandFor({ kind, id }, structuredClone(data), false, world);
      history.recordApplied(command);
      noteChange();
    },
    onDirectChange(): void { noteChange(); },
    recordTransform(command: EditorCommand): void {
      history.recordApplied(command);
      noteChange();
    },
    get tool(): EditorGizmoTool { return gizmos.tool; },
  };
}
