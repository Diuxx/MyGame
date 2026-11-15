# Prototype — Zones interconnectées

Cette feature étend le système existant sous `code/src/world/maps/`, sans remplacer `dojo` ni `forest`.

## Essai rapide

Depuis `code/` :

```bash
npm ci
npm run dev-gameplay
```

Le jeu démarre normalement sur `dojo`. Pour démarrer dans le prototype forêt, ouvrir l'URL du serveur Vite avec `?map=prototype-forest`.

Dans le Playground (`npm run dev-playground`), choisir `Prototype — Forêt` ou `Prototype — Arène` dans **Maps 3D modulaires**, puis **Charger / remplacer**.

- Dans la forêt, traverser le portail au nord (Z positif) pour rejoindre l'arène automatiquement. Le portail à l'ouest utilise la touche d'interaction.
- Dans l'arène, approcher le passage au sud et appuyer sur la touche d'interaction (F par défaut) pour revenir dans la forêt.
- Activer « Afficher les spawns de zone » pour visualiser les marqueurs jaunes d'apparition ; les portails colorés sont toujours visibles.
- Les deux zones n'utilisent **aucune tile GLB et aucune texture** : sol plan unique, géométrie Babylon.js et matériaux de couleur unie.

## Données

Les définitions sont dans `code/public/assets/maps/prototype-forest.json` et `prototype-arena.json`.
Une map conserve le format v1 existant et peut définir trois champs optionnels :

- `terrain.primitiveGround.color` : couleur du mesh unique qui recouvre les dimensions du terrain.
- `primitives` : objets blockout (`box`, `cylinder`, `sphere`) avec `id`, `kind`, `position`, `size`, `rotationY`, `color` et `blocksMovement`.
- `exits` : sorties avec `id`, `label`, `position`, `triggerRadius`, `targetMap`, `targetSpawn` et `activation` (`automatic` / `interact`).

Les positions sont `[x,y,z]` en unités du monde, avec Y vertical. La grille `terrain.tiles` peut rester remplie de `null` pour définir les limites et la navigation : aucune tuile 3D n'est alors chargée.

Pour ajouter une zone : créer son JSON, déclarer son identifiant dans `dataLoader.ts`, ajouter au moins un spawn de type `player`, puis configurer les sorties des zones voisines. Les données sont validées avant la création des meshes.

## Responsabilités

- `zoneContent.ts` : validation des nouveaux paramètres JSON.
- `zoneScene.ts` : rendu et nettoyage des primitives Babylon.
- `zoneExits.ts` : calcul pur de proximité et protection contre le rebond.
- `zoneTransitions.ts` : orchestration de l'entrée, du fondu, du spawn et de l'UI.
- `mapSession.ts` : remplacement atomique de la map (validation avant activation).
- `mapCollision.ts` : obstacles primitifs et limites de la zone.

Le héros, sa caméra, ses statistiques, son équipement et son HUD sont conservés.

## Limites

Pas de changement de map sans transition visuelle, de streaming, de sauvegarde de position ou de générateur procédural. La grille vide reste une donnée de navigation (pas une représentation graphique). Les objets primitifs sont de simples éléments statiques de prototype et ne sont pas encore éditables par le panneau d'édition d'objets GLB. Pour mesurer la mémoire GPU et les performances mobiles, utiliser un vrai navigateur/appareil cible.
