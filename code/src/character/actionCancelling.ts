import type { ActionCancelSettings } from "./animationSettings.ts";

export type CancelTarget = "run" | "attack" | "dodge";

const fields: Record<CancelTarget, keyof ActionCancelSettings> = {
  run: "runFrom",
  attack: "attackFrom",
  dodge: "dodgeFrom",
};

/** Pure gameplay rule: an absent window forbids cancellation. */
export function canCancelAction(
  progress: number, cancel: ActionCancelSettings | undefined, target: CancelTarget,
): boolean {
  const from = cancel?.[fields[target]];
  return typeof from === "number" && Number.isFinite(progress) &&
    Number.isFinite(from) && progress >= from && progress <= 1;
}
