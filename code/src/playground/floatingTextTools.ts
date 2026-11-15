import type { TransformNode } from '@babylonjs/core';
import type { createFloatingTextSystem } from '../ui/floatingTextSystem.ts';
import { createFloatingTextConfig, saveFloatingTextConfig } from '../ui/floatingTextConfig.ts';
import { requireElement } from '../ui/dom.ts';

type FloatingText = ReturnType<typeof createFloatingTextSystem>;

export function bindFloatingTextTools(
  floating: FloatingText, hero: TransformNode, signal: AbortSignal,
): void {
  const status = requireElement<HTMLElement>('floatingTextStatus');
  let config = floating.getConfig();

  function apply(): void {
    floating.updateConfig(config);
    try {
      saveFloatingTextConfig(config);
      status.textContent = 'Réglages enregistrés.';
    } catch (error) {
      status.textContent = 'Réglages appliqués, mais stockage indisponible.';
      console.warn('Cannot save floating text settings:', error);
    }
  }

  function checkbox(id: string, read: () => boolean, write: (value: boolean) => void): void {
    const element = requireElement<HTMLInputElement>(id);
    element.checked = read();
    element.addEventListener('change', () => { write(element.checked); apply(); }, { signal });
  }

  function range(id: string, read: () => number, write: (value: number) => void): void {
    const element = requireElement<HTMLInputElement>(id);
    element.value = String(read());
    const output = requireElement<HTMLOutputElement>(id + 'Value');
    function update(): void {
      output.value = element.value;
    }
    update();
    element.addEventListener('input', () => {
      write(element.valueAsNumber);
      update();
      apply();
    }, { signal });
  }

  function color(id: string, read: () => string, write: (value: string) => void): void {
    const element = requireElement<HTMLInputElement>(id);
    element.value = read();
    element.addEventListener('input', () => { write(element.value); apply(); }, { signal });
  }

  function bindInputs(): void {
    checkbox('floatingTextEnabled', () => config.enabled, (v) => { config.enabled = v; });
    checkbox('floatingActionsEnabled', () => config.actions.enabled, (v) => { config.actions.enabled = v; });
    checkbox('floatingDamageEnabled', () => config.damage.enabled, (v) => { config.damage.enabled = v; });
    range('floatingActionDuration', () => config.actions.style.durationMs, (v) => { config.actions.style.durationMs = v; });
    range('floatingDamageDuration', () => config.damage.normal.durationMs, (v) => { config.damage.normal.durationMs = v; });
    range('floatingActionSize', () => config.actions.style.fontSize, (v) => { config.actions.style.fontSize = v; });
    range('floatingDamageSize', () => config.damage.normal.fontSize, (v) => { config.damage.normal.fontSize = v; });
    range('floatingTextRise', () => config.actions.style.risePixels, (v) => { config.actions.style.risePixels = v; });
    range('floatingTextScale', () => config.actions.style.scaleEnd, (v) => { config.actions.style.scaleEnd = v; });
    color('floatingNormalColor', () => config.damage.normal.color, (v) => { config.damage.normal.color = v; });
    color('floatingCriticalColor', () => config.damage.critical.color, (v) => { config.damage.critical.color = v; });
  }

  // Rebinding input listeners would duplicate handlers. Reset their values directly.
  function resetControls(): void {
    const controls: Record<string, string | number | boolean> = {
      floatingTextEnabled: config.enabled, floatingActionsEnabled: config.actions.enabled,
      floatingDamageEnabled: config.damage.enabled,
      floatingActionDuration: config.actions.style.durationMs,
      floatingDamageDuration: config.damage.normal.durationMs,
      floatingActionSize: config.actions.style.fontSize,
      floatingDamageSize: config.damage.normal.fontSize,
      floatingTextRise: config.actions.style.risePixels,
      floatingTextScale: config.actions.style.scaleEnd,
      floatingNormalColor: config.damage.normal.color,
      floatingCriticalColor: config.damage.critical.color,
    };
    for (const [id, value] of Object.entries(controls)) {
      const field = requireElement<HTMLInputElement>(id);
      if (typeof value === 'boolean') field.checked = value;
      else field.value = String(value);
      const output = document.getElementById(id + 'Value') as HTMLOutputElement | null;
      if (output) output.value = String(value);
    }
  }

  bindInputs();
  const test = (id: string, fn: () => void) =>
    requireElement<HTMLButtonElement>(id).addEventListener('click', fn, { signal });
  test('floatingTestAttack', () => floating.showAction('hero', 'attack', hero));
  test('floatingTestDodge', () => floating.showAction('hero', 'dodge', hero));
  test('floatingTestDamage', () => previewDamage(120, false));
  test('floatingTestCritical', () => previewDamage(240, true));
  test('floatingTextReset', () => {
    config = createFloatingTextConfig();
    resetControls();
    apply();
  });

  function previewDamage(finalDamage: number, isCritical: boolean): void {
    const origin = hero.getAbsolutePosition();
    floating.showDamage({
      targetId: 'floating-preview', finalDamage, isCritical,
      hitPosition: [origin.x + 0.9, origin.y + 1.2, origin.z + 0.5],
    });
  }
}
