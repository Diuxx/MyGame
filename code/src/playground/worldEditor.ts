import {
  Color3, MeshBuilder, Plane, StandardMaterial, type Scene,
} from "@babylonjs/core";
import type { MapCollider, MapPosition } from "../world/maps/types";
import type { createEnemyScene } from "../enemies/enemyScene";
import type { MapEditorKind, MapPlacementKind, VisualOverride } from "../world/maps/editorSchema";
import { findTerrainCell, tileCenter } from "../world/maps/validation";
import type { createMapSystem } from "../world/maps/mapSystem";
import { downloadJson, requireElement } from "../ui/dom";
import { bindWorldEditorV2, type EditorSelectionRef } from "./editorInteractionV2";
import { snapWallEndpoint } from "./editorSnapping";

type SelectionKind = MapEditorKind | "practice";
interface Selection { kind: SelectionKind; id: string; mapId: string }
interface Placement { kind: MapPlacementKind; id: string; label: string }

function numerical(id: string): number {
  const element = requireElement<HTMLInputElement>(id);
  const value = element.valueAsNumber;
  if (!Number.isFinite(value)) throw new Error("Nombre invalide : " + id);
  return value;
}
function setNumber(id: string, value: number): void {
  requireElement<HTMLInputElement>(id).value = String(Number(value.toFixed(3)));
}
/**
 * Explicit edit mode prevents combat actions while dragging. Every operation
 * mutates the same validated map data exported by the Playground.
 */
export function bindWorldEditor(
  scene: Scene, canvas: HTMLCanvasElement, maps: ReturnType<typeof createMapSystem>,
  practice: ReturnType<typeof createEnemyScene>,
  signal: AbortSignal,
  onEditingChange: (enabled: boolean) => void = () => {},
) {
  const enabled = requireElement<HTMLInputElement>("worldEditorEnabled");
  const quickToggle = requireElement<HTMLInputElement>("worldEditorQuickToggle");
  const panel = requireElement<HTMLElement>("worldEditorFields");
  const selectionLabel = requireElement<HTMLElement>("worldEditorSelection");
  const status = requireElement<HTMLElement>("worldEditorStatus");
  const objectSettings = requireElement<HTMLElement>("worldEditorObjectFields");
  const enemySettings = requireElement<HTMLElement>("worldEditorEnemyFields");
  const prefabSettings = requireElement<HTMLElement>("worldEditorPrefabFields");
  const duplicatePrefab = requireElement<HTMLButtonElement>("worldEditorDuplicatePrefab");
  const deletePrefab = requireElement<HTMLButtonElement>("worldEditorDeletePrefab");
  const rotationField = requireElement<HTMLElement>("worldEditorRotationField");
  const visualSettings = requireElement<HTMLElement>("worldEditorVisualFields");
  const snapToGrid = requireElement<HTMLInputElement>("worldEditorSnap");
  const catalog = requireElement<HTMLElement>("worldEditorCatalog");
  const cancelPlacement = requireElement<HTMLButtonElement>("worldEditorCancelPlacement");
  const modelFile = requireElement<HTMLInputElement>("worldEditorModelFile");
  const textureFile = requireElement<HTMLInputElement>("worldEditorTextureFile");
  const applyVisual = requireElement<HTMLButtonElement>("worldEditorApplyVisual");
  const exportButton = requireElement<HTMLButtonElement>("worldEditorExport");
  const marker = MeshBuilder.CreateTorus("world-editor-selection-ring", {
    diameter: 1.5, thickness: 0.06, tessellation: 32,
  }, scene);
  const markerMaterial = new StandardMaterial("world-editor-selection-color", scene);
  markerMaterial.emissiveColor = Color3.FromHexString("#FFE083");
  markerMaterial.disableLighting = true;
  marker.material = markerMaterial;
  marker.isPickable = false;
  marker.setEnabled(false);
  let selected: Selection | undefined;
  let selectedItems: Selection[] = [];
  let extraMarkers: ReturnType<typeof MeshBuilder.CreateTorus>[] = [];
  let v2: ReturnType<typeof bindWorldEditorV2> | undefined;
  let drag: { pointerId: number; offsetX: number; offsetZ: number;
    before: { ref: EditorSelectionRef; position: MapPosition }[] } | undefined;
  let currentMap = maps.world;
  let pendingPlacement: Placement | undefined;
  let placing = false;

  function syncPlacement(): void {
    canvas.classList.toggle("map-editor-placing", !!pendingPlacement);
    cancelPlacement.hidden = !pendingPlacement;
    catalog.querySelectorAll<HTMLButtonElement>("button[data-kind]").forEach((button) => {
      button.setAttribute("aria-pressed", String(
        button.dataset.kind === pendingPlacement?.kind && button.dataset.id === pendingPlacement?.id));
      button.disabled = placing;
    });
  }

  function buildCatalog(): void {
    const source = maps.world;
    if (!source) return;
    const groups = [
      { kind: "object", field: "worldEditorCatalogObjects", entries: Object.entries(source.assets.objects).map(([id, asset]) => ({ id, name: asset.name ?? id })) },
      { kind: "tile", field: "worldEditorCatalogTiles", entries: Object.entries(source.assets.tiles).map(([id, asset]) => ({ id, name: asset.name ?? id })) },
      { kind: "enemy", field: "worldEditorCatalogEnemies", entries: source.enemyCatalog },
      { kind: "prefab", field: "worldEditorCatalogPrefabs",
        entries: Object.entries(source.assets.prefabs ?? {}).map(([id, item]) =>
          ({ id, name: item.name })) },
    ] as const;
    for (const { kind, field, entries } of groups) {
      const buttons = entries.map(({ id, name }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = name;
        button.dataset.kind = kind;
        button.dataset.id = id;
        return button;
      });
      requireElement(field).replaceChildren(...buttons);
    }
    if (pendingPlacement && !groups.some(({ kind, entries }) => kind === pendingPlacement?.kind &&
        entries.some(({ id }) => id === pendingPlacement?.id))) pendingPlacement = undefined;
    syncPlacement();
  }

  function getSelected() {
    const active = maps.world;
    if (!active || active !== currentMap || !selected || selected.mapId !== active.definition.id) return undefined;
    if (selected.kind === "object") {
      const object = active.definition.objects.find((entry) => entry.id === selected?.id);
      return object ? { kind: "object" as const, object, active } : undefined;
    }
    if (selected.kind === "prefab") {
      const placement = active.definition.prefabs?.find((entry) => entry.id === selected?.id);
      return placement ? { kind: "prefab" as const, placement, active } : undefined;
    }
    if (selected.kind === "interaction") {
      const interaction = active.definition.interactions?.find((entry) => entry.id === selected?.id);
      return interaction ? { kind: "interaction" as const, interaction, active } : undefined;
    }
    if (selected.kind === "practice") {
      const enemy = practice.get(selected.id);
      return enemy ? { kind: "practice" as const, enemy, active } : undefined;
    }
    const actor = active.simulation.list().find((entry) => entry.spec.id === selected?.id);
    return actor ? { kind: "enemy" as const, actor, active } : undefined;
  }

  function clearSelection(): void {
    selected = undefined;
    selectedItems = [];
    for (const mesh of extraMarkers) mesh.dispose();
    extraMarkers = [];
    v2?.onSelectionChanged();
    stopDrag();
    panel.hidden = true;
    marker.setEnabled(false);
    selectionLabel.textContent = "Cliquer sur un décor, un objet interactif ou un ennemi pour le sélectionner.";
    modelFile.value = "";
    textureFile.value = "";
  }

  function position(): MapPosition | undefined {
    const target = getSelected();
    if (target?.kind === "object") return target.object.position;
    if (target?.kind === "prefab") return target.placement.position;
    if (target?.kind === "enemy") return target.actor.entity.position;
    if (target?.kind === "practice") return target.enemy.position;
    return target?.interaction.position;
  }

  function positionFor(ref: EditorSelectionRef): MapPosition | undefined {
    const active = maps.world;
    if (!active) return undefined;
    if (ref.kind === "prefab") return active.definition.prefabs?.find((item) => item.id === ref.id)?.position;
    if (ref.kind === "object") return active.definition.objects.find((item) => item.id === ref.id)?.position;
    if (ref.kind === "enemy") return active.simulation.list()
      .find((item) => item.spec.id === ref.id)?.spec.position;
    if (ref.kind === "practice") return practice.get(ref.id)?.position;
    return active.definition.interactions?.find((item) => item.id === ref.id)?.position;
  }
  function setMarker(): void {
    const point = position();
    marker.setEnabled(enabled.checked && !!point);
    if (point) marker.position.set(point[0], point[1] + 0.065, point[2]);
    for (const mesh of extraMarkers) mesh.dispose();
    extraMarkers = [];
    for (const ref of selectedItems) {
      if (ref.kind === selected?.kind && ref.id === selected.id) continue;
      const at = positionFor(ref);
      if (!at || !enabled.checked) continue;
      const extra = MeshBuilder.CreateTorus("world-editor-extra-ring", {
        diameter: 1.5, thickness: 0.05, tessellation: 24,
      }, scene);
      extra.position.set(at[0], at[1] + 0.065, at[2]);
      extra.material = markerMaterial;
      extra.isPickable = false;
      extraMarkers.push(extra);
    }
  }

  function select(kind: SelectionKind, id: string, additive = false, keepGroup = false): void {
    const map = maps.world;
    if (!map) return;
    const entry = { kind, id, mapId: map.definition.id };
    if (additive) {
      const index = selectedItems.findIndex((item) => item.kind === kind && item.id === id);
      if (index >= 0) selectedItems.splice(index, 1);
      else selectedItems.push(entry);
      if (!selectedItems.length) return clearSelection();
      selected = selectedItems.at(-1);
    } else {
      selected = entry;
      if (!keepGroup) selectedItems = [entry];
    }
    const target = getSelected();
    if (!target) return clearSelection();
    const spec = target.kind === "object" ? target.object :
      target.kind === "prefab" ? target.placement :
      target.kind === "enemy" ? target.actor.spec :
      target.kind === "practice" ? target.enemy : target.interaction;
    panel.hidden = false;
    selectionLabel.textContent = target.kind === "interaction" ? target.interaction.label :
      target.kind === "practice" ? target.enemy.definition.name :
      target.kind === "object" ? target.active.assets.objects[target.object.asset].name ?? id :
      target.kind === "prefab" ? target.active.assets.prefabs?.[target.placement.prefab]?.name ?? id :
      target.actor.entity.definition.name;
    setNumber("worldEditorX", spec.position[0]);
    setNumber("worldEditorY", spec.position[1]);
    setNumber("worldEditorZ", spec.position[2]);
    objectSettings.hidden = kind !== "object";
    enemySettings.hidden = kind !== "enemy";
    prefabSettings.hidden = kind !== "prefab";
    rotationField.hidden = target.kind === "interaction" || target.kind === "practice";
    visualSettings.hidden = target.kind === "interaction" || target.kind === "practice" ||
      target.kind === "prefab";
    setMarker();
    v2?.onSelectionChanged();
    if (target.kind === "interaction" || target.kind === "practice") return;
    const placement = target.kind === "object" ? target.object :
      target.kind === "prefab" ? target.placement : target.actor.spec;
    setNumber("worldEditorRotation", placement.rotationY);
    if (target.kind === "prefab") {
      setNumber("worldEditorPrefabScale", target.placement.scale);
      return;
    }
    const visual = target.kind === "object" ? target.object.visual : target.actor.spec.visual;
    setNumber("worldEditorScale", visual?.scale ?? 1);
    requireElement<HTMLInputElement>("worldEditorTint").value = visual?.tint ?? "#ffffff";
    if (target.kind === "object") {
      const shape = (target.object.colliders ?? target.active.assets.objects[target.object.asset].colliders)[0];
      setNumber("worldEditorColliderWidth", shape?.type === "box" ? shape.size[0] : (shape?.radius ?? 0.5) * 2);
      setNumber("worldEditorColliderHeight", shape?.type === "box" ? shape.size[1] : (shape?.height ?? 1));
      setNumber("worldEditorColliderDepth", shape?.type === "box" ? shape.size[2] : (shape?.radius ?? 0.5) * 2);
      requireElement<HTMLInputElement>("worldEditorColliderWidth").disabled = !shape;
      requireElement<HTMLInputElement>("worldEditorColliderHeight").disabled = !shape;
      requireElement<HTMLInputElement>("worldEditorColliderDepth").disabled = !shape;
    } else {
      const actor = target.actor;
      setNumber("worldEditorSpeed", actor.entity.stats.movementSpeed);
      setNumber("worldEditorAggro", actor.spec.ai.aggroRadius);
      setNumber("worldEditorAttackRange", actor.spec.ai.attackRange);
      setNumber("worldEditorLeash", actor.spec.ai.leashRadius);
      setNumber("worldEditorCollisionRadius", actor.entity.collision?.radius ??
        (actor.entity.definition.hurtbox.shape === "cylinder" ? actor.entity.definition.hurtbox.radius : 0.6));
      setNumber("worldEditorHurtboxRadius", actor.entity.definition.hurtbox.shape === "cylinder"
        ? actor.entity.definition.hurtbox.radius : 0.6);
    }
  }

  function report(error: unknown): void {
    status.textContent = error instanceof Error ? error.message : String(error);
  }

  function applyPlacement(): void {
    const target = getSelected();
    if (!target || !selected) return;
    const point: MapPosition = [
      numerical("worldEditorX"), numerical("worldEditorY"), numerical("worldEditorZ"),
    ];
    moveSelected(target, selected, point);
    if (target.kind === "object" || target.kind === "enemy" || target.kind === "prefab") {
      const raw = numerical("worldEditorRotation");
      const increment = v2?.rotationSnap ?? 0;
      const degrees = increment ? Math.round(raw / increment) * increment : raw;
      target.active.editor.rotate(target.kind, selected.id, degrees);
      setNumber("worldEditorRotation", degrees);
    }
    setMarker();
  }

  function moveSelected(target: NonNullable<ReturnType<typeof getSelected>>, selection: Selection, point: MapPosition): void {
    if (target.kind === "practice") practice.move(selection.id, point);
    else target.active.editor.move(target.kind, selection.id, point);
  }

  function applyParameters(): void {
    const target = getSelected();
    if (!target || target.kind === "interaction" || target.kind === "practice" || !selected) return;
    if (target.kind === "prefab") {
      target.active.editor.scalePrefab(selected.id, numerical("worldEditorPrefabScale"));
      return;
    }
    if (target.kind === "enemy") {
      target.active.editor.setEnemyParameters(selected.id, {
        movementSpeed: numerical("worldEditorSpeed"),
        collisionRadius: numerical("worldEditorCollisionRadius"),
        hurtboxRadius: numerical("worldEditorHurtboxRadius"),
        aggroRadius: numerical("worldEditorAggro"),
        attackRange: numerical("worldEditorAttackRange"),
        leashRadius: numerical("worldEditorLeash"),
      });
      return;
    }
    const shape = (target.object.colliders ??
      target.active.assets.objects[target.object.asset].colliders)[0];
    if (!shape) throw new Error("Cet objet n'a pas de collider physique à modifier.");
    const width = numerical("worldEditorColliderWidth");
    const height = numerical("worldEditorColliderHeight");
    const depth = numerical("worldEditorColliderDepth");
    if (![width, height, depth].every((value) => value > 0.001 && value <= 100)) {
      throw new Error("Toutes les dimensions doivent être positives et au maximum 100.");
    }
    const replacement: MapCollider = shape.type === "box"
      ? { type: "box", position: shape.position, size: [width, height, depth] }
      : { type: "cylinder", position: shape.position, radius: Math.max(width, depth) / 2, height };
    target.active.editor.setObjectCollider(selected.id, replacement);
  }

  function pickPosition(event: PointerEvent, y: number): { x: number; z: number } | undefined {
    const bounds = canvas.getBoundingClientRect();
    const ray = scene.createPickingRay(event.clientX - bounds.left, event.clientY - bounds.top,
      null, scene.activeCamera);
    const distance = ray.intersectsPlane(new Plane(0, 1, 0, -y));
    if (distance === null || distance < 0) return undefined;
    return {
      x: ray.origin.x + ray.direction.x * distance,
      z: ray.origin.z + ray.direction.z * distance,
    };
  }

  function stopDrag(): void {
    if (!drag) return;
    const { pointerId } = drag;
    drag = undefined;
    canvas.classList.remove("map-editor-dragging");
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  function placementPoint(event: PointerEvent): MapPosition | undefined {
    const map = maps.world?.definition;
    if (!map) return undefined;
    const y = map.terrain.origin[1];
    const point = pickPosition(event, y);
    if (!point) return undefined;
    const cell = findTerrainCell(map, point.x, point.z);
    if (!cell) return undefined;
    if (pendingPlacement?.kind === "tile") return tileCenter(map, cell.row, cell.column);
    const snapped: MapPosition = [snap(point.x), y, snap(point.z)];
    if (pendingPlacement?.kind === "prefab" && maps.world?.assets.prefabs) {
      const proposed = { id: "__preview__", prefab: pendingPlacement.id, position: snapped,
        rotationY: 0, scale: 1 };
      const anchor = snapWallEndpoint(snapped[0], snapped[2], proposed,
        map.prefabs ?? [], maps.world.assets.prefabs);
      if (anchor && findTerrainCell(map, anchor.x, anchor.z)) return [anchor.x, y, anchor.z];
    }
    return findTerrainCell(map, snapped[0], snapped[2]) ? snapped : [point.x, y, point.z];
  }

  function snap(value: number): number {
    const step = v2?.snapStep ?? (snapToGrid.checked ? 0.5 : 0);
    return step > 0 ? Math.round(value / step) * step : value;
  }

  function cancelPendingPlacement(): void {
    pendingPlacement = undefined;
    syncPlacement();
    setMarker();
  }

  enabled.addEventListener("change", () => {
    quickToggle.checked = enabled.checked;
    maps.setEditing(enabled.checked);
    onEditingChange(enabled.checked);
    canvas.classList.toggle("map-editor-active", enabled.checked);
    clearSelection();
    if (!enabled.checked) cancelPendingPlacement();
    status.textContent = enabled.checked
      ? "Flèches : déplacer la caméra. Clic gauche : déplacer un élément. Combat suspendu."
      : "Mode combat réactivé. Caméra recentrée sur le héros.";
  }, { signal });

  catalog.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-kind]");
    const kind = button?.dataset.kind;
    const id = button?.dataset.id;
    if (!button || !id || (kind !== "tile" && kind !== "object" && kind !== "enemy" &&
      kind !== "prefab") || placing) return;
    if (!enabled.checked) {
      enabled.checked = true;
      enabled.dispatchEvent(new Event("change"));
    }
    clearSelection();
    const label = button.textContent ?? id;
    pendingPlacement = { id, kind, label };
    syncPlacement();
    status.textContent = "Cliquer sur le terrain pour placer " + label + ".";
  }, { signal });
  cancelPlacement.addEventListener("click", () => {
    cancelPendingPlacement();
    status.textContent = "Placement annulé.";
  }, { signal });
  quickToggle.addEventListener("change", () => {
    enabled.checked = quickToggle.checked;
    enabled.dispatchEvent(new Event("change"));
  }, { signal });

  canvas.addEventListener("pointerdown", (event) => {
    const active = maps.world;
    if (!enabled.checked || event.button !== 0 || drag || !active || placing) return;
    if (v2?.isPasting) {
      const point = placementPoint(event);
      if (!point) return report("Cliquer dans le terrain.");
      void v2.placePaste(point).catch(report);
      return;
    }
    const placement = pendingPlacement;
    if (placement) {
      const point = placementPoint(event);
      if (!point) return report("Cliquer à l’intérieur du terrain.");
      placing = true;
      syncPlacement();
      void active.editor.place(placement.kind, placement.id, point).then((id) => {
        if (signal.aborted || maps.world !== active || pendingPlacement !== placement) return;
        cancelPendingPlacement();
        if (id && placement.kind !== "tile") {
          select(placement.kind, id);
          v2?.onPlacement(placement.kind, id);
        }
        status.textContent = placement.label + " · Placement terminé.";
      }).catch((error) => {
        if (!signal.aborted && maps.world === active && pendingPlacement === placement) report(error);
      }).finally(() => {
        placing = false;
        if (!signal.aborted) syncPlacement();
      });
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const hit = scene.pick(event.clientX - bounds.left, event.clientY - bounds.top,
      (mesh) => mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0 && !!mesh.metadata?.editorKind);
    const kind = hit?.pickedMesh?.metadata?.editorKind;
    const id = hit?.pickedMesh?.metadata?.editorId;
    if ((kind !== "object" && kind !== "enemy" && kind !== "interaction" &&
      kind !== "practice" && kind !== "prefab") || typeof id !== "string") {
      clearSelection();
      return;
    }
    if (v2 && !v2.isSelectable({ kind, id })) return report("Layer masqué ou verrouillé.");
    if (event.shiftKey) {
      select(kind, id, true);
      return;
    }
    const keepGroup = selectedItems.length > 1 && selectedItems.some((entry) =>
      entry.kind === kind && entry.id === id);
    select(kind, id, false, keepGroup);
    if (v2?.tool !== "select") return;
    const point = position();
    const location = point && pickPosition(event, point[1]);
    if (!point || !location) return;
    canvas.setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId, offsetX: point[0] - location.x, offsetZ: point[2] - location.z,
      before: selectedItems.flatMap((item) => {
        const current = positionFor(item);
        return current ? [{ ref: { kind: item.kind, id: item.id }, position: [...current] as MapPosition }] : [];
      }),
    };
    canvas.classList.add("map-editor-dragging");
  }, { signal });

  canvas.addEventListener("pointermove", (event) => {
    if (pendingPlacement) {
      const point = placementPoint(event);
      marker.setEnabled(!!point);
      if (point) marker.position.set(point[0], point[1] + 0.065, point[2]);
      return;
    }
    if (drag?.pointerId !== event.pointerId || !enabled.checked || !selected) return;
    const point = position();
    const target = getSelected();
    if (!point || !target) return clearSelection();
    const location = pickPosition(event, point[1]);
    if (!location) return;
    const next: MapPosition = [snap(location.x + drag.offsetX), point[1], snap(location.z + drag.offsetZ)];
    if (next[0] === point[0] && next[2] === point[2]) return;
    const activeSelection = selected;
    const primary = drag.before.find(({ ref }) => ref.kind === activeSelection.kind && ref.id === activeSelection.id);
    const dx = primary ? next[0] - primary.position[0] : next[0] - point[0];
    const dz = primary ? next[2] - primary.position[2] : next[2] - point[2];
    const destinations = drag.before.map(({ ref, position }) => ({
      ref, point: [snap(position[0] + dx), position[1], snap(position[2] + dz)] as MapPosition,
    }));
    if (destinations.some((item) => !findTerrainCell(target.active.definition,
      item.point[0], item.point[2]))) return;
    for (const item of destinations) {
      if (item.ref.kind === "practice") practice.move(item.ref.id, item.point);
      else target.active.editor.move(item.ref.kind, item.ref.id, item.point);
    }
    setNumber("worldEditorX", next[0]);
    setNumber("worldEditorZ", next[2]);
    setMarker();
  }, { signal });
  canvas.addEventListener("pointerleave", () => {
    if (pendingPlacement) marker.setEnabled(false);
  }, { signal });

  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    canvas.addEventListener(eventName, (event) => {
      if (drag?.pointerId === event.pointerId) {
          v2?.recordMove(drag.before);
          stopDrag();
        }
    }, { signal });
  }

  for (const id of ["worldEditorX", "worldEditorY", "worldEditorZ", "worldEditorRotation"]) {
    requireElement<HTMLInputElement>(id).addEventListener("change", () => {
      try {
        const selectedRef = selected ? { ...selected } : undefined;
        const target = getSelected();
        const oldPosition = target ? [...target.kind === "enemy" ? target.actor.spec.position
          : target.kind === "practice" ? target.enemy.position
          : target.kind === "object" ? target.object.position
          : target.kind === "prefab" ? target.placement.position
          : target.interaction.position] as MapPosition : undefined;
        const oldRotation = target?.kind === "object" ? target.object.rotationY
          : target?.kind === "prefab" ? target.placement.rotationY
          : target?.kind === "enemy" ? target.actor.spec.rotationY : undefined;
        applyPlacement();
        if (selectedRef && target && oldPosition && selectedRef.kind !== "practice") {
          const world = target.active;
          const newPosition: MapPosition = [
            numerical("worldEditorX"), numerical("worldEditorY"), numerical("worldEditorZ"),
          ];
          const newRotation = oldRotation === undefined ? undefined : numerical("worldEditorRotation");
          if (newPosition.some((value, i) => value !== oldPosition[i]) ||
              (newRotation !== undefined && newRotation !== oldRotation)) {
            v2?.recordTransform({
              label: "Modifier le placement",
              run: () => {
                world.editor.move(selectedRef.kind as "object" | "prefab" | "enemy" | "interaction", selectedRef.id, newPosition);
                if (newRotation !== undefined && (selectedRef.kind === "object" ||
                    selectedRef.kind === "prefab" || selectedRef.kind === "enemy")) {
                  world.editor.rotate(selectedRef.kind, selectedRef.id, newRotation);
                }
              },
              undo: () => {
                world.editor.move(selectedRef.kind as "object" | "prefab" | "enemy" | "interaction", selectedRef.id, oldPosition);
                if (oldRotation !== undefined && (selectedRef.kind === "object" ||
                    selectedRef.kind === "prefab" || selectedRef.kind === "enemy")) {
                  world.editor.rotate(selectedRef.kind, selectedRef.id, oldRotation);
                }
              },
            });
          }
        }
        status.textContent = "Placement mis à jour.";
      } catch (error) { report(error); }
    }, { signal });
  }
  requireElement<HTMLInputElement>("worldEditorPrefabScale").addEventListener("change", () => {
    try {
      const target = getSelected();
      const previous = target?.kind === "prefab" ? target.placement.scale : undefined;
      applyParameters();
      if (target?.kind === "prefab" && previous !== undefined && previous !== target.placement.scale) {
        const world = target.active;
        const id = target.placement.id;
        const next = target.placement.scale;
        v2?.recordTransform({
          label: "Échelle uniforme", run: () => world.editor.scalePrefab(id, next),
          undo: () => world.editor.scalePrefab(id, previous),
        });
      }
      status.textContent = "Échelle du prefab mise à jour.";
    } catch (error) { report(error); }
  }, { signal });
  duplicatePrefab.addEventListener("click", () => {
    const target = getSelected();
    if (!target || target.kind !== "prefab" || !selected) return;
    try {
      const id = target.active.editor.duplicatePrefab(selected.id);
      select("prefab", id);
      v2?.onPlacement("prefab", id);
      status.textContent = "Bloc dupliqué : " + id;
    } catch (error) { report(error); }
  }, { signal });
  deletePrefab.addEventListener("click", () => {
    const target = getSelected();
    if (!target || target.kind !== "prefab" || !selected) return;
    try {
      const snapshot = structuredClone(target.placement);
      const world = target.active;
      target.active.editor.removePrefab(selected.id);
      v2?.recordTransform({
        label: "Supprimer prefab",
        run: () => world.editor.removePrefab(snapshot.id),
        undo: () => world.editor.addPrefab(structuredClone(snapshot)),
      });
      clearSelection();
      status.textContent = "Bloc supprimé.";
    } catch (error) { report(error); }
  }, { signal });
  for (const id of ["worldEditorColliderWidth", "worldEditorColliderHeight", "worldEditorColliderDepth",
    "worldEditorSpeed", "worldEditorAggro", "worldEditorAttackRange", "worldEditorLeash",
    "worldEditorCollisionRadius", "worldEditorHurtboxRadius"]) {
    requireElement<HTMLInputElement>(id).addEventListener("change", () => {
      try {
        const target = getSelected();
        const previousCollider = target?.kind === "object"
          ? structuredClone((target.object.colliders ??
            target.active.assets.objects[target.object.asset].colliders)[0]) : undefined;
        const enemyValues = target?.kind === "enemy" ? {
          movementSpeed: target.actor.entity.stats.movementSpeed,
          collisionRadius: target.actor.entity.collision?.radius ?? 0.6,
          hurtboxRadius: target.actor.entity.definition.hurtbox.shape === "cylinder"
            ? target.actor.entity.definition.hurtbox.radius : 0.6,
          aggroRadius: target.actor.spec.ai.aggroRadius,
          attackRange: target.actor.spec.ai.attackRange,
          leashRadius: target.actor.spec.ai.leashRadius,
        } : undefined;
        applyParameters();
        if (target?.kind === "object" && previousCollider) {
          const world = target.active;
          const id = target.object.id;
          const current = structuredClone((target.object.colliders ??
            world.assets.objects[target.object.asset].colliders)[0]);
          v2?.recordTransform({
            label: "Dimensions collider",
            run: () => world.editor.setObjectCollider(id, current),
            undo: () => world.editor.setObjectCollider(id, previousCollider),
          });
        } else if (target?.kind === "enemy" && enemyValues) {
          const world = target.active;
          const id = target.actor.spec.id;
          const next = {
            movementSpeed: target.actor.entity.stats.movementSpeed,
            collisionRadius: target.actor.entity.collision?.radius ?? 0.6,
            hurtboxRadius: target.actor.entity.definition.hurtbox.shape === "cylinder"
              ? target.actor.entity.definition.hurtbox.radius : 0.6,
            aggroRadius: target.actor.spec.ai.aggroRadius,
            attackRange: target.actor.spec.ai.attackRange,
            leashRadius: target.actor.spec.ai.leashRadius,
          };
          v2?.recordTransform({
            label: "Paramètres ennemi",
            run: () => world.editor.setEnemyParameters(id, next),
            undo: () => world.editor.setEnemyParameters(id, enemyValues),
          });
        }
        status.textContent = "Paramètres de collision ou d'IA actualisés.";
      } catch (error) { report(error); }
    }, { signal });
  }

  applyVisual.addEventListener("click", async () => {
    const target = getSelected();
    if (!target || target.kind === "interaction" || target.kind === "practice" ||
      target.kind === "prefab" || !selected) return;
    // Capture the destination before awaiting a file import; selection is mutable.
    const selection = { ...selected };
    const isCurrent = () => !signal.aborted && maps.world === target.active &&
      selected?.kind === selection.kind && selected.id === selection.id &&
      selected.mapId === selection.mapId;
    applyVisual.disabled = true;
    let preview: string | undefined;
    try {
      const spec = target.kind === "object" ? target.object : target.actor.spec;
      const visual: VisualOverride = { ...spec.visual };
      visual.scale = numerical("worldEditorScale");
      visual.tint = requireElement<HTMLInputElement>("worldEditorTint").value;
      const model = modelFile.files?.[0];
      if (model) visual.model = await target.active.editor.importGlb(model);
      if (!isCurrent()) return; // Do not apply an import to a different selection or map.
      const texture = textureFile.files?.[0];
      if (texture) {
        if (!/\.(png|jpe?g|webp)$/i.test(texture.name) || !texture.size || texture.size > 8 * 1024 * 1024) {
          throw new Error("Texture PNG/JPEG/WebP de 8 Mo maximum requise.");
        }
        const safeName = texture.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
        visual.texture = "/assets/textures/editor/" + safeName;
        preview = URL.createObjectURL(texture);
      }
      await target.active.editor.setVisual(target.kind, selection.id, visual, preview);
      preview = undefined; // Its lifetime now belongs to the model's texture.
      if (isCurrent()) {
        v2?.onDirectChange();
        status.textContent = "Aperçu appliqué. Pour le rendre permanent, copier les assets dans public/assets puis exporter le JSON.";
      }
    } catch (error) {
      if (preview) URL.revokeObjectURL(preview);
      if (isCurrent()) report(error);
    } finally {
      applyVisual.disabled = false;
    }
  }, { signal });

  exportButton.addEventListener("click", () => {
    const map = maps.world;
    if (!map) return report("Charger une map avant d'exporter.");
    downloadJson(map.definition.id + "-edited.json", map.exportJson());
    status.textContent = "JSON exporté. Les fichiers GLB et textures locaux restent à copier dans public/assets.";
  }, { signal });

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (maps.world === currentMap) {
      if (selected?.kind === "practice" && !practice.get(selected.id)) clearSelection();
      return;
    }
    if (currentMap) cancelPendingPlacement();
    currentMap = maps.world;
    clearSelection();
    buildCatalog();
    v2?.onMapChanged();
    if (pendingPlacement && currentMap) status.textContent = "Cliquer sur le terrain pour placer " + pendingPlacement.label + ".";
  });
  signal.addEventListener("abort", () => {
    stopDrag();
    canvas.classList.remove("map-editor-active");
    canvas.classList.remove("map-editor-placing");
    scene.onBeforeRenderObservable.remove(observer);
    maps.setEditing(false);
    marker.dispose();
    markerMaterial.dispose();
  }, { once: true });
  clearSelection();
  buildCatalog();
  v2 = bindWorldEditorV2({
    scene, canvas, maps, signal, enabled: () => enabled.checked,
    selection: () => selectedItems.map(({ kind, id }) => ({ kind, id })),
    select: (kind, id) => select(kind, id),
    clearSelection,
    updateSelection: () => {
      if (selected) select(selected.kind, selected.id, false, selectedItems.length > 1);
      else setMarker();
    },
    status,
  });

  return { get enabled() { return enabled.checked; } };
}
