import {
  Color3, MeshBuilder, Plane, StandardMaterial, type Scene,
} from "@babylonjs/core";
import type { MapCollider, MapPosition } from "../world/maps/types";
import type { createEnemyScene } from "../enemies/enemyScene";
import type { MapEditorKind, MapPlacementKind, VisualOverride } from "../world/maps/editorSchema";
import { findTerrainCell, tileCenter } from "../world/maps/validation";
import type { createMapSystem } from "../world/maps/mapSystem";
import { downloadJson, requireElement } from "../ui/dom";

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
  let drag: { pointerId: number; offsetX: number; offsetZ: number } | undefined;
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

  function setMarker(): void {
    const point = position();
    marker.setEnabled(enabled.checked && !!point);
    if (point) marker.position.set(point[0], point[1] + 0.065, point[2]);
  }

  function select(kind: SelectionKind, id: string): void {
    const map = maps.world;
    if (!map) return;
    selected = { kind, id, mapId: map.definition.id };
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
      target.active.editor.rotate(target.kind, selected.id, numerical("worldEditorRotation"));
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
    return findTerrainCell(map, snapped[0], snapped[2]) ? snapped : [point.x, y, point.z];
  }

  function snap(value: number): number {
    return snapToGrid.checked ? Math.round(value * 2) / 2 : value;
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
    const placement = pendingPlacement;
    if (placement) {
      const point = placementPoint(event);
      if (!point) return report("Cliquer à l’intérieur du terrain.");
      placing = true;
      syncPlacement();
      void active.editor.place(placement.kind, placement.id, point).then((id) => {
        if (signal.aborted || maps.world !== active || pendingPlacement !== placement) return;
        cancelPendingPlacement();
        if (id && placement.kind !== "tile") select(placement.kind, id);
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
    select(kind, id);
    const point = position();
    const location = point && pickPosition(event, point[1]);
    if (!point || !location) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { pointerId: event.pointerId, offsetX: point[0] - location.x, offsetZ: point[2] - location.z };
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
    moveSelected(target, selected, next);
    setNumber("worldEditorX", next[0]);
    setNumber("worldEditorZ", next[2]);
    setMarker();
  }, { signal });
  canvas.addEventListener("pointerleave", () => {
    if (pendingPlacement) marker.setEnabled(false);
  }, { signal });

  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    canvas.addEventListener(eventName, (event) => {
      if (drag?.pointerId === event.pointerId) stopDrag();
    }, { signal });
  }

  for (const id of ["worldEditorX", "worldEditorY", "worldEditorZ", "worldEditorRotation"]) {
    requireElement<HTMLInputElement>(id).addEventListener("change", () => {
      try { applyPlacement(); status.textContent = "Placement mis à jour."; } catch (error) { report(error); }
    }, { signal });
  }
  requireElement<HTMLInputElement>("worldEditorPrefabScale").addEventListener("change", () => {
    try { applyParameters(); status.textContent = "Échelle du prefab mise à jour."; }
    catch (error) { report(error); }
  }, { signal });
  duplicatePrefab.addEventListener("click", () => {
    const target = getSelected();
    if (!target || target.kind !== "prefab" || !selected) return;
    try {
      const id = target.active.editor.duplicatePrefab(selected.id);
      select("prefab", id);
      status.textContent = "Bloc dupliqué : " + id;
    } catch (error) { report(error); }
  }, { signal });
  deletePrefab.addEventListener("click", () => {
    const target = getSelected();
    if (!target || target.kind !== "prefab" || !selected) return;
    try {
      target.active.editor.removePrefab(selected.id);
      clearSelection();
      status.textContent = "Bloc supprimé.";
    } catch (error) { report(error); }
  }, { signal });
  for (const id of ["worldEditorColliderWidth", "worldEditorColliderHeight", "worldEditorColliderDepth",
    "worldEditorSpeed", "worldEditorAggro", "worldEditorAttackRange", "worldEditorLeash",
    "worldEditorCollisionRadius", "worldEditorHurtboxRadius"]) {
    requireElement<HTMLInputElement>(id).addEventListener("change", () => {
      try { applyParameters(); status.textContent = "Paramètres de collision ou d'IA actualisés."; }
      catch (error) { report(error); }
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

  return { get enabled() { return enabled.checked; } };
}
