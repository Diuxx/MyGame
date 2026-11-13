export type WeaponState = "SHEATHED" | "DRAWING" | "DRAWN" | "SHEATHING";

export function createWeaponState() {
  let state: WeaponState = "SHEATHED";
  let drawn = false;
  let attachmentAt = 0;

  function advance(progress: number): void {
    if (state !== "DRAWING" && state !== "SHEATHING") return;
    if (progress >= attachmentAt) drawn = state === "DRAWING";
    if (progress >= 1) state = drawn ? "DRAWN" : "SHEATHED";
  }

  function transition(targetDrawn: boolean, attachmentProgress?: number): void {
    if (state !== (targetDrawn ? "SHEATHED" : "DRAWN")) return;
    state = targetDrawn ? "DRAWING" : "SHEATHING";
    attachmentAt = attachmentProgress ?? 0;
    if (attachmentProgress === undefined) advance(1);
    else advance(0);
  }

  return {
    get state() { return state; },
    get drawn() { return drawn; },
    transition,
    advance,
  };
}
