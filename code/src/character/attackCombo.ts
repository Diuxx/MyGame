import type { AttackComboSettings } from "./animationSettings.ts";

/** The request is accepted only near the playable chain window, never at arbitrary animation frames. */
export function canBufferComboInput(
  progress: number,
  durationSeconds: number,
  combo: AttackComboSettings,
  chainCount: number,
): boolean {
  if (!combo.enabled || chainCount >= combo.maxChain || !Number.isFinite(progress) ||
      !Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
  const earlyProgress = combo.inputBufferMs / (durationSeconds * 1000);
  return progress >= Math.max(0, combo.chainWindow.from - earlyProgress) &&
    progress <= combo.chainWindow.until;
}

export function canStartBufferedCombo(progress: number, combo: AttackComboSettings): boolean {
  return Number.isFinite(progress) && progress >= combo.chainWindow.from &&
    progress <= combo.chainWindow.until;
}

/** A follow-up must skip preparation, not the first damage event. */
export function followUpStartProgress(combo: AttackComboSettings, firstImpactFrom: number): number {
  return Math.min(combo.followUp.startProgress, Math.max(0, firstImpactFrom - 0.01));
}
