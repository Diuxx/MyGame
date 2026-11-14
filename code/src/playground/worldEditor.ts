import {
  Color3, MeshBuilder, Plane, StandardMaterial, type Scene,
} from "@babylonjs/core";
import type { MapCollider, MapPosition } from "../world/maps/types";
import type { VisualOverride } from "../world/maps/editorSchema";
import type { createMapSystem } from "../world/maps/mapSystem";
import { requireElement } from "../ui/dom";

type EntityKind = "object" | "enemy";
interface Selection { kind: EntityKind; id: string; mapId: string }

function numerical(id: string): number {
  const element = requireElement<HTMLInputElement>(id);
  const value = element.valueAsNumber;
  if (!Number.isFinite(value)) throw new Error("Nombre invalide : " + id);
  return value;
}
function setNumber(id: string, value: number): void {
  requireElement<HTMLInputElement>(id).value = String(Number(value.toFixed(3)));
}
function downloadJson(filename: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

/**
 * Explicit edit mode prevents combat actions while dragging. Every operation
 * mutates the same validated map data exported by the Playground.
 */
export function bindWorldEditor(
  scene: Scene, canvas: HTMLCanvasElement, maps: ReturnType<typeof createMapSystem>,
  signal: AbortSignal,
) {
  const enabled = requireElement<HTMLInputElement>("worldEditorEnabled");
  const panel = requireElement<HTMLElement>("worldEditorFields");
  const selectionLabel = requireElement<HTMLElement>("worldEditorSelection");
  const status = requireElement<HTMLElement>("worldEditorStatus");
  const objectSettings = requireElement<HTMLElement>("worldEditorObjectFields");
  const enemySettings = requireElement<HTMLElement>("worldEditorEnemyFields");
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
  let dragging = false;
  let offsetX = 0, offsetZ = 0;
  let currentMap = maps.active;

  function getSelected() {
    const active = maps.active;
    if (!active || !selected || selected.mapId !== active.definition.id) return undefined;
    if (selected.kind === "object") {
      const object = active.definition.objects.find((entry) => entry.id === selected?.id);
      return object ? { kind: "object" as const, object, active } : undefined;
    }
    const actor = active.simulation.list().find((entry) => entry.spec.id === selected?.id);
    return actor ? { kind: "enemy" as const, actor, active } : undefined;
  }

  function clearSelection(): void {
    selected = undefined;
    dragging = false;
    panel.hidden = true;
    marker.setEnabled(false);
    selectionLabel.textContent = "Cliquer sur un ennemi ou un objet pour le sélectionner.";
    modelFile.value = "";
    textureFile.value = "";
  }

  function position(): MapPosition | undefined {
    const target = getSelected();
    return target?.kind === "object" ? target.object.position : target?.actor.entity.position;
  }

  function setMarker(): void {
    const point = position();
    marker.setEnabled(enabled.checked && !!point);
    if (point) marker.position.set(point[0], point[1] + 0.065, point[2]);
  }

  function select(kind: EntityKind, id: string): void {
    const map = maps.active;
    if (!map) return;
    selected = { kind, id, mapId: map.definition.id };
    const target = getSelected();
    if (!target) return clearSelection();
    const spec = target.kind === "object" ? target.object : target.actor.spec;
    panel.hidden = false;
    selectionLabel.textContent = (kind === "object" ? "Décor : " : "Ennemi : ") + id;
    setNumber("worldEditorX", spec.position[0]);
    setNumber("worldEditorY", spec.position[1]);
    setNumber("worldEditorZ", spec.position[2]);
    setNumber("worldEditorRotation", spec.rotationY);
    setNumber("worldEditorScale", spec.visual?.scale ?? 1);
    requireElement<HTMLInputElement>("worldEditorTint").value = spec.visual?.tint ?? "#ffffff";
    objectSettings.hidden = kind !== "object";
    enemySettings.hidden = kind !== "enemy";
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
    setMarker();
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
    target.active.editor.move(selected.kind, selected.id, point);
    target.active.editor.rotate(selected.kind, selected.id, numerical("worldEditorRotation"));
    setMarker();
  }

  function applyParameters(): void {
    const target = getSelected();
    if (!target || !selected) return;
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

  enabled.addEventListener("change", () => {
    maps.setEditing(enabled.checked);
    clearSelection();
    status.textContent = enabled.checked
      ? "Mode édition actif : le combat est désactivé. Glisser sur le terrain pour déplacer."
      : "Mode combat réactivé.";
  }, { signal });

  canvas.addEventListener("pointerdown", (event) => {
    if (!enabled.checked || event.button !== 0 || !maps.active) return;
    const bounds = canvas.getBoundingClientRect();
    const hit = scene.pick(event.clientX - bounds.left, event.clientY - bounds.top,
      (mesh) => mesh.isPickable && !!mesh.metadata?.editorKind);
    const kind = hit?.pickedMesh?.metadata?.editorKind;
    const id = hit?.pickedMesh?.metadata?.editorId;
    if ((kind !== "object" && kind !== "enemy") || typeof id !== "string") {
      clearSelection();
      return;
    }
    select(kind, id);
    const point = position();
    const location = point && pickPosition(event, point[1]);
    if (!point || !location) return;
    offsetX = point[0] - location.x;
    offsetZ = point[2] - location.z;
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
  }, { signal });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || !enabled.checked || !selected) return;
    const point = position();
    const target = getSelected();
    if (!point || !target) return clearSelection();
    const location = pickPosition(event, point[1]);
    if (!location) return;
    const snap = requireElement<HTMLInputElement>("worldEditorSnap").checked ? 0.5 : 0;
    const coordinate = (value: number) => snap ? Math.round(value / snap) * snap : value;
    const next: MapPosition = [coordinate(location.x + offsetX), point[1], coordinate(location.z + offsetZ)];
    target.active.editor.move(selected.kind, selected.id, next);
    setNumber("worldEditorX", next[0]);
    setNumber("worldEditorZ", next[2]);
    setMarker();
  }, { signal });

  const stopDrag = () => { dragging = false; };
  canvas.addEventListener("pointerup", stopDrag, { signal });
  canvas.addEventListener("pointercancel", stopDrag, { signal });

  for (const id of ["worldEditorX", "worldEditorY", "worldEditorZ", "worldEditorRotation"]) {
    requireElement<HTMLInputElement>(id).addEventListener("change", () => {
      try { applyPlacement(); status.textContent = "Placement mis à jour."; } catch (error) { report(error); }
    }, { signal });
  }
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
    if (!target || !selected) return;
    applyVisual.disabled = true;
    let preview: string | undefined;
    try {
      const spec = target.kind === "object" ? target.object : target.actor.spec;
      const visual: VisualOverride = { ...spec.visual };
      visual.scale = numerical("worldEditorScale");
      visual.tint = requireElement<HTMLInputElement>("worldEditorTint").value;
      const model = modelFile.files?.[0];
      if (model) visual.model = await target.active.editor.importGlb(model);
      const texture = textureFile.files?.[0];
      if (texture) {
        if (!/\.(png|jpe?g|webp)$/i.test(texture.name) || !texture.size || texture.size > 8 * 1024 * 1024) {
          throw new Error("Texture PNG/JPEG/WebP de 8 Mo maximum requise.");
        }
        const safeName = texture.name.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
        visual.texture = "/assets/textures/editor/" + safeName;
        preview = URL.createObjectURL(texture);
      }
      await target.active.editor.setVisual(selected.kind, selected.id, visual, preview);
      preview = undefined; // Its lifetime now belongs to the model's texture.
      status.textContent = "Aperçu appliqué. Pour le rendre permanent, copier les assets dans public/assets puis exporter le JSON.";
    } catch (error) { if (preview) URL.revokeObjectURL(preview); report(error); }
    finally { applyVisual.disabled = false; }
  }, { signal });

  exportButton.addEventListener("click", () => {
    const map = maps.active;
    if (!map) return report("Charger une map avant d'exporter.");
    downloadJson(map.definition.id + "-edited.json", map.exportJson());
    status.textContent = "JSON exporté. Les fichiers GLB et textures locaux restent à copier dans public/assets.";
  }, { signal });

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (maps.active === currentMap) return;
    currentMap = maps.active;
    clearSelection();
  });
  signal.addEventListener("abort", () => {
    scene.onBeforeRenderObservable.remove(observer);
    maps.setEditing(false);
    marker.dispose();
    markerMaterial.dispose();
  }, { once: true });
  clearSelection();

  return { get enabled() { return enabled.checked; } };
}
