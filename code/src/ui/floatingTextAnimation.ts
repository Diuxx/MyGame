import type { FloatingTextStyle } from './floatingTextConfig.ts';

export interface FloatingTextFrame {
  alpha: number;
  scale: number;
  risePixels: number;
  expired: boolean;
}

/** Stateless animation curve: several independent messages share one render loop. */
export function floatingTextFrame(elapsedMs: number, style: FloatingTextStyle): FloatingTextFrame {
  const progress = Math.max(0, Math.min(1, elapsedMs / style.durationMs));
  const fadeIn = Math.min(1, progress / 0.12);
  const fadeOut = Math.min(1, (1 - progress) / 0.35);
  return {
    alpha: Math.min(fadeIn, fadeOut),
    scale: 1 + (style.scaleEnd - 1) * Math.min(1, progress / 0.35),
    risePixels: style.risePixels * (1 - (1 - progress) * (1 - progress)),
    expired: elapsedMs >= style.durationMs,
  };
}
