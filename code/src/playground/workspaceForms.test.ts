import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

function between(start: string, end: string): string {
  const begin = html.indexOf(start);
  assert.ok(begin >= 0, `Repère HTML manquant : ${start}`);
  const finish = html.indexOf(end, begin);
  assert.ok(finish > begin, `Fermeture HTML manquante après ${start}`);
  return html.slice(begin, finish);
}

test("workspace form changes keep unique control IDs", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["worldEditorX", "worldEditorFields", "enemyForm", "enemyMaxHealth",
    "enemyCollisionRadius", "lightingSunShadows", "targetLockEnabled",
    "floatingTextExport", "worldEditorDraftState", "worldEditorExport"]) {
    assert.ok(ids.includes(id), `Contrôle HTML supprimé : ${id}`);
  }
});

test("required enemy advanced inputs stay inside the original form", () => {
  const form = between('<form id="enemyForm">', "</form>");
  const advanced = between('<details id="enemyAdvancedSettings"', "</details>");
  for (const id of ["enemyCollisionRadius", "enemyRegenDelay", "enemyRegenRate"]) {
    assert.match(advanced, new RegExp(`id="${id}"[^>]*required`));
    assert.ok(form.includes(`id="${id}"`));
  }
});

test("inspector transforms remain prominent and technical fields are collapsible", () => {
  const inspector = between('<div id="worldEditorFields" hidden>', '<button id="worldEditorExport"');
  assert.ok(inspector.indexOf("Position et rotation") < inspector.indexOf("worldEditorAdvancedFields"));
  assert.match(inspector, /<details class="ws-form-section nz-accordion" id="worldEditorAdvancedFields">/);
  assert.match(inspector, /id="worldEditorObjectFields"/);
  assert.match(inspector, /id="worldEditorEnemyFields"/);
});

test("local drafts, map downloads and configuration files are separate", () => {
  const local = between('<details class="ws-form-section nz-accordion"><summary>Brouillon local', "</details>");
  assert.match(local, /id="worldEditorSaveDraft"/);
  assert.match(local, /id="worldEditorRestoreDraft"/);
  assert.match(html, /id="worldEditorExport"[^>]*>Télécharger la map JSON/);
  assert.match(html, /id="enemySave"[^>]*>Sauver localement/);
  for (const name of ["ANIMATIONS.json", "TARGETING.json", "FLOATING_TEXT.json"]) {
    assert.ok(html.includes(`Télécharger ${name}`));
  }
});
