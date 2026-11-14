import type { createHeroVitals } from "../combat/heroVitals";
import type { EnemyEvent } from "../enemies/mapEnemySimulation";
import { requireElement } from "./dom";

export function createHeroHud() {
  const container = requireElement<HTMLElement>("heroHud");
  const life = requireElement<HTMLOutputElement>("heroLife");
  const fill = requireElement<HTMLElement>("heroLifeFill");
  const message = requireElement<HTMLElement>("encounterMessage");
  const prompt = requireElement<HTMLElement>("worldInteractionPrompt");
  container.hidden = false;

  return {
    announce(text: string): void { message.textContent = text; },
    nearby(label?: string): void {
      prompt.hidden = !label;
      prompt.textContent = label ? "E · " + label : "";
    },
    refresh(vitals: ReturnType<typeof createHeroVitals>): void {
      life.textContent = vitals.isAlive
        ? `PV ${Math.ceil(vitals.health)} / ${vitals.maxHealth}`
        : `KO · réapparition dans ${vitals.respawnRemaining.toFixed(1)} s`;
      fill.style.width = `${Math.max(0, 100 * vitals.health / vitals.maxHealth)}%`;
    },
    event(event: EnemyEvent): void {
      if (event.type === "message") {
        message.textContent = event.message;
      } else if (event.type === "bossPhase") {
        message.textContent = `Boss : phase ${event.phase}`;
      } else if (event.type === "waveStarted") {
        message.textContent = `Vague : ${event.id}`;
      } else if (event.type === "waveCleared") {
        message.textContent = `Vague terminée : ${event.id}`;
      } else if (event.type === "hitHero") {
        message.textContent = `${event.id} utilise ${event.skill}`;
      }
    },
  };
}
