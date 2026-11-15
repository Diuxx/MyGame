import assert from "node:assert/strict";
import test from "node:test";
import { parseMapExits, parseMapPrimitives, parsePrimitiveGround } from "./zoneContent.ts";
import { createExitActivationGuard, nearestExit } from "./zoneExits.ts";

const portal = {
  id: "to-arena", label: "Arène", position: [5, 0, 5], triggerRadius: 2,
  targetMap: "prototype-arena", targetSpawn: "from-forest", activation: "automatic",
};

test("primitive shapes and flat ground are validated", () => {
  assert.deepEqual(parsePrimitiveGround({ color: "#aabbcc" }), { color: "#aabbcc" });
  assert.equal(parseMapPrimitives([{
    id: "pillar", kind: "cylinder", position: [0, 2, 0], size: [1, 4, 1],
    color: "#8899AA", blocksMovement: true,
  }]).length, 1);
  assert.throws(() => parsePrimitiveGround({ color: "green" }), /couleur/);
  assert.throws(() => parseMapPrimitives([{
    id: "invalid", kind: "box", position: [0, 0, 0], size: [1, 0, 1],
    color: "#FFFFFF", blocksMovement: true,
  }]), /nombre invalide/);
});

test("exits validate destinations, modes and identifiers", () => {
  assert.equal(parseMapExits([portal])[0].targetSpawn, "from-forest");
  assert.throws(() => parseMapExits([portal, portal]), /dupliqué/);
  assert.throws(() => parseMapExits([{ ...portal, activation: "unknown" }]), /activation/);
  assert.throws(() => parseMapExits([{ ...portal, targetMap: "../invalid" }]), /targetMap/);
});

test("exit detection uses a circular XZ trigger", () => {
  const exit = parseMapExits([portal]);
  assert.equal(nearestExit(exit, [6, 50, 5])?.id, "to-arena");
  assert.equal(nearestExit(exit, [7.1, 0, 5]), undefined);
});

test("automatic transitions cannot bounce until the player leaves the next portal", () => {
  const guard = createExitActivationGuard();
  const [exit] = parseMapExits([portal]);
  guard.observe(exit);
  assert.equal(guard.canActivate, true);
  guard.consume();
  guard.observe(exit);
  assert.equal(guard.canActivate, false);
  guard.observe(undefined);
  assert.equal(guard.canActivate, true);
});
