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

/** The hero is the default inspector context, not a global tool area. */
export const HERO_TABS = [
  { id: "animations", label: "Animations", modules: ["movementModule", "actionsModule"] },
  { id: "combat", label: "Combat", modules: ["targetLockModule", "collisionsModule", "attackHitboxModule"] },
  { id: "commands", label: "Commandes", modules: ["controlsModule"] },
] as const;
export type HeroTab = typeof HERO_TABS[number]["id"];
export type HeroModuleId = "modelModule" | typeof HERO_TABS[number]["modules"][number];
export type PlaygroundModuleId = WorkspaceModuleId | HeroModuleId;

export function createHeroInspectorState() {
  let tab: HeroTab = "animations";
  let hasSelection = false;
  return {
    get tab(): HeroTab { return tab; },
    get showHero(): boolean { return !hasSelection; },
    setSelection(count: number): void { hasSelection = count > 0; },
    selectTab(next: HeroTab): void { tab = next; },
  };
}

export function modulesForArea(area: WorkspaceArea): readonly {
  readonly id: WorkspaceModuleId;
  readonly label: string;
}[] {
  return WORKSPACE_AREAS.find((entry) => entry.id === area)?.modules ?? [];
}

export function allWorkspaceModuleIds(): PlaygroundModuleId[] {
  return [
    ...WORKSPACE_AREAS.flatMap((area) => area.modules.map((module) => module.id)),
    "modelModule",
    ...HERO_TABS.flatMap<HeroModuleId>((tab) => tab.modules),
  ];
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

export type WorkspaceLeftMenu = "explorer" | "tools";

/**
 * The left dock has exactly one active view. The desktop inspector is
 * independent; on narrow viewports it shares the available overlay space.
 */
export function createWorkspacePanelState() {
  let leftMenu: WorkspaceLeftMenu | undefined;
  let desktopInspectorOpen = true;
  let mobileInspectorOpen = false;

  function setLeftMenu(menu: WorkspaceLeftMenu | undefined, narrow: boolean): void {
    leftMenu = menu;
    if (menu && narrow) mobileInspectorOpen = false;
  }

  return {
    get leftMenu(): WorkspaceLeftMenu | undefined { return leftMenu; },
    get toolsOpen(): boolean { return leftMenu === "tools"; },
    get explorerOpen(): boolean { return leftMenu === "explorer"; },
    setLeftMenu,

    toggleLeftMenu(menu: WorkspaceLeftMenu, narrow: boolean): void {
      setLeftMenu(leftMenu === menu ? undefined : menu, narrow);
    },

    inspectorOpen(narrow: boolean): boolean {
      return narrow ? mobileInspectorOpen : desktopInspectorOpen;
    },

    setInspectorOpen(open: boolean, narrow: boolean): void {
      if (narrow) {
        mobileInspectorOpen = open;
        if (open) leftMenu = undefined;
      } else {
        desktopInspectorOpen = open;
      }
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
