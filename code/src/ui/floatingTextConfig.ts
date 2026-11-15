export type ActionSplashId = 'attack' | 'dodge' | 'walk' | 'sprint';

export interface FloatingTextStyle {
  durationMs: number;
  fontSize: number;
  scaleEnd: number;
  risePixels: number;
  color: string;
}

export interface FloatingTextConfig {
  enabled: boolean;
  actions: {
    enabled: boolean;
    anchorHeight: number;
    labels: Record<ActionSplashId, string>;
    style: FloatingTextStyle;
  };
  damage: {
    enabled: boolean;
    showZero: boolean;
    showCriticalLabel: boolean;
    normal: FloatingTextStyle;
    critical: FloatingTextStyle;
  };
  limits: {
    maxVisible: number;
    maxPerEntity: number;
  };
}

export const FLOATING_TEXT_SETTINGS_KEY = 'mon-rpg.playground.floating-text.v1';
export const FLOATING_TEXT_PREFERENCE_KEY = 'mon-rpg.settings.floating-text-enabled';

const DEFAULTS: FloatingTextConfig = {
  enabled: true,
  actions: {
    enabled: true,
    anchorHeight: 2.05,
    labels: { attack: 'ATTACK', dodge: 'DODGE', walk: 'WALK', sprint: 'SPRINT' },
    style: { durationMs: 900, fontSize: 18, scaleEnd: 1.2, risePixels: 35, color: '#FFE0A1' },
  },
  damage: {
    enabled: true,
    showZero: false,
    showCriticalLabel: false,
    normal: { durationMs: 1100, fontSize: 24, scaleEnd: 1.15, risePixels: 45, color: '#FFFFFF' },
    critical: { durationMs: 1250, fontSize: 30, scaleEnd: 1.35, risePixels: 55, color: '#FFCA65' },
  },
  limits: { maxVisible: 40, maxPerEntity: 6 },
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function style(value: unknown, fallback: FloatingTextStyle): FloatingTextStyle {
  const saved = record(value);
  return {
    durationMs: bounded(saved.durationMs, fallback.durationMs, 150, 4000),
    fontSize: bounded(saved.fontSize, fallback.fontSize, 10, 72),
    scaleEnd: bounded(saved.scaleEnd, fallback.scaleEnd, 1, 2.5),
    risePixels: bounded(saved.risePixels, fallback.risePixels, 0, 160),
    color: color(saved.color, fallback.color),
  };
}

/** Validate a saved configuration before it can influence rendering or allocations. */
export function createFloatingTextConfig(value?: unknown): FloatingTextConfig {
  const saved = record(value);
  const actions = record(saved.actions);
  const damage = record(saved.damage);
  const limits = record(saved.limits);
  const labels = record(actions.labels);
  const parsedLabels = { ...DEFAULTS.actions.labels };
  for (const key of Object.keys(parsedLabels) as ActionSplashId[]) {
    const label = labels[key];
    if (typeof label === 'string' && label.trim() && label.length <= 30) {
      parsedLabels[key] = label.trim();
    }
  }
  return {
    enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULTS.enabled,
    actions: {
      enabled: typeof actions.enabled === 'boolean' ? actions.enabled : DEFAULTS.actions.enabled,
      anchorHeight: bounded(actions.anchorHeight, DEFAULTS.actions.anchorHeight, 0.3, 6),
      labels: parsedLabels,
      style: style(actions.style, DEFAULTS.actions.style),
    },
    damage: {
      enabled: typeof damage.enabled === 'boolean' ? damage.enabled : DEFAULTS.damage.enabled,
      showZero: damage.showZero === true,
      showCriticalLabel: damage.showCriticalLabel === true,
      normal: style(damage.normal, DEFAULTS.damage.normal),
      critical: style(damage.critical, DEFAULTS.damage.critical),
    },
    limits: {
      maxVisible: Math.round(bounded(limits.maxVisible, DEFAULTS.limits.maxVisible, 1, 150)),
      maxPerEntity: Math.round(bounded(limits.maxPerEntity, DEFAULTS.limits.maxPerEntity, 1, 30)),
    },
  };
}

/** Playground tuning and the player's global display preference use separate keys. */
export function loadFloatingTextConfig(): FloatingTextConfig {
  let saved: unknown;
  let preference: string | null = null;
  try {
    const stored = localStorage.getItem(FLOATING_TEXT_SETTINGS_KEY);
    saved = stored ? JSON.parse(stored) : undefined;
    preference = localStorage.getItem(FLOATING_TEXT_PREFERENCE_KEY);
  } catch (error) {
    console.warn('Floating text settings could not be loaded:', error);
  }
  const config = createFloatingTextConfig(saved);
  if (preference === 'true' || preference === 'false') config.enabled = preference === 'true';
  return config;
}

export function saveFloatingTextConfig(config: FloatingTextConfig): void {
  localStorage.setItem(FLOATING_TEXT_SETTINGS_KEY, JSON.stringify(createFloatingTextConfig(config)));
  localStorage.setItem(FLOATING_TEXT_PREFERENCE_KEY, String(config.enabled));
}
