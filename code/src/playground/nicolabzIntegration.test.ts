import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const packageJson = JSON.parse(read("../../package.json")) as {
  dependencies: Record<string, string>;
};
const lock = JSON.parse(read("../../package-lock.json")) as {
  packages: Record<string, { resolved?: string; version?: string; dependencies?: Record<string, string> }>;
};
const html = read("../../index.html");
const entry = read("../main.ts");
const workspace = read("./workspace.ts");
const iconAdapter = read("./nicolabzIcons.ts");
const skin = read("./nicolabzWorkspace.css");
const favicon = read("../../public/favicon.svg");

test("Nicolabz is pinned to an immutable GitHub commit in both npm manifests", () => {
  const dependency = packageJson.dependencies["@nicolabz/design-system"];
  assert.match(dependency, /^git\+https:\/\/github.com\/Diuxx\/nicolabz-design-system.git#[0-9a-f]{40}$/);
  assert.equal(lock.packages[""].dependencies?.["@nicolabz/design-system"], dependency);
  assert.equal(lock.packages["node_modules/@nicolabz/design-system"].resolved, dependency);
  assert.equal(lock.packages["node_modules/@nicolabz/design-system"].version, "0.4.0");
});

test("Playground requests Soft Spectrum before paint and does not use theme preferences", () => {
  assert.ok(html.includes('const runtimeMode = "%MODE%"'));
  assert.ok(html.includes('runtimeMode === "gameplay" ? "dark" : "light"'));
  assert.ok(html.includes(':root[data-theme="light"] #loadingOverlay'));
  assert.ok(entry.includes('document.documentElement.dataset.theme = mode === "playground" ? "light" : "dark"'));
  assert.ok(entry.includes('await import("@nicolabz/design-system/theme.css")'));
  assert.ok(entry.includes('await import("@nicolabz/design-system/components.css")'));
  assert.ok(entry.includes('await import("@nicolabz/design-system/icons.css")'));
  assert.ok(entry.includes('if (mode === "playground") await import("./playground/nicolabzWorkspace.css")'));
  assert.ok(!entry.includes('design-system/theme.js'));
  assert.ok(!entry.includes('nicolabzTheme'));
});

test("Nicolabz classes are additive and keep the existing form identities", () => {
  assert.ok(html.includes('id="enemySubmit" class="secondary nz-button nz-button-primary'));
  assert.ok(html.includes('id="worldEditorExport" class="secondary nz-button nz-button-primary'));
  assert.ok(html.includes('ws-form-section nz-accordion'));
  assert.ok(html.includes('id="worldEditorAdvancedFields"'));
  assert.ok(html.includes('id="enemyAdvancedSettings"'));
  assert.ok(workspace.includes('panel.classList.add("ws-existing-module", "nz-form-panel")'));
});

test("Icons are bundled from the shared SVG sprite, without an extra icon library", () => {
  assert.ok(iconAdapter.includes('@nicolabz/design-system/icons.svg?url'));
  assert.ok(iconAdapter.includes('createElementNS(namespace, "svg")'));
  assert.ok(iconAdapter.includes('svg.setAttribute("aria-hidden", "true")'));
  assert.ok(workspace.includes("createNicolabzIcon(AREA_ICONS[area.id])"));
});

test("Light workspace uses semantic tokens without restyling the Babylon viewport or HUD", () => {
  assert.ok(skin.includes("var(--color-background)"));
  assert.ok(skin.includes("var(--color-surface)"));
  assert.ok(skin.includes("var(--color-text)"));
  assert.ok(skin.includes("var(--color-control-border)"));
  assert.ok(!skin.includes(".hero-hud"));
  assert.ok(!skin.includes("#renderCanvas"));
  assert.ok(!skin.includes("localStorage"));
});

test("project branding uses the Nicolabz shield and the browser favicon", () => {
  // A missing DOM id previously prevented the entire Playground from starting.
  assert.ok(workspace.includes('<div id="ws-logo" class="ws-logo" aria-hidden="true"></div>'));
  assert.ok(workspace.includes('requireElement("ws-logo").append(createNicolabzIcon("shield"))'));
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'));
  assert.match(favicon, /<svg[^>]*viewBox="0 0 48 48"/);
  assert.ok(favicon.includes("<title>MyGame — bouclier</title>"));
  assert.ok(skin.includes(".workspace-app .ws-logo .nz-icon"));
});

test("the redundant header menu is removed and mobile explorer remains accessible", () => {
  const top = workspace.slice(workspace.indexOf('const top = surface('), workspace.indexOf('const toolbar = surface('));
  const rail = workspace.slice(workspace.indexOf('const rail = surface('), workspace.indexOf('const left = surface('));
  assert.ok(!top.includes('ws-explorer-toggle'));
  assert.ok(rail.includes('id="ws-explorer-toggle"'));
  assert.ok(rail.includes('aria-controls="ws-left"'));
  assert.ok(workspace.includes('setNicolabzButtonIcon(requireElement<HTMLButtonElement>(id), icon, label)'));
  assert.ok(workspace.includes('app.classList.toggle("ws-explorer-open")'));
  assert.ok(skin.includes("max-width: 1020px"));
  assert.ok(skin.includes(".workspace-app .ws-rail .ws-explorer-toggle"));
});

test("workspace startup references existing static DOM IDs", () => {
  const declaredIds = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g), ...workspace.matchAll(/\bid="([^"]+)"/g)]
      .map((match) => match[1]),
  );
  const referencedIds = [...workspace.matchAll(/requireElement(?:<[^>]+>)?\("([^"]+)"\)/g)]
    .map((match) => match[1]);
  const missingIds = referencedIds.filter((id) => !declaredIds.has(id));
  assert.deepEqual(missingIds, [], "Every statically requested workspace element must exist");
});
