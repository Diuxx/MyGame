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
 * Keep the last visited module for each area during this Playground session.
 * Closing a panel does not forget it, and reopening the current area does not
 * unexpectedly select another module.
 */
export function createWorkspaceNavigation(initialArea: WorkspaceArea = "world") {
  const lastModules = new Map<WorkspaceArea, WorkspaceModuleId>();
  let area = initialArea;
  let module: WorkspaceModuleId | undefined = modulesForArea(area)[0]?.id;
  if (module) lastModules.set(area, module);

  return {
    get area(): WorkspaceArea { return area; },
    get module(): WorkspaceModuleId | undefined { return module; },

    changeArea(nextArea: WorkspaceArea): boolean {
      if (nextArea === area) return false;
      area = nextArea;
      module = lastModules.get(area) ?? modulesForArea(area)[0]?.id;
      if (module) lastModules.set(area, module);
      return true;
    },

    showModule(nextModule: WorkspaceModuleId): boolean {
      if (!modulesForArea(area).some((entry) => entry.id === nextModule)) {
        throw new Error(`Le module ${nextModule} n'appartient pas à l'espace ${area}.`);
      }
      if (module === nextModule) return false;
      module = nextModule;
      lastModules.set(area, nextModule);
      return true;
    },

    closeModule(expectedModule: WorkspaceModuleId): boolean {
      if (module !== expectedModule) return false;
      module = undefined;
      return true;
    },
  };
}

/**
 * Panel visibility is independent of the selected world entity and of the
 * active tool. On narrow viewports, the two overlays are mutually exclusive.
 */
export function createWorkspacePanelState() {
  let toolsOpen = false;
  let desktopInspectorOpen = true;
  let mobileInspectorOpen = false;

  return {
    get toolsOpen(): boolean { return toolsOpen; },

    inspectorOpen(narrow: boolean): boolean {
      return narrow ? mobileInspectorOpen : desktopInspectorOpen;
    },

    setToolsOpen(open: boolean, narrow: boolean): void {
      toolsOpen = open;
      if (open && narrow) mobileInspectorOpen = false;
    },

    setInspectorOpen(open: boolean, narrow: boolean): void {
      if (narrow) {
        mobileInspectorOpen = open;
        if (open) toolsOpen = false;
      } else {
        desktopInspectorOpen = open;
      }
    },
  };
}

/**
 * Explorer visibility does not change the selected workspace area or tab.
 * Keep this state independent of the global tools and object inspector.
 */
export function createWorkspaceExplorerState() {
  let open = false;

  return {
    get open(): boolean { return open; },

    toggle(): boolean {
      open = !open;
      return open;
    },

    close(): void {
      open = false;
    },
  };
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
