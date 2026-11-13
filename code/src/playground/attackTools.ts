import {
  Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, VertexData,
  type LinesMesh, type Scene,
} from "@babylonjs/core";
import { defaultSwordSwing, parseSwordSwing, swordHitboxOutline } from "../combat/attackSettings";
import type { SwordSwing } from "../combat/combat";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mygame.playground.attack-hitbox.v1";

interface AttackVisualSettings {
  visible: boolean;
  alwaysVisible: boolean;
  swing: SwordSwing;
}

function parseSettings(value: unknown): AttackVisualSettings {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Configuration de l'attaque invalide.");
  }
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || typeof data.visible !== "boolean" || typeof data.alwaysVisible !== "boolean") {
    throw new Error("Version ou affichage de la zone d'attaque invalide.");
  }
  return {
    visible: data.visible,
    alwaysVisible: data.alwaysVisible,
    swing: parseSwordSwing(data.swing),
  };
}

/**
 * A debug projection of the actual mathematical sword hitbox. Rendered
 * geometry is never used for game rules; strikes read the same swing values.
 */
export function bindAttackTools(scene: Scene, hero: TransformNode, signal: AbortSignal) {
  const quickToggle = requireElement<HTMLInputElement>("attackHitboxQuickToggle");
  const visible = requireElement<HTMLInputElement>("attackHitboxVisible");
  const alwaysVisible = requireElement<HTMLInputElement>("attackHitboxAlwaysVisible");
  const damage = requireElement<HTMLInputElement>("attackDamage");
  const range = requireElement<HTMLInputElement>("attackRange");
  const radius = requireElement<HTMLInputElement>("attackRadius");
  const height = requireElement<HTMLInputElement>("attackHeight");
  const reset = requireElement<HTMLButtonElement>("attackHitboxReset");
  const status = requireElement<HTMLParagraphElement>("attackHitboxStatus");

  let settings: AttackVisualSettings = {
    visible: true,
    alwaysVisible: false,
    swing: defaultSwordSwing(),
  };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = parseSettings(JSON.parse(saved));
  } catch (error) {
    status.textContent = `Réglages d’attaque ignorés : ${error instanceof Error ? error.message : String(error)}`;
  }

  const root = new TransformNode("attack-hitbox-debug-root", scene);
  const material = new StandardMaterial("attackHitboxOrange", scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.FromHexString("#FF9638");
  material.alpha = 0.28;
  material.backFaceCulling = false;

  let surface: Mesh | undefined;
  let outline: LinesMesh | undefined;
  let attacking = false;

  function draw(): void {
    root.position.set(hero.position.x, hero.position.y + settings.swing.height, hero.position.z);
    root.rotation.y = hero.rotation.y;
    root.setEnabled(settings.visible && (settings.alwaysVisible || attacking));
  }

  function rebuild(): void {
    surface?.dispose();
    outline?.dispose();
    const points = swordHitboxOutline(settings.swing);
    const vertices = [0, 0, settings.swing.range / 2];
    for (const point of points) vertices.push(point.x, 0, point.z);
    const indices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      indices.push(0, i + 1, (i + 1) % points.length + 1);
    }
    surface = new Mesh("attack-hitbox-area", scene);
    const data = new VertexData();
    data.positions = vertices;
    data.indices = indices;
    const normals: number[] = [];
    VertexData.ComputeNormals(vertices, indices, normals);
    data.normals = normals;
    data.applyToMesh(surface);
    surface.parent = root;
    surface.material = material;
    surface.isPickable = false;

    outline = MeshBuilder.CreateLines("attack-hitbox-outline", {
      points: [...points, points[0]].map(({ x, z }) => new Vector3(x, 0.006, z)),
    }, scene);
    outline.parent = root;
    outline.color = Color3.FromHexString("#FFB45E");
    outline.isPickable = false;
    draw();
  }

  function syncControls(): void {
    visible.checked = settings.visible;
    quickToggle.checked = settings.visible;
    alwaysVisible.checked = settings.alwaysVisible;
    damage.value = String(settings.swing.damage);
    range.value = String(settings.swing.range);
    radius.value = String(settings.swing.radius);
    height.value = String(settings.swing.height);
    rebuild();
  }

  function applyControls(): void {
    try {
      const swing = parseSwordSwing({
        damage: damage.valueAsNumber,
        range: range.valueAsNumber,
        radius: radius.valueAsNumber,
        height: height.valueAsNumber,
      });
      settings = { visible: visible.checked, alwaysVisible: alwaysVisible.checked, swing };
      syncControls();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...settings }));
      status.textContent = "";
    } catch (error) {
      syncControls();
      status.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  for (const input of [visible, alwaysVisible, damage, range, radius, height]) {
    input.addEventListener("change", applyControls, { signal });
  }
  quickToggle.addEventListener("change", () => {
    visible.checked = quickToggle.checked;
    applyControls();
  }, { signal });
  reset.addEventListener("click", () => {
    settings = { visible: true, alwaysVisible: false, swing: defaultSwordSwing() };
    syncControls();
    applyControls();
  }, { signal });

  signal.addEventListener("abort", () => {
    surface?.dispose();
    outline?.dispose();
    root.dispose();
    material.dispose();
  }, { once: true });
  syncControls();

  return {
    getSwing(): SwordSwing { return { ...settings.swing }; },
    setAttacking(active: boolean): void {
      attacking = active;
      draw();
    },
  };
}
