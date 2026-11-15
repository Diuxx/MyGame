import type { createHeroVitals } from "../combat/heroVitals";
import type { EnemyEvent } from "../enemies/mapEnemySimulation";
import { requireElement } from "./dom";
import type { WeaponDefinition } from "../equipment/weaponDefinitions";
import { DEFAULT_HERO_KEYS, heroKeyLabel } from "../character/heroInput";
import type { HeroBaseStats } from "../character/heroStats";

const HERO_STAT_LABELS: Record<keyof HeroBaseStats, string> = {
  maxHealth: "PV max",
  attack: "Attaque",
  strength: "Force",
  defense: "Défense",
  agility: "Agilité",
  intelligence: "Intelligence",
};

export function createHeroHud(signal: AbortSignal, baseStats: HeroBaseStats) {
  const container = requireElement<HTMLElement>("heroHud");
  const life = requireElement<HTMLOutputElement>("heroLife");
  const fill = requireElement<HTMLElement>("heroLifeFill");
  const weaponIcon = requireElement<HTMLImageElement>("heroWeaponIcon");
  const weaponFallback = requireElement<HTMLElement>("heroWeaponFallback");
  const weaponName = requireElement<HTMLElement>("heroWeaponName");
  const message = requireElement<HTMLElement>("encounterMessage");
  const prompt = requireElement<HTMLElement>("worldInteractionPrompt");
  const statsToggle = requireElement<HTMLButtonElement>("heroStatsToggle");
  const statsPanel = requireElement<HTMLDListElement>("heroBaseStats");
  statsPanel.replaceChildren(...(Object.keys(HERO_STAT_LABELS) as (keyof HeroBaseStats)[]).map((key) => {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    label.textContent = HERO_STAT_LABELS[key];
    value.textContent = String(baseStats[key]);
    row.append(label, value);
    return row;
  }));
  statsPanel.hidden = true;
  statsToggle.setAttribute("aria-expanded", "false");
  statsToggle.addEventListener("click", () => {
    const expanded = statsPanel.hidden;
    statsPanel.hidden = !expanded;
    statsToggle.setAttribute("aria-expanded", String(expanded));
  }, { signal });
  const spellSlots = new Map<string, { element: HTMLElement; timeout?: number }>();
  container.querySelectorAll<HTMLElement>(".hero-hud-spell-slot[data-spell]").forEach((element) => {
    spellSlots.set(element.dataset.spell!, { element });
  });
  signal.addEventListener("abort", () => {
    for (const { element, timeout } of spellSlots.values()) {
      window.clearTimeout(timeout);
      element.classList.remove("is-highlighted");
    }
  }, { once: true });
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
    flashSpell(id: string): void {
      const slot = spellSlots.get(id);
      if (!slot) return;
      window.clearTimeout(slot.timeout);
      slot.element.classList.add("is-highlighted");
      slot.timeout = window.setTimeout(() => slot.element.classList.remove("is-highlighted"), 180);
    },
    nearby(label?: string, key = DEFAULT_HERO_KEYS.interact): void {
      prompt.hidden = !label;
      prompt.textContent = label ? heroKeyLabel(key) + " · " + label : "";
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
