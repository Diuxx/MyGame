import floatingTextManifest from '../../FLOATING_TEXT.json' with { type: 'json' };

export type ActionSplashId = 'attack' | 'dodge' | 'walk' | 'sprint';
export type ActionTextProfile = 'movement' | 'attack';

export interface FloatingTextStyle {
  durationMs: number;
  fontSize: number;
  scaleEnd: number;
  risePixels: number;
  color: string;
}

export interface FloatingTextConfig {
  version: 1;
  enabled: boolean;
  actions: {
    enabled: boolean;
    anchorHeight: number;
    labels: Record<ActionSplashId, string>;
    styles: Record<ActionTextProfile, FloatingTextStyle>;
  };
  damage: {
    enabled: boolean;
    showZero: boolean;
    showCriticalLabel: boolean;
    normal: FloatingTextStyle;
    critical: FloatingTextStyle;
  };
  limits: { maxVisible: number; maxPerEntity: number };
}

export const FLOATING_TEXT_SETTINGS_KEY = 'mon-rpg.playground.floating-text.v2';
export const FLOATING_TEXT_PREFERENCE_KEY = 'mon-rpg.settings.floating-text-enabled';
const ACTION_IDS: readonly ActionSplashId[] = ['walk', 'sprint', 'dodge', 'attack'];
const STYLE_LIMITS = {
  durationMs: [150, 4000],
  fontSize: [8, 72],
  scaleEnd: [1, 2.5],
  risePixels: [0, 160],
} as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FLOATING_TEXT.json · ' + field + ' : objet attendu.');
  }
  return value as Record<string, unknown>;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error('FLOATING_TEXT.json · ' + field + ' : booléen attendu.');
  return value;
}

function number(value: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
      (integer && !Number.isInteger(value))) {
    throw new Error('FLOATING_TEXT.json · ' + field + ' : nombre hors limites.');
  }
  return value;
}

function color(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error('FLOATING_TEXT.json · ' + field + ' : couleur hexadécimale attendue.');
  }
  return value;
}

function parseStyle(value: unknown, field: string): FloatingTextStyle {
  const input = object(value, field);
  return {
    durationMs: number(input.durationMs, field + '.durationMs', ...STYLE_LIMITS.durationMs),
    fontSize: number(input.fontSize, field + '.fontSize', ...STYLE_LIMITS.fontSize),
    scaleEnd: number(input.scaleEnd, field + '.scaleEnd', ...STYLE_LIMITS.scaleEnd),
    risePixels: number(input.risePixels, field + '.risePixels', ...STYLE_LIMITS.risePixels),
    color: color(input.color, field + '.color'),
  };
}

/** Validate the full versioned manifest before importing or exporting it. */
export function parseFloatingTextManifest(value: unknown): FloatingTextConfig {
  const input = object(value, 'racine');
  if (input.version !== 1) throw new Error('FLOATING_TEXT.json · version incompatible (attendu : 1).');
  const actions = object(input.actions, 'actions');
  const labels = object(actions.labels, 'actions.labels');
  const styles = object(actions.styles, 'actions.styles');
  const damage = object(input.damage, 'damage');
  const limits = object(input.limits, 'limits');
  const parsedLabels = {} as Record<ActionSplashId, string>;
  for (const id of ACTION_IDS) {
    const label = labels[id];
    if (typeof label !== 'string' || !label.trim() || label.length > 30) {
      throw new Error('FLOATING_TEXT.json · actions.labels.' + id + ' : texte invalide.');
    }
    parsedLabels[id] = label.trim();
  }
  return {
    version: 1,
    enabled: boolean(input.enabled, 'enabled'),
    actions: {
      enabled: boolean(actions.enabled, 'actions.enabled'),
      anchorHeight: number(actions.anchorHeight, 'actions.anchorHeight', 0.3, 6),
      labels: parsedLabels,
      styles: {
        movement: parseStyle(styles.movement, 'actions.styles.movement'),
        attack: parseStyle(styles.attack, 'actions.styles.attack'),
      },
    },
    damage: {
      enabled: boolean(damage.enabled, 'damage.enabled'),
      showZero: boolean(damage.showZero, 'damage.showZero'),
      showCriticalLabel: boolean(damage.showCriticalLabel, 'damage.showCriticalLabel'),
      normal: parseStyle(damage.normal, 'damage.normal'),
      critical: parseStyle(damage.critical, 'damage.critical'),
    },
    limits: {
      maxVisible: number(limits.maxVisible, 'limits.maxVisible', 1, 150, true),
      maxPerEntity: number(limits.maxPerEntity, 'limits.maxPerEntity', 1, 30, true),
    },
  };
}

const VERSIONED_CONFIG = parseFloatingTextManifest(floatingTextManifest);

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value)) : fallback;
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function optionalStyle(value: unknown, defaults: FloatingTextStyle): FloatingTextStyle {
  const input = record(value);
  return {
    durationMs: bounded(input.durationMs, defaults.durationMs, ...STYLE_LIMITS.durationMs),
    fontSize: bounded(input.fontSize, defaults.fontSize, ...STYLE_LIMITS.fontSize),
    scaleEnd: bounded(input.scaleEnd, defaults.scaleEnd, ...STYLE_LIMITS.scaleEnd),
    risePixels: bounded(input.risePixels, defaults.risePixels, ...STYLE_LIMITS.risePixels),
    color: safeColor(input.color, defaults.color),
  };
}

/** Forgiving for temporary Playground overrides; the checked-in JSON remains authoritative. */
export function createFloatingTextConfig(value?: unknown): FloatingTextConfig {
  const input = record(value);
  const actions = record(input.actions);
  const labels = record(actions.labels);
  const styles = record(actions.styles);
  const damage = record(input.damage);
  const limits = record(input.limits);
  const defaults = VERSIONED_CONFIG;
  const parsedLabels = { ...defaults.actions.labels };
  for (const id of ACTION_IDS) {
    const label = labels[id];
    if (typeof label === 'string' && label.trim() && label.length <= 30) parsedLabels[id] = label.trim();
  }
  return {
    version: 1,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : defaults.enabled,
    actions: {
      enabled: typeof actions.enabled === 'boolean' ? actions.enabled : defaults.actions.enabled,
      anchorHeight: bounded(actions.anchorHeight, defaults.actions.anchorHeight, 0.3, 6),
      labels: parsedLabels,
      styles: {
        movement: optionalStyle(styles.movement, defaults.actions.styles.movement),
        attack: optionalStyle(styles.attack, defaults.actions.styles.attack),
      },
    },
    damage: {
      enabled: typeof damage.enabled === 'boolean' ? damage.enabled : defaults.damage.enabled,
      showZero: typeof damage.showZero === 'boolean' ? damage.showZero : defaults.damage.showZero,
      showCriticalLabel: typeof damage.showCriticalLabel === 'boolean'
        ? damage.showCriticalLabel : defaults.damage.showCriticalLabel,
      normal: optionalStyle(damage.normal, defaults.damage.normal),
      critical: optionalStyle(damage.critical, defaults.damage.critical),
    },
    limits: {
      maxVisible: Math.round(bounded(limits.maxVisible, defaults.limits.maxVisible, 1, 150)),
      maxPerEntity: Math.round(bounded(limits.maxPerEntity, defaults.limits.maxPerEntity, 1, 30)),
    },
  };
}

/** Movement covers walk, sprint and dodge; attack is intentionally more legible. */
export function actionTextStyle(config: FloatingTextConfig, id: ActionSplashId): FloatingTextStyle {
  return id === 'attack' ? config.actions.styles.attack : config.actions.styles.movement;
}

function applyDisplayPreference(config: FloatingTextConfig): FloatingTextConfig {
  try {
    const preference = localStorage.getItem(FLOATING_TEXT_PREFERENCE_KEY);
    if (preference === 'true' || preference === 'false') config.enabled = preference === 'true';
  } catch (error) {
    console.warn('Floating text preference could not be loaded:', error);
  }
  return config;
}

/** Gameplay reads the committed manifest, never local Playground tuning. */
export function loadFloatingTextConfig(): FloatingTextConfig {
  return applyDisplayPreference(createFloatingTextConfig());
}

export function loadPlaygroundFloatingTextConfig(): FloatingTextConfig {
  let saved: unknown;
  try {
    const json = localStorage.getItem(FLOATING_TEXT_SETTINGS_KEY);
    if (json) saved = JSON.parse(json);
  } catch (error) {
    console.warn('Playground floating text settings could not be loaded:', error);
  }
  return applyDisplayPreference(createFloatingTextConfig(saved));
}

export function savePlaygroundFloatingTextConfig(config: FloatingTextConfig): void {
  const validated = parseFloatingTextManifest(config);
  localStorage.setItem(FLOATING_TEXT_SETTINGS_KEY, JSON.stringify(validated));
  localStorage.setItem(FLOATING_TEXT_PREFERENCE_KEY, String(validated.enabled));
}

export function resetPlaygroundFloatingTextConfig(): void {
  localStorage.removeItem(FLOATING_TEXT_SETTINGS_KEY);
  localStorage.removeItem(FLOATING_TEXT_PREFERENCE_KEY);
}

export function serializeFloatingTextManifest(config: FloatingTextConfig): string {
  return JSON.stringify(parseFloatingTextManifest(config), null, 2) + '\n';
}
