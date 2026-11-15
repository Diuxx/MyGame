import type { TransformNode } from '@babylonjs/core';
import type { createFloatingTextSystem } from '../ui/floatingTextSystem.ts';
import {
  createFloatingTextConfig, FLOATING_TEXT_SETTINGS_KEY, parseFloatingTextManifest,
  resetPlaygroundFloatingTextConfig, savePlaygroundFloatingTextConfig,
  serializeFloatingTextManifest,
} from '../ui/floatingTextConfig.ts';
import { downloadJson, requireElement } from '../ui/dom.ts';

type FloatingText = ReturnType<typeof createFloatingTextSystem>;

export function bindFloatingTextTools(
  floating: FloatingText, hero: TransformNode, signal: AbortSignal,
): void {
  const status = requireElement<HTMLElement>('floatingTextStatus');
  const source = requireElement<HTMLElement>('floatingTextConfigSource');
  let config = floating.getConfig();
  const refreshControls: Array<() => void> = [];

  function setSource(local: boolean): void {
    source.textContent = local
      ? 'Source : réglages temporaires du Playground · exporter pour les versionner.'
      : 'Source : code/FLOATING_TEXT.json · valeurs versionnées.';
  }

  function apply(): boolean {
    floating.updateConfig(config);
    setSource(true);
    try {
      savePlaygroundFloatingTextConfig(config);
      status.textContent = 'Réglages appliqués et enregistrés localement.';
      return true;
    } catch (error) {
      status.textContent = 'Réglages appliqués pour cette session, mais stockage indisponible.';
      console.warn('Cannot save floating text settings:', error);
      return false;
    }
  }

  function checkbox(id: string, read: () => boolean, write: (value: boolean) => void): void {
    const element = requireElement<HTMLInputElement>(id);
    refreshControls.push(() => { element.checked = read(); });
    element.addEventListener('change', () => { write(element.checked); apply(); }, { signal });
  }

  function range(id: string, read: () => number, write: (value: number) => void): void {
    const element = requireElement<HTMLInputElement>(id);
    const output = requireElement<HTMLOutputElement>(id + 'Value');
    refreshControls.push(() => {
      element.value = String(read());
      output.value = element.value;
    });
    element.addEventListener('input', () => {
      write(element.valueAsNumber);
      output.value = element.value;
      apply();
    }, { signal });
  }

  function color(id: string, read: () => string, write: (value: string) => void): void {
    const element = requireElement<HTMLInputElement>(id);
    refreshControls.push(() => { element.value = read(); });
    element.addEventListener('input', () => { write(element.value); apply(); }, { signal });
  }

  checkbox('floatingTextEnabled', () => config.enabled, (v) => { config.enabled = v; });
  checkbox('floatingActionsEnabled', () => config.actions.enabled, (v) => { config.actions.enabled = v; });
  checkbox('floatingDamageEnabled', () => config.damage.enabled, (v) => { config.damage.enabled = v; });

  range('floatingMovementDuration', () => config.actions.styles.movement.durationMs,
    (v) => { config.actions.styles.movement.durationMs = v; });
  range('floatingMovementSize', () => config.actions.styles.movement.fontSize,
    (v) => { config.actions.styles.movement.fontSize = v; });
  range('floatingMovementRise', () => config.actions.styles.movement.risePixels,
    (v) => { config.actions.styles.movement.risePixels = v; });
  range('floatingMovementScale', () => config.actions.styles.movement.scaleEnd,
    (v) => { config.actions.styles.movement.scaleEnd = v; });
  color('floatingMovementColor', () => config.actions.styles.movement.color,
    (v) => { config.actions.styles.movement.color = v; });

  range('floatingAttackDuration', () => config.actions.styles.attack.durationMs,
    (v) => { config.actions.styles.attack.durationMs = v; });
  range('floatingAttackSize', () => config.actions.styles.attack.fontSize,
    (v) => { config.actions.styles.attack.fontSize = v; });
  range('floatingAttackRise', () => config.actions.styles.attack.risePixels,
    (v) => { config.actions.styles.attack.risePixels = v; });
  range('floatingAttackScale', () => config.actions.styles.attack.scaleEnd,
    (v) => { config.actions.styles.attack.scaleEnd = v; });
  color('floatingAttackColor', () => config.actions.styles.attack.color,
    (v) => { config.actions.styles.attack.color = v; });

  range('floatingDamageDuration', () => config.damage.normal.durationMs,
    (v) => { config.damage.normal.durationMs = v; });
  range('floatingDamageSize', () => config.damage.normal.fontSize,
    (v) => { config.damage.normal.fontSize = v; });
  color('floatingNormalColor', () => config.damage.normal.color,
    (v) => { config.damage.normal.color = v; });
  color('floatingCriticalColor', () => config.damage.critical.color,
    (v) => { config.damage.critical.color = v; });

  function refresh(): void {
    floating.updateConfig(config);
    for (const update of refreshControls) update();
  }

  refresh();
  try {
    setSource(localStorage.getItem(FLOATING_TEXT_SETTINGS_KEY) !== null);
  } catch (error) {
    console.warn('Cannot inspect floating text local settings:', error);
    setSource(false);
  }

  const test = (id: string, callback: () => void): void => {
    requireElement<HTMLButtonElement>(id).addEventListener('click', callback, { signal });
  };
  test('floatingTestWalk', () => floating.showAction('hero', 'walk', hero));
  test('floatingTestSprint', () => floating.showAction('hero', 'sprint', hero));
  test('floatingTestDodge', () => floating.showAction('hero', 'dodge', hero));
  test('floatingTestAttack', () => floating.showAction('hero', 'attack', hero));
  test('floatingTestDamage', () => previewDamage(120, false));
  test('floatingTestCritical', () => previewDamage(240, true));

  function previewDamage(finalDamage: number, isCritical: boolean): void {
    const origin = hero.getAbsolutePosition();
    floating.showDamage({
      targetId: 'floating-preview', finalDamage, isCritical,
      hitPosition: [origin.x + 0.9, origin.y + 1.2, origin.z + 0.5],
    });
  }

  test('floatingTextExport', () => {
    downloadJson('FLOATING_TEXT.json', serializeFloatingTextManifest(config));
    status.textContent = 'Fichier exporté : remplacer code/FLOATING_TEXT.json pour versionner les changements.';
  });

  requireElement<HTMLButtonElement>('floatingTextCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(serializeFloatingTextManifest(config));
      status.textContent = 'JSON complet copié. Tu peux le coller dans code/FLOATING_TEXT.json.';
    } catch (error) {
      status.textContent = 'Copie impossible : utiliser le bouton Exporter JSON.';
      console.warn('Cannot copy floating text JSON:', error);
    }
  }, { signal });

  const importFile = requireElement<HTMLInputElement>('floatingTextImportFile');
  test('floatingTextImport', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      if (file.size > 128 * 1024) throw new Error('Fichier JSON trop volumineux.');
      config = parseFloatingTextManifest(JSON.parse(await file.text()));
      const saved = apply();
      refresh();
      status.textContent = saved
        ? 'Configuration importée pour le Playground. Exporter pour la versionner.'
        : 'Configuration importée pour cette session seulement : stockage indisponible.';
    } catch (error) {
      status.textContent = 'Import refusé : ' + (error instanceof Error ? error.message : String(error));
    } finally {
      importFile.value = '';
    }
  }, { signal });

  test('floatingTextReset', () => {
    config = createFloatingTextConfig();
    refresh();
    try {
      resetPlaygroundFloatingTextConfig();
      setSource(false);
      status.textContent = 'Configuration versionnée restaurée. Surcharges locales effacées.';
    } catch (error) {
      setSource(true);
      status.textContent = 'Valeurs restaurées pour cette session, mais nettoyage local impossible.';
      console.warn('Cannot reset local floating text settings:', error);
    }
  });
}
