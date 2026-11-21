import assert from "node:assert/strict";
import test from "node:test";
import { describeJsonExport, describeLocalSave } from "./workspacePersistence.ts";

test("map downloads never imply that the repository was saved", () => {
  const message = describeJsonExport("my-map-edited.json");
  assert.match(message, /Téléchargement demandé : my-map-edited.json/);
  assert.match(message, /dépôt Git n'a pas été modifié/);
  assert.doesNotMatch(message, /sauvegardé dans le projet/);
});

test("configuration downloads identify the integration destination", () => {
  const message = describeJsonExport("ANIMATIONS.json", "code/ANIMATIONS.json");
  assert.match(message, /intégrer manuellement/);
  assert.match(message, /code\/ANIMATIONS.json/);
  assert.match(message, /dépôt Git n'a pas été modifié/);
});

test("local drafts are explicitly browser-only for every action", () => {
  for (const action of ["saved", "restored", "removed"] as const) {
    const message = describeLocalSave("Brouillon de map", action);
    assert.match(message, /ce navigateur/);
    assert.match(message, /Aucun fichier du projet n'a été modifié/);
  }
});

test("local enemy snapshots are not presented as map exports", () => {
  const message = describeLocalSave("Instances d'entraînement", "saved");
  assert.match(message, /Instances d'entraînement/);
  assert.match(message, /ce navigateur/);
  assert.doesNotMatch(message, /JSON exporté/);
});
