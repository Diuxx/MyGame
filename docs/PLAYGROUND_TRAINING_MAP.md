# Playground — carte d'entraînement par défaut

Au lancement de `npm run dev-playground`, le système charge désormais **la map `playground`**, et non une scène avec cibles injectées automatiquement dans `enemyTools`.

## Contenu initial

- Terrain de 60 × 60 unités, sans tiles GLB : un seul mesh de sol avec une texture procédurale basse résolution pour la lecture du mouvement et de l'échelle
- Cercle d'entraînement au milieu et quelques obstacles simples sur les bords (boîtes, cylindres et sphères)
- Héros à `[0,0,-14]`, devant le terrain d'entraînement
- Une cible en bois au centre à `[0,0,0]` : `target-wood`, statique, immortelle et régénérante, issue du catalogue actuel
- Deux gobelins côte à côte à `[-9,0,11]` et `[-5,0,11]`
- Un gobelin isolé à `[15,0,9]`

Les trois gobelins utilisent **l'archétype `goblin` existant** et ses animations/GLB. Leur IA garde leur position jusqu'à détection du héros et ils réapparaissent après dix secondes. Ils restent modifiables dans l'éditeur de monde grâce à `enemySpawns` de la map.

La texture du sol est générée une seule fois par map via `DynamicTexture` (motif `terrain.primitiveGround.pattern = "training"`), puis libérée lors de la destruction de la zone. Il n'y a ni image à télécharger ni nouvelles tuiles GLB.

## Outils conservés

- `Gestion des ennemis` peut toujours **créer manuellement** une cible de test. En revanche, il n'instancie plus ses trois modèles par défaut.
- `Maps 3D modulaires` permet toujours de passer sur `dojo`, `forest`, `prototype-forest` et `prototype-arena`. Le bouton « Retour Playground » recharge la map d'entraînement.
- Les outils de collision, hitboxes, édition des ennemis de map, contrôle de ciblage et HUD restent disponibles.

## Fichiers

- `code/public/assets/maps/playground.json` : géométrie, positions, archétypes, respawn et intelligence de combat.
- `code/src/playground.ts` : chargement initial de la map et point d'apparition du héros.
- `code/src/playground/enemyTools.ts` : suppression des spawns automatiques legacy.
- `code/src/world/maps/zoneScene.ts` : texture procédurale optionnelle.
- `code/src/world/maps/zoneContent.ts` : validation de l'option `pattern`.
- `code/src/playground/mapTools.ts` : choix de la map et retour au Playground.

Ne pas modifier `AGENTS.md`, `docs/PROJECT.md` ou `docs/PROJETCT.md` lors de futurs ajustements.

## Essai

```bash
cd code
npm ci
npm run dev-playground
```

À l'ouverture, une cible en bois et trois gobelins doivent être visibles (les gobelins au nord du cercle d'entraînement). La map peut être exportée depuis l'éditeur, puis rechargée.

Les tests automatisés vérifient la structure des données et la composition de la simulation. L'apparence en moteur et la performance sur mobile demandent encore un essai réel en navigateur.
