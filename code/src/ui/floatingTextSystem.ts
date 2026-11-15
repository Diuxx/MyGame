import { Matrix, Vector3, type Scene, type TransformNode } from '@babylonjs/core';
import type { DamageResolved, Position } from '../combat/combat.ts';
import {
  actionTextStyle, createFloatingTextConfig, type ActionSplashId, type FloatingTextConfig, type FloatingTextStyle,
} from './floatingTextConfig.ts';
import { floatingTextFrame } from './floatingTextAnimation.ts';

interface ActiveText {
  ownerId: string;
  category: 'action' | 'damage';
  element: HTMLSpanElement;
  position: () => Position | undefined;
  style: FloatingTextStyle;
  elapsedMs: number;
  offsetX: number;
  offsetY: number;
}

/**
 * A single non-interactive DOM overlay projected from Babylon world positions.
 * No GUI dependency or per-message timer; the scene owns its lifetime.
 */
export function createFloatingTextSystem(
  scene: Scene, canvas: HTMLCanvasElement, initial?: FloatingTextConfig,
) {
  const stage = canvas.parentElement;
  if (!stage) throw new Error('Floating text requires a canvas parent element.');
  const layer = document.createElement('div');
  layer.className = 'floating-text-layer';
  layer.setAttribute('aria-hidden', 'true');
  stage.appendChild(layer);
  const identity = Matrix.Identity();
  const entries: ActiveText[] = [];
  let config = createFloatingTextConfig(initial);
  let disposed = false;

  function remove(entry: ActiveText): void {
    const index = entries.indexOf(entry);
    if (index !== -1) entries.splice(index, 1);
    entry.element.remove();
  }

  function clear(): void {
    while (entries.length) remove(entries[entries.length - 1]);
  }

  function show(
    ownerId: string, category: ActiveText['category'], message: string,
    position: () => Position | undefined, style: FloatingTextStyle,
  ): void {
    if (disposed || !config.enabled || !message) return;
    if ((category === 'action' && !config.actions.enabled) ||
        (category === 'damage' && !config.damage.enabled)) return;

    const owned = entries.filter((entry) => entry.ownerId === ownerId);
    if (owned.length >= config.limits.maxPerEntity) remove(owned[0]);
    if (entries.length >= config.limits.maxVisible) remove(entries[0]);

    const element = document.createElement('span');
    element.className = 'floating-text';
    if (category === 'action' && style === config.actions.styles.movement) {
      element.classList.add('floating-text-movement');
    }
    element.textContent = message;
    element.style.color = style.color;
    element.style.fontSize = style.fontSize + 'px';
    layer.appendChild(element);

    const offset = owned.length % 5;
    entries.push({
      ownerId, category, element, position,
      style: { ...style }, elapsedMs: 0,
      offsetX: (offset - 2) * 12,
      offsetY: Math.floor(owned.length / 5) * 18,
    });
  }

  function showAction(actorId: string, id: string, root: TransformNode): void {
    if (!Object.prototype.hasOwnProperty.call(config.actions.labels, id)) return;
    const label = config.actions.labels[id as ActionSplashId];
    show(actorId, 'action', label, () => {
      if (root.isDisposed()) return;
      const world = root.getAbsolutePosition();
      return [world.x, world.y + config.actions.anchorHeight, world.z];
    }, actionTextStyle(config, id as ActionSplashId));
  }

  function showDamage(event: DamageResolved): void {
    if (!Number.isFinite(event.finalDamage) || event.finalDamage < 0 ||
        (event.finalDamage === 0 && !config.damage.showZero)) return;
    const value = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(event.finalDamage);
    const message = value + (event.isCritical ? '!' : '') +
      (event.isCritical && config.damage.showCriticalLabel ? ' CRITICAL' : '');
    const point: Position = [...event.hitPosition];
    show(event.targetId, 'damage', message, () => point,
      event.isCritical ? config.damage.critical : config.damage.normal);
  }

  function update(): void {
    if (disposed || document.hidden || !entries.length) return;
    const camera = scene.activeCamera;
    if (!camera) return;
    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    if (width <= 0 || height <= 0) return;
    const viewport = camera.viewport.toGlobal(width, height);
    const matrix = scene.getTransformMatrix();
    const deltaMs = Math.min(100, Math.max(0, engine.getDeltaTime()));

    for (const entry of [...entries]) {
      entry.elapsedMs += deltaMs;
      const frame = floatingTextFrame(entry.elapsedMs, entry.style);
      if (frame.expired) { remove(entry); continue; }
      const position = entry.position();
      if (!position) { remove(entry); continue; }
      const screen = Vector3.Project(
        new Vector3(...position), identity, matrix, viewport,
      );
      const x = screen.x * canvas.clientWidth / width;
      const y = screen.y * canvas.clientHeight / height;
      const visible = screen.z > 0 && screen.z < 1 &&
        x >= 0 && x <= canvas.clientWidth && y >= 0 && y <= canvas.clientHeight;
      entry.element.hidden = !visible;
      if (!visible) continue;
      entry.element.style.left = x + 'px';
      entry.element.style.top = y + 'px';
      entry.element.style.opacity = String(frame.alpha);
      entry.element.style.transform = 'translate(-50%, -50%) translate(' +
        entry.offsetX + 'px, ' + (-frame.risePixels - entry.offsetY) + 'px) scale(' + frame.scale + ')';
    }
  }

  const observer = scene.onBeforeRenderObservable.add(update);

  function updateConfig(next: FloatingTextConfig): void {
    config = createFloatingTextConfig(next);
    for (const entry of [...entries]) {
      if (!config.enabled || (entry.category === 'action' && !config.actions.enabled) ||
          (entry.category === 'damage' && !config.damage.enabled)) remove(entry);
    }
    while (entries.length > config.limits.maxVisible) remove(entries[0]);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (observer) scene.onBeforeRenderObservable.remove(observer);
    clear();
    layer.remove();
  }

  scene.onDisposeObservable.addOnce(dispose);
  return {
    showAction, showDamage, updateConfig,
    getConfig: () => createFloatingTextConfig(config),
    dispose,
  };
}
