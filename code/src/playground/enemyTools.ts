import type { Position } from "../combat/combat";
import { loadEnemyDefinitions, type EnemySettings } from "../enemies/enemyDefinitions";
import definitionsJson from "../enemies/enemyDefinitions.json";
import type { createEnemyScene } from "../enemies/enemyScene";
import { configureEnemy, resetEnemy, type Enemy } from "../enemies/enemyState";
import { requireElement } from "../ui/dom";

export async function startEnemyTools(
  enemies: ReturnType<typeof createEnemyScene>,
  groundY: number,
  spawnNearHero: (definition: Enemy["definition"]) => Position,
  signal: AbortSignal,
): Promise<() => void> {
  const definitions = loadEnemyDefinitions(definitionsJson).filter(({ category }) => category === "static");
  const instances = new Map<string, Enemy>();
  const type = requireElement<HTMLSelectElement>("enemyType");
  const list = requireElement<HTMLSelectElement>("enemyInstance");
  const form = requireElement<HTMLFormElement>("enemyForm");
  const fields = requireElement<HTMLFieldSetElement>("enemyFields");
  const submit = requireElement<HTMLButtonElement>("enemySubmit");
  const reset = requireElement<HTMLButtonElement>("enemyReset");
  const remove = requireElement<HTMLButtonElement>("enemyRemove");
  const removeAll = requireElement<HTMLButtonElement>("enemyRemoveAll");
  const health = requireElement<HTMLOutputElement>("enemyHealth");
  const status = requireElement<HTMLParagraphElement>("enemyStatus");
  const debug = requireElement<HTMLInputElement>("showHurtboxes");
  const options = { signal };

  const maxHealth = requireElement<HTMLInputElement>("enemyMaxHealth");
  const defense = requireElement<HTMLInputElement>("enemyDefense");
  const attack = requireElement<HTMLInputElement>("enemyAttack");
  const speed = requireElement<HTMLInputElement>("enemySpeed");
  const immortal = requireElement<HTMLInputElement>("enemyImmortal");
  const regen = requireElement<HTMLInputElement>("enemyRegen");
  const delay = requireElement<HTMLInputElement>("enemyRegenDelay");
  const rate = requireElement<HTMLInputElement>("enemyRegenRate");

  for (const definition of definitions) type.add(new Option(definition.name, definition.id));
  const getDefinition = () => definitions.find(({ id }) => id === type.value)!;
  let pending = false;

  function refreshHealth(): void {
    const enemy = instances.get(list.value);
    const text = enemy
      ? `${enemy.id} · ${Math.ceil(enemy.health)} / ${enemy.stats.maxHealth} PV${enemy.defeated ? " · Vaincu" : ""}`
      : "";
    if (health.value !== text) health.value = text;
  }

  function syncSelection(): void {
    const enemy = instances.get(list.value);
    if (enemy) type.value = enemy.definition.id;
    const settings = enemy ?? getDefinition();
    maxHealth.value = String(settings.stats.maxHealth);
    defense.value = String(settings.stats.defense);
    attack.value = String(settings.stats.attackDamage);
    speed.value = String(settings.stats.movementSpeed);
    immortal.checked = settings.immortal;
    regen.checked = settings.regeneration.enabled;
    delay.value = String(settings.regeneration.delay);
    rate.value = String(settings.regeneration.healthPerSecond);
    type.disabled = !!enemy || pending;
    reset.disabled = remove.disabled = !enemy || pending;
    removeAll.disabled = instances.size === 0 || pending;
    submit.textContent = enemy ? "Appliquer" : "Créer un ennemi";
    enemies.select(list.value);
    refreshHealth();
  }

  function add(enemy: Enemy): void {
    instances.set(enemy.id, enemy);
    list.add(new Option(`${enemy.definition.name} · ${enemy.id}`, enemy.id));
  }

  for (const [index, id] of ["dummy-straw", "dummy-knight", "target-wood"].entries()) {
    const definition = definitions.find((item) => item.id === id);
    if (!definition) throw new Error(`Définition manquante : ${id}`);
    add(await enemies.spawn(definition, definition, [3 - index * 3, groundY, 4]));
  }
  syncSelection();
  list.addEventListener("change", syncSelection, options);
  type.addEventListener("change", syncSelection, options);
  debug.addEventListener("change", () => enemies.showHurtboxes(debug.checked), options);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending) return;
    const settings: EnemySettings = {
      stats: { maxHealth: maxHealth.valueAsNumber, defense: defense.valueAsNumber,
        attackDamage: attack.valueAsNumber, movementSpeed: speed.valueAsNumber },
      immortal: immortal.checked,
      regeneration: { enabled: regen.checked, delay: delay.valueAsNumber, healthPerSecond: rate.valueAsNumber },
    };
    const enemy = instances.get(list.value);
    status.textContent = "";
    try {
      if (enemy) {
        configureEnemy(enemy, settings);
      } else {
        const definition = getDefinition();
        pending = fields.disabled = list.disabled = submit.disabled = true;
        removeAll.disabled = true;
        status.textContent = "Chargement du modèle…";
        const spawned = await enemies.spawn(definition, settings, () => spawnNearHero(definition));
        add(spawned);
        list.value = spawned.id;
      }
      status.textContent = "";
      syncSelection();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      pending = fields.disabled = list.disabled = submit.disabled = false;
      type.disabled = !!instances.get(list.value);
      reset.disabled = remove.disabled = !instances.has(list.value);
      removeAll.disabled = instances.size === 0;
    }
  }, options);

  reset.addEventListener("click", () => {
    const enemy = instances.get(list.value);
    if (enemy) resetEnemy(enemy);
    refreshHealth();
  }, options);
  remove.addEventListener("click", () => {
    enemies.remove(list.value);
    instances.delete(list.value);
    list.remove(list.selectedIndex);
    list.value = "";
    syncSelection();
  }, options);
  removeAll.addEventListener("click", () => {
    enemies.removeAll();
    instances.clear();
    list.length = 1;
    list.value = "";
    syncSelection();
  }, options);

  return refreshHealth;
}
