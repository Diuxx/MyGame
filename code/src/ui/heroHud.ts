import type { createHeroVitals } from "../combat/heroVitals";
import type { EnemyEvent } from "../enemies/mapEnemySimulation";
import { requireElement } from "./dom";
import type { WeaponDefinition } from "../equipment/weaponDefinitions";
import { DEFAULT_HERO_KEYS, HERO_SPELL_SLOTS, heroKeyLabel, type HeroKeys, type HeroSpellSlot } from "../character/heroInput";
import type { HeroBaseStats } from "../character/heroStats";

const PUNCH_ONE_ICON = "/assets/skills/punch/skill-1-punch-1.png";
const PUNCH_TWO_ICON = "/assets/skills/punch/skill-1-punch-2.png";

interface SpellSlotView {
  element: HTMLElement;
  icon: HTMLImageElement | null;
  timeout?: number;
}

function isHeroSpellSlot(value: string | undefined): value is HeroSpellSlot {
  return HERO_SPELL_SLOTS.some((slot) => slot === value);
}

const HERO_STAT_LABELS: Record<keyof HeroBaseStats, string> = {
  maxHealth: "PV max",
  attack: "Attaque",
  strength: "Force",
  defense: "Défense",
  agility: "Agilité",
  intelligence: "Intelligence",
};

export function createHeroHud(
  signal: AbortSignal,
  baseStats: HeroBaseStats,
  activateSpell: (slot: HeroSpellSlot) => void,
) {
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
  const spellSlots = new Map<HeroSpellSlot, SpellSlotView>();
  container.querySelectorAll<HTMLElement>(".hero-hud-spell-slot[data-spell]").forEach((element) => {
    const slot = element.dataset.spell;
    if (!isHeroSpellSlot(slot)) return;
    spellSlots.set(slot, { element, icon: element.querySelector<HTMLImageElement>(".hero-hud-spell-icon") });
    if (element instanceof HTMLButtonElement) {
      element.addEventListener("click", () => activateSpell(slot), { signal });
    }
  });
  const punchOne = spellSlots.get("spell1");
  if (!punchOne?.icon) throw new Error("HUD : icône de la compétence 1 introuvable.");
  let followUpAvailable = false;
  function setBindings(bindings: HeroKeys): void {
    const labels = {
      spell2: "Puissance",
      spell3: "Coup de pied",
      spell4: "Emplacement de compétence 4",
    } as const;
    for (const slot of ["spell2", "spell3", "spell4"] as const) {
      const element = spellSlots.get(slot)?.element;
      const hint = element?.querySelector<HTMLElement>("[data-key-hint]");
      if (hint) hint.textContent = heroKeyLabel(bindings[slot]);
      if (element) {
        const label = `${labels[slot]} — ${heroKeyLabel(bindings[slot])}`;
        element.setAttribute("aria-label", label);
        element.title = label;
      }
    }
  }
  setBindings(DEFAULT_HERO_KEYS);
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
      const slot = isHeroSpellSlot(id) ? spellSlots.get(id) : undefined;
      if (!slot) return;
      window.clearTimeout(slot.timeout);
      slot.element.classList.add("is-highlighted");
      slot.timeout = window.setTimeout(() => slot.element.classList.remove("is-highlighted"), 180);
    },
    setBindings,
    setFollowUpAvailable(available: boolean): void {
      if (followUpAvailable === available) return;
      followUpAvailable = available;
      punchOne.icon!.src = available ? PUNCH_TWO_ICON : PUNCH_ONE_ICON;
      const label = available ? "Poing 2 — clic gauche" : "Poing 1 — clic gauche";
      punchOne.element.setAttribute("aria-label", label);
      punchOne.element.title = label;
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
