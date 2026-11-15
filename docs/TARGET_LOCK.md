# Playground — Target Lock (POC)

Le **Target Lock** est un mode expérimental de déplacement et de visée. Il est **désactivé par défaut** dans `code/TARGETING.json`, afin de préserver le comportement de déplacement existant.

## Tester

1. Depuis `code/`, lancer `npm run dev-playground`.
2. Ouvrir **Ciblage / Target Lock** dans les modules Playground.
3. Cocher **Activer le verrouillage automatique** et vérifier qu'une cible d'entraînement à portée est entourée d'un anneau rouge.
4. Se déplacer avec ZQSD : le héros regarde la cible tout en bougeant. Avec la référence **Caméra**, ZQSD correspond aux directions de la vue. Avec **Cible**, Z/S avancent ou reculent par rapport à l'ennemi et Q/D permettent de tourner autour.
5. Désactiver le mode pour restaurer immédiatement le déplacement relatif à la souris. Lorsqu'aucune cible n'est disponible, le déplacement existant sert de repli.

Les ennemis d'entraînement et les ennemis mobiles de la map active sont éligibles. Les morts, les ennemis inactifs et ceux hors de portée ne le sont pas. Une cible déjà sélectionnée est conservée jusqu'au **rayon de perte** (supérieur au **rayon de détection**) pour éviter les changements incessants.

La sélection est temporairement désactivée si le héros est mort ou si l'éditeur de monde est actif. L'indicateur rouge est un torus Babylon.js non sélectionnable, sans modification de la simulation de combat. Le cercle de rayon est une aide de développement facultative.

## Configuration

`code/TARGETING.json` est la seule source des valeurs versionnées :

- `enabled` — active ou non le mode.
- `acquireRadius` — recherche des nouveaux ennemis.
- `releaseRadius` — distance à laquelle la cible existante est relâchée.
- `turnSpeed` — vitesse de rotation du héros.
- `movementReference` — `camera` ou `target`.
- `showTargetRing` — anneau rouge sous l'ennemi sélectionné.
- `showDebugRadius` — rayon de détection au sol (debug uniquement).

Le Playground applique les modifications immédiatement et les mémorise dans `localStorage` sous `mon-rpg.playground.target-lock.v1`. Utiliser **Exporter TARGETING.json** pour enregistrer les réglages définitifs dans le dépôt ; **Importer** vérifie les champs et **Rétablir** efface les surcharges locales.

## Architecture et limites du POC

- `character/targetSelection.ts` : sélection pure, conservation de cible et orientation, sans Babylon.js.
- `character/targetingSettings.ts` : validation stricte du manifeste et valeurs éditables.
- `character/targetLockSystem.ts` : état courant, indicateurs 3D et cycle de vie.
- `playground/targetLockSources.ts` : adaptation des deux sources d'ennemis existantes.
- `playground/targetLockTools.ts` : interface et import/export JSON.
- `characterController.ts` : applique une orientation distincte de la direction de déplacement lorsqu'une cible est présente.

Les animations locomotrices actuelles sont conservées : reculer et aller latéralement peuvent donner une impression de glissement, car aucune animation dédiée aux strafes n'est encore intégrée. Le mouvement reste manuel et les règles de collision/combat existantes sont inchangées. Le mode est câblé au Playground seulement ; le gameplay normal reste inchangé.
