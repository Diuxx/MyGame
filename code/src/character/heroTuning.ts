import manifest from "../../ANIMATIONS.json" with { type: "json" };

export function animationNumber(value: unknown, field: string, min: number, max = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`ANIMATIONS.json · ${field} : nombre invalide.`);
  }
  return value;
}

export function animationFlag(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`ANIMATIONS.json · ${field} : booléen attendu.`);
  return value;
}

export function animationWindow(value: { from: number; until: number }, field: string) {
  const from = animationNumber(value?.from, field + ".from", 0, 1);
  return { from, until: animationNumber(value?.until, field + ".until", from, 1) };
}

const { controller, blending, transitions } = manifest;
const travel = animationWindow(controller.dodge.travel, "controller.dodge.travel");
if (travel.from === travel.until) throw new Error("ANIMATIONS.json · controller.dodge.travel : plage vide.");
if (!manifest.animations.some(({ name, category }) => name === blending.combatLegsClip && category === "movement")) {
  throw new Error("ANIMATIONS.json · blending.combatLegsClip : clip de locomotion inconnu.");
}
if (typeof blending.upperBodyBonePattern !== "string" || !blending.upperBodyBonePattern) {
  throw new Error("ANIMATIONS.json · blending.upperBodyBonePattern : expression requise.");
}

export const HERO_TUNING = {
  maxMovementDelta: animationNumber(controller.maxMovementDelta, "controller.maxMovementDelta", 0.001, 1),
  turnSpeed: animationNumber(controller.turnSpeed, "controller.turnSpeed", 0.001),
  aimDeadZone: animationNumber(controller.aimDeadZone, "controller.aimDeadZone", 0),
  combatStance: {
    duration: animationNumber(controller.combatStance.duration, "controller.combatStance.duration", 0),
    onHitDealt: animationFlag(controller.combatStance.onHitDealt, "controller.combatStance.onHitDealt"),
    onHitReceived: animationFlag(controller.combatStance.onHitReceived, "controller.combatStance.onHitReceived"),
  },
  attack: {
    allowMovement: animationFlag(controller.attack.allowMovement, "controller.attack.allowMovement"),
    lockFacing: animationFlag(controller.attack.lockFacing, "controller.attack.lockFacing"),
  },
  dodge: { cooldown: animationNumber(controller.dodge.cooldown, "controller.dodge.cooldown", 0), travel },
  blending: {
    ...blending,
    attackFadeSeconds: animationNumber(blending.attackFadeSeconds, "blending.attackFadeSeconds", 0.001),
    fullBodySpeed: animationNumber(blending.fullBodySpeed, "blending.fullBodySpeed", 0, 1),
    upperBodyBones: new RegExp(blending.upperBodyBonePattern, "i"),
  },
  transition: {
    move: animationNumber(transitions.move, "transitions.move", 0.03, 1),
    idle: animationNumber(transitions.idle, "transitions.idle", 0.03, 1),
    slowDown: animationNumber(transitions.slowDown, "transitions.slowDown", 0.03, 1),
  },
};
