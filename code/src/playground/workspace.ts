
import type { Scene } from "@babylonjs/core";
import type { createMapSystem } from "../world/maps/mapSystem";
import type { MapDefinition } from "../world/maps/types";
import { requireElement } from "../ui/dom";
import { createNicolabzIcon, setNicolabzButtonIcon, type NicolabzIconName } from "./nicolabzIcons";
import type { bindWorldEditor } from "./worldEditor";
import { WORKSPACE_AREAS, allWorkspaceModuleIds, createWorkspaceNavigation, createWorkspacePanelState, modulesForArea, setWorkspaceEditingState, type WorkspaceArea, type WorkspaceModuleId } from "./workspaceModules";

type WorldEditor = ReturnType<typeof bindWorldEditor>;
type MapSystem = ReturnType<typeof createMapSystem>;
type SelectionKind = "prefab" | "object" | "enemy" | "interaction";

const AREA_ICONS: Record<WorkspaceArea, NicolabzIconName> = {
  world: "boxes", hero: "user", combat: "shield",
  enemies: "users-round", effects: "bell", debug: "bug",
};

const DEBUG_CONTROLS = [
  "heroHitboxVisible", "enemyHitboxesVisible", "enemyCollidersVisible",
  "attackHitboxVisible", "mapShowColliders", "mapShowAggro",
  "mapShowZonePoints", "showGrid",
] as const;

function surface(tag: "header" | "nav" | "aside" | "section" | "footer" | "div", id: string,
  className: string, markup: string): HTMLElement {
  const node = document.createElement(tag);
  node.id = id;
  node.className = className;
  node.innerHTML = markup; // Only fixed, authored markup; map/entity names use textContent.
  return node;
}

function moveControl(id: string, destination: HTMLElement, title?: string): HTMLElement {
  const element = requireElement<HTMLElement>(id);
  destination.append(element);
  if (title) {
    element.title = title;
    element.setAttribute("aria-label", title);
  }
  return element;
}

function groupDetails(name: string, entries: readonly { id: string; label: string; kind?: SelectionKind }[],
  selected: readonly { kind: string; id: string }[], onSelect: (kind: SelectionKind, id: string, additive: boolean) => void,
  expanded: Set<string>): HTMLElement {
  const group = document.createElement("details");
  group.className = "ws-scene-group";
  group.open = expanded.has(name);
  const summary = document.createElement("summary");
  summary.textContent = name + " · " + entries.length;
  group.append(summary);
  for (const item of entries) {
    const line = document.createElement(item.kind ? "button" : "div");
    line.className = "ws-scene-entry";
    const marker = document.createElement("span");
    marker.className = "ws-scene-icon";
    marker.textContent = item.kind === "enemy" ? "♟" : item.kind === "prefab" ? "▣" : "◇";
    line.append(marker, document.createTextNode(item.label));
    line.title = item.id;
    if (item.kind && line instanceof HTMLButtonElement) {
      line.type = "button";
      line.classList.toggle("is-selected", selected.some((value) =>
        value.id === item.id && value.kind === item.kind));
      line.addEventListener("click", (event) => onSelect(item.kind!, item.id, event.shiftKey));
    }
    group.append(line);
  }
  group.addEventListener("toggle", () => {
    if (group.open) expanded.add(name);
    else expanded.delete(name);
  });
  return group;
}

/**
 * Rearranges the original DOM nodes instead of duplicating them. Existing
 * controller bindings, file inputs, animations and JSON tools stay connected.
 */
export function bindPlaygroundWorkspace(
  scene: Scene, maps: MapSystem, editor: WorldEditor, signal: AbortSignal,
): void {
  const app = requireElement<HTMLElement>("app");
  const stageCandidate = app.querySelector<HTMLElement>(".stage");
  if (!stageCandidate) throw new Error("La scène du Playground est introuvable.");
  const stage: HTMLElement = stageCandidate;

  const top = surface("header", "ws-top", "ws-top",
    '<div class="ws-logo" aria-hidden="true">◈</div>' +
    '<div class="ws-identity"><strong>IDLE RPG</strong><small>PLAYGROUND</small></div>' +
    '<button class="ws-header-control ws-explorer-toggle" id="ws-explorer-toggle" type="button" aria-label="Afficher l’explorateur" aria-expanded="false">☰</button>' +
    '<div class="ws-breadcrumb"><span class="ws-muted">Projet / Monde /</span> <strong id="ws-active-name">Playground</strong></div>' +
    '<div class="ws-top-space"></div>' +
    '<div class="ws-map-picker"><label for="mapSelect">Map</label><div id="ws-map-select-host"></div><div id="ws-map-load-host"></div></div>' +
    '<span id="ws-top-fps"></span>' +
    '<button id="ws-tools-toggle" class="ws-header-control" type="button" aria-controls="ws-tools" aria-expanded="false" title="Afficher les outils globaux">⚙ Outils</button>' +
    '<button id="ws-debug-toggle" class="ws-header-control" type="button" aria-expanded="false" title="Affichages de debug">⌘ Debug</button>' +
    '<button id="ws-inspector-open" class="ws-header-control ws-inspector-open" type="button" aria-expanded="false" title="Afficher l’inspecteur">☷ Inspecteur</button>' +
    '<div class="ws-mode-switch" role="group" aria-label="Mode du Playground">' +
    '<button id="ws-edit-mode" type="button" aria-pressed="true">✎ Édition</button>' +
    '<button id="ws-test-mode" type="button" aria-pressed="false">▶ Tester le jeu</button></div>');
  const toolbar = surface("section", "ws-toolbar", "ws-toolbar",
    '<div class="ws-tool-buttons" role="toolbar" aria-label="Outils de transformation">' +
    '<button type="button" data-workspace-tool="select" title="Sélection (clic)" aria-label="Sélection">↖</button>' +
    '<button type="button" data-workspace-tool="move" title="Déplacer (G)" aria-label="Déplacer">✥</button>' +
    '<button type="button" data-workspace-tool="rotate" title="Rotation (R)" aria-label="Rotation">↻</button>' +
    '<button type="button" data-workspace-tool="scale" title="Échelle (S)" aria-label="Échelle">◇</button></div>' +
    '<div class="ws-toolbar-separator"></div><div id="ws-snap-tools" class="ws-snap-tools"></div>' +
    '<div class="ws-toolbar-separator"></div><div id="ws-history-tools" class="ws-history-tools"></div>' +
    '<div class="ws-toolbar-end"></div><div id="ws-export-tools"></div>' +
    '<div id="ws-preserved-controls" hidden></div>');
  const rail = surface("nav", "ws-rail", "ws-rail", "");
  rail.setAttribute("aria-label", "Espaces de travail");
  const left = surface("aside", "ws-left", "ws-left",
    '<div class="ws-side-head"><strong>EXPLORATEUR</strong><span id="ws-map-heading" class="ws-muted">Map active</span></div>' +
    '<div class="ws-left-tabs" role="group" aria-label="Exploration de la scène">' +
    '<button id="ws-scene-tab" class="is-active" type="button" aria-pressed="true">Scène</button>' +
    '<button id="ws-catalog-tab" type="button" aria-pressed="false">Catalogue</button></div>' +
    '<div id="ws-scene-pane" class="ws-left-pane"><input id="ws-scene-search" type="search" placeholder="Rechercher un élément…" aria-label="Rechercher un objet dans la scène" />' +
    '<div id="ws-scene-tree"></div></div>' +
    '<div id="ws-catalog-pane" class="ws-left-pane" hidden></div>' +
    '<div class="ws-left-footer"><div id="ws-left-footer-map"></div>' +
    '<button id="ws-open-whitebox" type="button">▣ Blocs réutilisables (whitebox)</button>' +
    '<button id="ws-open-maps" type="button">▦ Gestion des maps</button></div>');
  left.setAttribute("aria-label", "Explorateur de scène et catalogue");
  const right = surface("aside", "ws-right", "ws-right",
    '<div class="ws-side-head"><strong id="ws-inspector-title">INSPECTEUR</strong><button id="ws-inspector-toggle" type="button" title="Masquer l’inspecteur" aria-label="Masquer l’inspecteur">◧</button></div>' +
    '<div id="ws-inspector-body" class="ws-inspector-body">' +
    '<p id="ws-inspector-empty" class="ws-inspector-empty">Sélectionne un objet dans la scène ou dans l’explorateur pour afficher ses propriétés.</p></div>');
  right.setAttribute("aria-label", "Propriétés de la sélection");
  const toolsDock = surface("aside", "ws-tools", "ws-tools",
    '<div class="ws-side-head"><strong id="ws-tools-title">OUTILS · MONDE</strong>' +
    '<button id="ws-tools-close" type="button" aria-label="Fermer les outils">×</button></div>' +
    '<nav id="ws-module-tabs" class="ws-module-tabs" aria-label="Outils de la catégorie"></nav>' +
    '<div id="ws-module-host" class="ws-module-host"></div>' +
    '<section id="ws-debug-panel" class="ws-debug-panel" hidden><h3>Visualisation et diagnostic</h3>' +
    '<p>Les affichages rapides réutilisent les contrôles d’origine.</p><div id="ws-debug-controls" class="ws-debug-controls"></div>' +
    '<div class="ws-debug-shortcuts"><button id="ws-open-collisions" type="button">Paramètres des collisions</button>' +
    '<button id="ws-open-attacks" type="button">Portée et attaques</button>' +
    '<button id="ws-open-map-debug" type="button">État de la map</button></div></section>');
  toolsDock.hidden = true;
  toolsDock.setAttribute("aria-label", "Outils et paramètres globaux du Playground");
  const footer = surface("footer", "ws-statusbar", "ws-statusbar",
    '<span id="ws-status-map">Aucune map</span><span class="ws-status-separator">·</span>' +
    '<span id="ws-status-selection">Aucune sélection</span>' +
    '<button id="ws-selection-properties" type="button" aria-label="Afficher les propriétés de la sélection" hidden>Propriétés</button>' +
    '<span class="ws-status-grow"></span>' +
    '<span id="ws-map-feedback" role="status" aria-live="polite"></span>' +
    '<span id="ws-status-mode">Mode édition</span><span class="ws-status-separator">·</span>' +
    '<span>F2 : changer de mode</span>');
  const debugDrawer = surface("aside", "ws-debug-drawer", "ws-debug-drawer",
    '<div class="ws-drawer-heading"><strong>Affichage rapide</strong>' +
    '<button id="ws-debug-close" type="button" aria-label="Fermer le debug">×</button></div>' +
    '<div id="ws-debug-test-host"></div>');
  debugDrawer.hidden = true;
  stage.append(debugDrawer);
  app.append(top, toolbar, rail, left, right, toolsDock, footer);
  app.classList.add("workspace-app");
  // Keep native buttons, labels and event handlers. The Babylon transform tools
  // retain their specialized glyphs until the design system offers equivalents.
  for (const [id, icon, label] of [
    ["ws-explorer-toggle", "menu"],
    ["ws-tools-toggle", "settings", "Outils"],
    ["ws-debug-toggle", "bug", "Debug"],
    ["ws-inspector-open", "square-pen", "Inspecteur"],
    ["ws-inspector-toggle", "square-pen"],
    ["ws-tools-close", "x"],
    ["ws-debug-close", "x"],
    ["ws-edit-mode", "pencil", "Édition"],
    ["ws-test-mode", "rocket", "Tester le jeu"],
    ["ws-open-whitebox", "boxes", "Blocs réutilisables (whitebox)"],
    ["ws-open-maps", "folder", "Gestion des maps"],
  ] as const) {
    setNicolabzButtonIcon(requireElement<HTMLButtonElement>(id), icon, label);
  }
  app.dataset.workspaceMode = "edit";
  // Both legacy launchers and floating windows remain as single DOM instances.
  const legacySidebar = requireElement<HTMLElement>("playgroundPanel");
  const legacyDock = requireElement<HTMLElement>("playgroundModules");
  legacySidebar.hidden = true;
  legacyDock.hidden = true;

  const navigation = createWorkspaceNavigation();
  const panelState = createWorkspacePanelState();
  const modules = new Map<WorkspaceModuleId, HTMLElement>();
  const moduleHost = requireElement<HTMLElement>("ws-module-host");
  for (const id of allWorkspaceModuleIds()) {
    const panel = requireElement<HTMLElement>(id);
    modules.set(id, panel);
    moduleHost.append(panel);
    panel.classList.add("ws-existing-module", "nz-form-panel");
    const closeIconButton = panel.querySelector<HTMLButtonElement>(".module-close");
    if (closeIconButton) setNicolabzButtonIcon(closeIconButton, "x");
    panel.hidden = true;
    const closeModule = () => {
      // Closing an editor tool does not forget the last module for this area.
      if (navigation.module === id) closeTools();
    };
    panel.querySelector<HTMLButtonElement>(".module-close")?.addEventListener("click", closeModule, { signal });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.defaultPrevented &&
        !(event.target instanceof HTMLSelectElement)) closeModule();
    }, { signal });
  }

  const editInput = requireElement<HTMLInputElement>("worldEditorEnabled");
  const oldEditLabel = editInput.closest("label");
  if (oldEditLabel) legacySidebar.append(oldEditLabel);
  moveControl("mapSelect", requireElement("ws-map-select-host"));
  moveControl("mapLoad", requireElement("ws-map-load-host"), "Charger la map sélectionnée");
  moveControl("renderFps", requireElement("ws-top-fps"));
  const mapExportButton = moveControl("worldEditorExport",
    requireElement("ws-export-tools"), "Télécharger le JSON de la map (ne sauvegarde pas dans Git)");
  const exportFeedback = document.createElement("span");
  exportFeedback.id = "ws-export-feedback";
  exportFeedback.setAttribute("role", "status");
  exportFeedback.setAttribute("aria-live", "polite");
  requireElement("ws-export-tools").append(exportFeedback);
  mapExportButton.addEventListener("click", () => {
    // The existing World Editor listener writes the result synchronously first.
    exportFeedback.textContent = requireElement("worldEditorStatus").textContent ?? "";
  }, { signal });

  const toolSelector = requireElement<HTMLSelectElement>("worldEditorTool");
  const oldToolRow = toolSelector.closest(".enemy-fields");
  requireElement("ws-preserved-controls").append(toolSelector.closest("label") ?? toolSelector);
  oldToolRow?.classList.add("ws-relocated-source");
  const snapHost = requireElement<HTMLElement>("ws-snap-tools");
  const snapSource = requireElement("worldEditorSnap").closest(".enemy-fields");
  for (const id of ["worldEditorSnap", "worldEditorSnapStep", "worldEditorRotationSnap"]) {
    const input = requireElement<HTMLElement>(id);
    const label = input.closest("label");
    if (!label) throw new Error("Contrôle sans label : " + id);
    snapHost.append(label);
  }
  snapSource?.classList.add("ws-relocated-source");
  const historySource = requireElement("worldEditorUndo").closest(".enemy-fields");
  const historyHost = requireElement<HTMLElement>("ws-history-tools");
  for (const [id, name, symbol, icon] of [
    ["worldEditorUndo", "Annuler (Ctrl+Z)", "↶", "arrow-left"],
    ["worldEditorRedo", "Rétablir (Ctrl+Y)", "↷", "arrow-right"],
    ["worldEditorCopy", "Copier (Ctrl+C)", "⧉", "copy"],
    ["worldEditorPaste", "Coller (Ctrl+V)", "▤", "clipboard"],
    ["worldEditorCut", "Couper (Ctrl+X)", "✂", undefined],
    ["worldEditorDelete", "Supprimer (Suppr)", "⌫", "trash-2"],
  ] as const) {
    const button = moveControl(id, historyHost, name);
    if (icon) setNicolabzButtonIcon(button as HTMLButtonElement, icon);
    else button.textContent = symbol;
    button.classList.add("ws-action-button", "nz-icon-button");
  }
  historySource?.classList.add("ws-relocated-source");

  const catalog = requireElement("worldEditorCatalog");
  const selection = requireElement("worldEditorSelection");
  const properties = requireElement("worldEditorFields");
  const heightControls = requireElement("worldEditorHeightStep").closest(".enemy-fields");
  const contextInspector = document.createElement("section");
  contextInspector.className = "ws-context-inspector";
  contextInspector.append(selection, properties);
  if (heightControls) contextInspector.append(heightControls);
  requireElement("ws-inspector-body").append(contextInspector);
  requireElement("ws-catalog-pane").append(catalog);
  // Make the reusable whitebox blocks discoverable immediately without
  // changing their original buttons, listeners or catalogue data.
  const prefabGroup = requireElement("worldEditorCatalogPrefabs").closest("details");
  if (prefabGroup) {
    catalog.prepend(prefabGroup);
    prefabGroup.open = true;
  }
  const debugControls = requireElement("ws-debug-controls");
  for (const id of DEBUG_CONTROLS) {
    const input = requireElement<HTMLInputElement>(id);
    const label = input.closest("label");
    if (!label) throw new Error("Option de debug sans libellé : " + id);
    debugControls.append(label);
  }

  const expandedGroups = new Set(["Architecture", "Mobilier", "Décors", "Ennemis", "Terrain", "Interactions", "architecture", "furniture", "decoration", "entities"]);

  const areaButtons = new Map<WorkspaceArea, HTMLButtonElement>();
  for (const area of WORKSPACE_AREAS) {
    const button = document.createElement("button");
    button.className = "ws-area-button";
    button.type = "button";
    button.dataset.area = area.id;
    button.innerHTML = '<span class="ws-area-icon" aria-hidden="true"></span><span class="ws-area-label"></span>';
    button.querySelector<HTMLElement>(".ws-area-icon")!.append(createNicolabzIcon(AREA_ICONS[area.id]));
    button.querySelector<HTMLElement>(".ws-area-label")!.textContent = area.label;
    button.title = area.label;
    button.addEventListener("click", () => changeArea(area.id), { signal });
    areaButtons.set(area.id, button);
    rail.append(button);
  }

  function updateTabs(): void {
    const tabs = requireElement<HTMLElement>("ws-module-tabs");
    const items = modulesForArea(navigation.area);
    const existing = Array.from(tabs.querySelectorAll<HTMLButtonElement>("[data-workspace-module]"));
    const sameArea = existing.length === items.length &&
      existing.every((button, index) => button.dataset.workspaceModule === items[index].id);
    if (!sameArea) {
      tabs.replaceChildren();
      for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.workspaceModule = item.id;
        button.classList.add("nz-button", "nz-button-secondary");
        button.textContent = item.label;
        button.setAttribute("aria-controls", item.id);
        button.addEventListener("click", () => showModule(item.id), { signal });
        tabs.append(button);
      }
    }
    for (const button of Array.from(tabs.querySelectorAll<HTMLButtonElement>("[data-workspace-module]"))) {
      const selected = navigation.module === button.dataset.workspaceModule;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-expanded", String(selected));
    }
    // A single-module area still needs its tab to reopen a closed panel.
    tabs.hidden = items.length === 0;
  }

  function renderNavigation(): void {
    const activeArea = navigation.area;
    const activeModule = navigation.module;

    for (const [name, button] of areaButtons) {
      const selected = name === activeArea;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    }
    requireElement("ws-tools-title").textContent = "OUTILS · " +
      (WORKSPACE_AREAS.find((item) => item.id === activeArea)?.label.toUpperCase() ?? "MONDE");
    reflectPanelVisibility();
    const isDebug = activeArea === "debug";
    moduleHost.hidden = isDebug || !activeModule;
    for (const [id, panel] of modules) panel.hidden = isDebug || activeModule !== id;
    requireElement("ws-debug-panel").hidden = !isDebug;
    if (isDebug) {
      requireElement("ws-debug-controls").append(...DEBUG_CONTROLS.map((id) =>
        requireElement<HTMLInputElement>(id).closest("label")!));
    }
    requireElement<HTMLButtonElement>("ws-debug-toggle")
      .setAttribute("aria-pressed", String(isDebug && panelState.toolsOpen && editInput.checked));
    updateTabs();
  }

  function isNarrowViewport(): boolean {
    return window.matchMedia("(max-width: 760px)").matches;
  }

  function reflectPanelVisibility(): void {
    toolsDock.hidden = !panelState.toolsOpen;
    app.classList.toggle("ws-inspector-collapsed", !panelState.inspectorOpen(false));
    app.classList.toggle("ws-mobile-inspector-open", panelState.inspectorOpen(true));
    requireElement<HTMLButtonElement>("ws-inspector-open")
      .setAttribute("aria-expanded", String(panelState.inspectorOpen(isNarrowViewport())));
    requireElement<HTMLButtonElement>("ws-tools-toggle")
      .setAttribute("aria-expanded", String(panelState.toolsOpen && editInput.checked));
  }

  function setToolsOpen(open: boolean): void {
    panelState.setToolsOpen(open, isNarrowViewport());
    renderNavigation();
  }

  function closeTools(): void {
    setToolsOpen(false);
    requireElement<HTMLButtonElement>("ws-tools-toggle").focus();
  }

  function showModule(id: WorkspaceModuleId): void {
    navigation.showModule(id);
    setToolsOpen(true);
  }

  function changeArea(area: WorkspaceArea): void {
    navigation.changeArea(area);
    setToolsOpen(true);
  }

  function openModuleInArea(area: WorkspaceArea, module: WorkspaceModuleId): void {
    navigation.changeArea(area);
    navigation.showModule(module);
    setToolsOpen(true);
  }

  function setLeftTab(tab: "scene" | "catalog"): void {
    requireElement<HTMLElement>("ws-scene-pane").hidden = tab !== "scene";
    requireElement<HTMLElement>("ws-catalog-pane").hidden = tab !== "catalog";
    for (const [id, value] of [["ws-scene-tab", "scene"], ["ws-catalog-tab", "catalog"]]) {
      const button = requireElement<HTMLButtonElement>(id);
      button.classList.toggle("is-active", tab === value);
      button.setAttribute("aria-pressed", String(tab === value));
    }
    if (tab === "scene") renderSceneTree();
  }

  function selectedEntries() { return editor.getSelection(); }

  function sceneEntries(map: MapDefinition): {
    name: string;
    entries: { id: string; label: string; kind?: SelectionKind }[];
  }[] {
    const groups = new Map<string, { id: string; label: string; kind?: SelectionKind }[]>();
    const add = (group: string, id: string, label: string, kind?: SelectionKind) => {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push({ id, label, kind });
    };
    add("Terrain", "terrain", map.name);
    for (const item of map.prefabs ?? []) {
      const group = item.layer ?? (maps.world?.assets.prefabs?.[item.prefab]?.category === "architecture"
        ? "Architecture" : "Mobilier");
      add(group, item.id, maps.world?.assets.prefabs?.[item.prefab]?.name ?? item.id, "prefab");
    }
    for (const item of map.objects) {
      add(item.layer ?? "Décors", item.id, maps.world?.assets.objects[item.asset]?.name ?? item.id, "object");
    }
    for (const item of map.primitives ?? []) add("Décors", item.id, item.id);
    for (const enemy of map.enemySpawns ?? []) add("Ennemis", enemy.id, enemy.id, "enemy");
    for (const item of map.interactions ?? []) add("Interactions", item.id, item.label, "interaction");
    for (const item of map.exits ?? []) add("Zones et passages", item.id, item.id);
    for (const spawn of map.spawnPoints) add("Points d'apparition", spawn.id, spawn.id);
    return [...groups].map(([name, entries]) => ({ name, entries }));
  }

  function renderSceneTree(): void {
    const map = maps.world?.definition;
    const tree = requireElement("ws-scene-tree");
    const search = requireElement<HTMLInputElement>("ws-scene-search").value.trim().toLowerCase();
    requireElement("ws-active-name").textContent = map?.name ?? "Playground";
    requireElement("ws-map-heading").textContent = map?.id ?? "Aucune map";
    requireElement("ws-status-map").textContent = map?.id ?? "Aucune map";
    requireElement("ws-left-footer-map").textContent = map
      ? map.name + " · " + map.id : "Aucune map active";
    const selectionCount = selectedEntries().length;
    requireElement("ws-status-selection").textContent = selectionCount
      ? selectionCount + " sélection(s)" : "Aucune sélection";
    requireElement<HTMLButtonElement>("ws-selection-properties").hidden = selectionCount === 0;
    contextInspector.hidden = selectionCount === 0;
    requireElement("ws-inspector-empty").hidden = selectionCount > 0;
    if (!map) {
      tree.textContent = "Aucune map chargée.";
      return;
    }
    const groups = sceneEntries(map);
    const onSelect = (kind: SelectionKind, id: string, additive: boolean) => {
      if (!editor.enabled) setEditing(true);
      editor.selectObject(kind, id, additive);
      renderSceneTree();
    };
    tree.replaceChildren(...groups.map(({ name, entries }) => ({
      name, entries: search
        ? entries.filter((item) => (item.label + " " + item.id + " " + name).toLowerCase().includes(search))
        : entries,
    })).filter(({ entries }) => entries.length > 0).map(({ name, entries }) =>
      groupDetails(name, entries, selectedEntries(), onSelect, expandedGroups)));
  }

  function setEditing(editing: boolean): void {
    // The original change event updates the UI; only refresh manually for a no-op.
    if (!setWorkspaceEditingState(editInput, editing)) reflectMode();
  }

  function reflectMode(): void {
    const editing = editInput.checked;
    app.dataset.workspaceMode = editing ? "edit" : "test";
    for (const [id, active] of [["ws-edit-mode", editing], ["ws-test-mode", !editing]] as const) {
      const button = requireElement<HTMLButtonElement>(id);
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    }
    requireElement("ws-status-mode").textContent = editing ? "Mode édition" : "Test du héros";
    requireElement<HTMLButtonElement>("ws-debug-toggle")
      .setAttribute("aria-pressed", String(editing && navigation.area === "debug" && panelState.toolsOpen));
    requireElement<HTMLButtonElement>("ws-tools-toggle")
      .setAttribute("aria-expanded", String(editing && panelState.toolsOpen));
    if (editing) {
      closeDebugDrawer();
      stage.classList.remove("ws-testing");
      requireElement("ws-debug-controls").append(...DEBUG_CONTROLS.map((id) =>
        requireElement<HTMLInputElement>(id).closest("label")!));
    } else {
      stage.classList.add("ws-testing");
      requireElement("ws-debug-test-host").append(...DEBUG_CONTROLS.map((id) =>
        requireElement<HTMLInputElement>(id).closest("label")!));
    }
    // CSS grid changes do not necessarily dispatch a window resize event.
    window.requestAnimationFrame(() => scene.getEngine().resize());
  }

  function closeDebugDrawer(): void {
    debugDrawer.hidden = true;
    requireElement<HTMLButtonElement>("ws-debug-toggle").setAttribute("aria-expanded", "false");
  }

  requireElement("ws-edit-mode").addEventListener("click", () => setEditing(true), { signal });
  requireElement("ws-test-mode").addEventListener("click", () => setEditing(false), { signal });
  editInput.addEventListener("change", reflectMode, { signal });
  requireElement("ws-debug-toggle").addEventListener("click", () => {
    if (editInput.checked) {
      changeArea("debug");
      return;
    }
    debugDrawer.hidden = !debugDrawer.hidden;
    requireElement<HTMLButtonElement>("ws-debug-toggle").setAttribute("aria-expanded",
      String(!debugDrawer.hidden));
  }, { signal });
  requireElement("ws-debug-close").addEventListener("click", closeDebugDrawer, { signal });
  requireElement("ws-tools-toggle").addEventListener("click", () => {
    if (panelState.toolsOpen) closeTools();
    else setToolsOpen(true);
  }, { signal });
  requireElement("ws-tools-close").addEventListener("click", closeTools, { signal });

  requireElement("ws-scene-tab").addEventListener("click", () => setLeftTab("scene"), { signal });
  requireElement("ws-catalog-tab").addEventListener("click", () => setLeftTab("catalog"), { signal });
  requireElement("ws-scene-search").addEventListener("input", renderSceneTree, { signal });
  requireElement("ws-selection-properties").addEventListener("click", () => {
    if (selectedEntries().length === 0) return;
    // Opening object properties must not change the selected global tool.
    panelState.setInspectorOpen(true, isNarrowViewport());
    renderNavigation();
  }, { signal });
  requireElement("ws-open-maps").addEventListener("click", () => {
    openModuleInArea("world", "mapsModule");
  }, { signal });
  requireElement("ws-open-whitebox").addEventListener("click", () => {
    openModuleInArea("world", "worldEditorModule");
    setLeftTab("catalog");
    prefabGroup?.scrollIntoView({ block: "nearest" });
  }, { signal });
  for (const [id, area, module] of [
    ["ws-open-collisions", "combat", "collisionsModule"],
    ["ws-open-attacks", "combat", "attackHitboxModule"],
    ["ws-open-map-debug", "world", "mapsModule"],
  ] as const) {
    requireElement(id).addEventListener("click", () => {
      openModuleInArea(area, module);
    }, { signal });
  }
  const inspectorToggle = requireElement<HTMLButtonElement>("ws-inspector-toggle");
  const inspectorOpen = requireElement<HTMLButtonElement>("ws-inspector-open");
  function toggleInspector(): void {
    const narrow = isNarrowViewport();
    panelState.setInspectorOpen(!panelState.inspectorOpen(narrow), narrow);
    renderNavigation();
  }
  inspectorToggle.addEventListener("click", toggleInspector, { signal });
  inspectorOpen.addEventListener("click", toggleInspector, { signal });
  requireElement("ws-explorer-toggle").addEventListener("click", () => {
    app.classList.toggle("ws-explorer-open");
    requireElement<HTMLButtonElement>("ws-explorer-toggle").setAttribute("aria-expanded",
      String(app.classList.contains("ws-explorer-open")));
  }, { signal });

  const toolButtons = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("[data-workspace-tool]"));
  function reflectTool(): void {
    for (const button of toolButtons) {
      const active = button.dataset.workspaceTool === toolSelector.value;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }
  for (const button of toolButtons) button.addEventListener("click", () => {
    toolSelector.value = button.dataset.workspaceTool ?? "select";
    toolSelector.dispatchEvent(new Event("change", { bubbles: true }));
  }, { signal });
  toolSelector.addEventListener("change", reflectTool, { signal });

  // Existing text and map statuses already track mutations from the editor
  // and map system. Observe only those text nodes; never poll the 3D scene.
  const mapStatus = requireElement<HTMLElement>("mapStatus");
  const syncMapStatus = () => {
    requireElement("ws-map-feedback").textContent = mapStatus.textContent ?? "";
  };
  const mapStatusUpdates = new MutationObserver(syncMapStatus);
  mapStatusUpdates.observe(mapStatus, { childList: true, subtree: true, characterData: true });
  syncMapStatus();
  const modelUpdates = new MutationObserver(renderSceneTree);
  for (const id of ["worldEditorStatus", "mapActiveId"]) {
    modelUpdates.observe(requireElement(id), { childList: true, subtree: true, characterData: true });
  }
  const selectionUpdates = new MutationObserver(renderSceneTree);
  selectionUpdates.observe(requireElement("worldEditorSelection"),
    { childList: true, subtree: true, characterData: true });
  const viewportResize = new ResizeObserver(() => scene.getEngine().resize());
  viewportResize.observe(stage);
  window.addEventListener("resize", reflectPanelVisibility, { signal });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "F2" || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.target instanceof HTMLElement &&
      !!event.target.closest("input, select, textarea, [contenteditable]")) return;
    event.preventDefault();
    setEditing(!editInput.checked);
  }, { signal });

  renderNavigation();
  setLeftTab("scene");
  reflectTool();
  setEditing(true);
  signal.addEventListener("abort", () => {
    modelUpdates.disconnect();
    mapStatusUpdates.disconnect();
    selectionUpdates.disconnect();
    viewportResize.disconnect();
  }, { once: true });
}
