import type { CharacterEquipment } from "../character/equipment";
import {
  DEFAULT_DRAWN_KATANA_ROTATION, EQUIPMENT_DEFAULTS, parseDrawnKatanaRotation, type EquipmentTransform,
} from "../character/equipmentTuning";
import { requireElement } from "../ui/dom";

const STORAGE_KEY = "mon-rpg.playground.equipment.v1";
const SOCKET_LABELS = { back: "Fourreau — Dos", hand: "Katana — Main droite" };
const AXES = ["X", "Y", "Z"] as const;

export function bindEquipmentTools(equipment: CharacterEquipment, isActing: () => boolean, previewAttack: () => void, signal: AbortSignal): () => void {
  const transforms = {
    ...structuredClone(EQUIPMENT_DEFAULTS),
    katanaRotation: [...DEFAULT_DRAWN_KATANA_ROTATION] as [number, number, number],
  };
  let saved: Partial<typeof transforms> | undefined;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? undefined;
  } catch (error) {
    console.warn("Réglages d’équipement illisibles.", error);
  }

  const fields = requireElement("equipmentTransforms");
  const status = document.createElement("p");
  status.className = "animation-note";
  status.role = "status";
  const sheathed = requireElement<HTMLButtonElement>("equipmentSheathed");
  const drawn = requireElement<HTMLButtonElement>("equipmentDrawn");
  const attack = requireElement<HTMLButtonElement>("equipmentAttack");

  function save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transforms));
      status.textContent = "";
    } catch {
      status.textContent = "Réglages appliqués pour cette session.";
    }
  }

  for (const socket of ["back", "hand"] as const) {
    const transform: EquipmentTransform = transforms[socket];
    const group = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = SOCKET_LABELS[socket];
    group.append(legend);
    fields.append(group);
    const resetFields: (() => void)[] = [];

    function addInput(labelText: string, initial: number, previous: unknown, min: number, max: number, step: number, set: (value: number) => void): void {
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "number";
      Object.assign(input, { min: String(min), max: String(max), step: String(step) });
      const value = typeof previous === "number" && Number.isFinite(previous) && previous >= min && previous <= max ? previous : initial;
      set(value);
      input.value = String(value);
      resetFields.push(() => { set(initial); input.value = String(initial); });
      input.addEventListener("input", () => {
        const value = input.valueAsNumber;
        if (!Number.isFinite(value) || value < min || value > max) return;
        set(value);
        equipment.setTransform(socket, transform);
        save();
      }, { signal });
      label.append(input);
      group.append(label);
    }

    for (const [key, title, max, step] of [["position", "Position", 2, 0.005], ["rotation", "Rotation", 360, 1]] as const) {
      AXES.forEach((axis, i) => addInput(`${title} ${axis}`, transform[key][i], saved?.[socket]?.[key]?.[i],
        -max, max, step, (value) => { transform[key][i] = value; }));
    }
    addInput("Échelle", transform.scale, saved?.[socket]?.scale, 0.05, 2, 0.01, (value) => { transform.scale = value; });
    equipment.setTransform(socket, transform);
    if (socket === "hand") {
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "secondary wide";
      reset.textContent = "Rétablir l’attache du katana";
      reset.addEventListener("click", () => {
        resetFields.forEach((restore) => restore());
        equipment.setTransform(socket, transform);
        save();
      }, { signal });
      fields.append(reset);
    }
  }
  // This pivot is separate from the hand socket and rotates around the grip.
  const katanaRotation = parseDrawnKatanaRotation(saved?.katanaRotation);
  transforms.katanaRotation = katanaRotation;
  equipment.setDrawnKatanaRotation(katanaRotation);
  const bladeGroup = document.createElement("fieldset");
  const bladeLegend = document.createElement("legend");
  bladeLegend.textContent = "Orientation de la lame dégainée (°)";
  bladeGroup.append(bladeLegend);
  const bladeFields: HTMLInputElement[] = [];
  AXES.forEach((axis, i) => {
    const label = document.createElement("label");
    label.textContent = `Rotation ${axis}`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "-360";
    input.max = "360";
    input.step = "1";
    input.value = String(katanaRotation[i]);
    input.addEventListener("input", () => {
      const value = input.valueAsNumber;
      if (!Number.isFinite(value) || value < -360 || value > 360) return;
      katanaRotation[i] = value;
      equipment.setDrawnKatanaRotation(katanaRotation);
      save();
    }, { signal });
    bladeFields.push(input);
    label.append(input);
    bladeGroup.append(label);
  });
  fields.append(bladeGroup);
  const resetBlade = document.createElement("button");
  resetBlade.type = "button";
  resetBlade.className = "secondary wide";
  resetBlade.textContent = "Rétablir l’orientation de la lame";
  resetBlade.addEventListener("click", () => {
    katanaRotation.splice(0, 3, ...DEFAULT_DRAWN_KATANA_ROTATION);
    bladeFields.forEach((input, i) => { input.value = String(katanaRotation[i]); });
    equipment.setDrawnKatanaRotation(katanaRotation);
    save();
  }, { signal });
  fields.append(resetBlade);
  const hint = document.createElement("p");
  hint.className = "animation-note";
  hint.textContent = "La rotation de la lame est indépendante de l’attache à la main. Cliquez sur « Arme dégainée » pour voir le résultat.";
  fields.append(hint, status);

  let previousState: string | undefined;
  let previouslyLocked: boolean | undefined;
  function update(): void {
    const state = equipment.state;
    const locked = isActing();
    if (state === previousState && locked === previouslyLocked) return;
    previousState = state;
    previouslyLocked = locked;
    attack.disabled = locked;
    for (const [button, active] of [[sheathed, state === "SHEATHED"], [drawn, state === "DRAWN"]] as const) {
      button.disabled = locked;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  sheathed.addEventListener("click", () => { if (!isActing()) equipment.transition(false); update(); }, { signal });
  drawn.addEventListener("click", () => { if (!isActing()) equipment.transition(true); update(); }, { signal });
  attack.addEventListener("click", () => { previewAttack(); update(); }, { signal });
  update();
  return update;
}
