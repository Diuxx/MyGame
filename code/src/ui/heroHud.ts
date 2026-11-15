import type { createHeroVitals } from "../combat/heroVitals";
import type { EnemyEvent } from "../enemies/mapEnemySimulation";
import { requireElement } from "./dom";
import type { WeaponDefinition } from "../equipment/weaponDefinitions";

export function createHeroHud() {
  const container = requireElement<HTMLElement>("heroHud");
  const life = requireElement<HTMLOutputElement>("heroLife");
  const fill = requireElement<HTMLElement>("heroLifeFill");
  const weaponIcon = requireElement<HTMLImageElement>("heroWeaponIcon");
  const weaponFallback = requireElement<HTMLElement>("heroWeaponFallback");
  const weaponName = requireElement<HTMLElement>("heroWeaponName");
  const message = requireElement<HTMLElement>("encounterMessage");
  const prompt = requireElement<HTMLElement>("worldInteractionPrompt");
  container.hidden = false;
  let displayedWeaponId: string | null = null;
  function showFallback(): void {
    weaponIcon.hidden = true;
    weaponFallback.hidden = false;
  }
  weaponIcon.addEventListener("error", showFallback);
  showFallback();

  return {
    setEquipment(weapon?: WeaponDefinition): void {
      const id = weapon?.id ?? null;
      if (id === displayedWeaponId) return;
      displayedWeaponId = id;
      weaponName.textContent = weapon?.name ?? "Sans arme";
      if (!weapon) {
        weaponIcon.removeAttribute("src");
        showFallback();
        return;
      }
      weaponIcon.hidden = false;
      weaponFallback.hidden = true;
      weaponIcon.src = weapon.icon;
    },
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
