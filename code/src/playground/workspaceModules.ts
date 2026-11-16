/**
 * One home for each existing Playground module. Navigation is presentation-only:
 * the original DOM controls and their bound listeners are retained.
 */
export const WORKSPACE_AREAS = [
  {
    id: "world", label: "Monde", symbol: "▦",
    modules: [
      { id: "worldEditorModule", label: "Éditeur" },
      { id: "lightingModule", label: "Éclairage" },
      { id: "mapsModule", label: "Maps et zones" },
      { id: "cameraModule", label: "Caméra" },
    ],
  },
  {
    id: "hero", label: "Héros", symbol: "♙",
    modules: [
      { id: "movementModule", label: "Déplacements" },
      { id: "actionsModule", label: "Actions" },
      { id: "modelModule", label: "Modèle 3D" },
      { id: "controlsModule", label: "Commandes" },
    ],
  },
  {
    id: "combat", label: "Combat", symbol: "⚔",
    modules: [
      { id: "targetLockModule", label: "Ciblage" },
      { id: "collisionsModule", label: "Collisions" },
      { id: "attackHitboxModule", label: "Attaques et portée" },
    ],
  },
  {
    id: "enemies", label: "Ennemis", symbol: "♜",
    modules: [{ id: "enemiesModule", label: "Gestion des ennemis" }],
  },
  {
    id: "effects", label: "Effets", symbol: "✧",
    modules: [{ id: "floatingTextModule", label: "Textes flottants" }],
  },
  { id: "debug", label: "Debug", symbol: "⌘", modules: [] },
] as const;

export type WorkspaceArea = typeof WORKSPACE_AREAS[number]["id"];
export type WorkspaceModuleId = typeof WORKSPACE_AREAS[number]["modules"][number]["id"];

export function modulesForArea(area: WorkspaceArea): readonly {
  readonly id: WorkspaceModuleId;
  readonly label: string;
}[] {
  return WORKSPACE_AREAS.find((entry) => entry.id === area)?.modules ?? [];
}

export function allWorkspaceModuleIds(): WorkspaceModuleId[] {
  return WORKSPACE_AREAS.flatMap((area) => area.modules.map((module) => module.id));
}

/**
 * The existing editor checkbox is the single authority for editing state.
 * Dispatching change goes through the original camera, combat and input hooks.
 */
export function setWorkspaceEditingState(
  input: { checked: boolean; dispatchEvent(event: Event): boolean },
  editing: boolean,
): boolean {
  if (input.checked === editing) return false;
  input.checked = editing;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
