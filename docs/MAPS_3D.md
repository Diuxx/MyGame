# Maps 3D modulaires — MVP JSON (Babylon.js)

Ce document est éditable. Il décrit la réalisation de la spécification
`MAP_SYSTEM_SPEC.md`. Les références `docs/PROJECT.md` et
`docs/PROJETCT.md` restent inchangées.

## Démarrage

```bash
cd code
npm ci
npm run dev-playground
# ou : npm run dev-gameplay
```

- **Playground** : ouvrir **Maps 3D modulaires**, choisir **Cour du dojo**
  ou **Clairière**, puis cliquer sur **Charger / remplacer**. La scène de
  tests d'ennemis reste disponible si aucune map n'est chargée.
- **Gameplay** : le dojo est chargé automatiquement, et le héros est
  déplacé au point d'apparition `player`.
- **Décharger** supprime les éléments de la map courante, sans supprimer
  le sol de base du Playground ni les ennemis déjà présents.
- **Afficher les colliders** montre les volumes de collision (jaunes).
- **Placer le héros au spawn** réapplique le point d'apparition de la map.

## Créer un niveau

Les fichiers de données sont dans `code/public/assets/` :

```text
assets/
├── definitions/assets.json  # tiles, objets, chemins GLB et colliders
├── maps/
│   ├── dojo.json
│   └── forest.json
└── models/
    ├── tiles/              # ici : wood.glb, stone.glb, etc.
    └── objects/            # ici : wall.glb, tree.glb, etc.
```

Les modèles sous `models/` sont actuellement **absents** du dépôt.
C'est volontaire : les maps peuvent être manipulées immédiatement
grâce aux remplaçants géométriques.

1. Ajouter une définition de tile ou d'objet dans `definitions/assets.json`.
2. Ajouter son chemin GLB commençant par `/assets/` ; utiliser des
   coordonnées et tailles en unités du monde.
3. Décrire le terrain dans `maps/<id>.json`. Chaque ligne représente
   l'axe **Z**, chaque colonne l'axe **X**.
4. Décrire les objets dans `objects` avec `position: [x,y,z]` et
   `rotationY` en degrés, dans le repère du monde.
5. Pour rendre une nouvelle map sélectionnable, ajouter son chemin à
   `src/world/maps/dataLoader.ts` et son libellé au sélecteur
   `src/playground/mapTools.ts`.

**Placement des tiles** : l'origine du terrain est son **coin**.
Avec `tileSize: 2` et `origin: [0,0,0]`, la case
`tiles[2][3]` se place en `[7,0,5]`. Les positions des objets
ne sont jamais multipliées par la taille d'une tile.

### Modèles GLB et remplaçants

Le catalogue référence les fichiers complets, par exemple
`/assets/models/objects/tree.glb`.

- Quand le GLB existe et se charge, ses meshes sont instanciés depuis
  une **source mise en cache** (par chemin), sans recharger le fichier
  pour chaque objet.
- Si le fichier est absent, illisible ou sans géométrie utilisable,
  le moteur affiche une **primitive violette** :
  une boîte ou un cylindre par collider défini, y compris plusieurs
  boîtes pour un bâtiment en L.
- Une petite étiquette affiche le **nom du GLB attendu**,
  comme `building_l.glb`, au-dessus de l'objet.
- Une tile sans GLB reçoit une dalle provisoire de la taille de la
  cellule et une étiquette `wood.glb`, `stone.glb`, etc.
- Un objet sans collider reçoit un cube provisoire visuel, mais **ne
  bloque pas** les déplacements.

Le remplacement visuel n'altère jamais les collisions calculées
à partir du JSON. Chaque GLB absent est signalé dans la console et
dans le statut du module Maps. Le remplacement est prévu pour
les erreurs de chargement du modèle ; une texture manquante à
l'intérieur d'un GLB qui charge quand même ne garantit pas l'activation
du fallback. Après avoir ajouté un vrai modèle, recharger la page
pour vider le cache des modèles absents.

**Convention d'export Blender** : pivot au centre de la base,
axe Y vertical, échelle normalisée, mesh correctement orienté.
Les modèles de tiles doivent avoir l'emprise au sol prévue
par `tileSize`. Les primitifs de remplacement ne corrigent pas
automatiquement l'échelle d'un vrai GLB.

## Systèmes et responsabilités

| Module | Rôle |
|---|---|
| `world/maps/types.ts` | Types du catalogue, niveau et colliders |
| `validation.ts` | Validation JSON v1 et références |
| `dataLoader.ts` | Requêtes HTTP et identification des maps |
| `modelRegistry.ts` | Cache GLB, instanciation et destruction du cache |
| `missingVisuals.ts` | Substituts géométriques et noms des GLB absents |
| `mapBuilder.ts` | Construction des tiles, objets, colliders de debug et données nav |
| `mapCollision.ts` | Collisions géométriques XZ et glissement, **sans Babylon.js** |
| `navigationData.ts` | Données walkable et obstacles nav, sans pathfinding |
| `mapSession.ts` | Remplacement atomique, annulation des chargements obsolètes |
| `mapSystem.ts` | API publique de chargement, déchargement et debug |
| `playground/mapTools.ts` | Interface développeur du module Maps |

Les JSON ne contiennent aucune logique exécutable ni type moteur.
Les collisions sont définies par `colliders`, indépendamment
du mesh GLB et de `blocksNavigation`.

### Collisions et navigation : limites du MVP

Le projet utilise déjà des déplacements **top-down** et un solveur
géométrique. La V1 le prolonge sans introduire Havok :

- `box` : rectangle orienté en XZ, décalage local tourné avec
  l'objet ; test de balayage continu d'un cercle contre une boîte
  élargie. Approximatif (prudent) près des coins.
- `cylinder` : cercle en XZ ; balayage continu.
- Les collisions sont **composées** : un bâtiment en L a plusieurs
  volumes qui bloquent chacun le héros ; un seul visuel par objet.
- La hauteur du héros et la hauteur des colliders sont prises en
  compte pour décider si un volume intercepte son déplacement.
- Le `groundCollider` est représenté par une **boîte de debug commune**,
  centrée à `y = originY - thickness / 2` ; dans ce système top-down,
  sa fonction physique est de borner les déplacements au rectangle
  de la map, pas de simuler la gravité ou un corps rigide Havok.
- Le Playground résout d'abord les collisions des ennemis puis
  celles de la map. Ce solveur séquentiel reste une approximation
  lorsqu'un personnage touche simultanément des obstacles de deux
  systèmes. Une future composition unifiée peut réutiliser les
  formes pures `FlatObstacle`.

`tile.walkable` et `object.blocksNavigation` alimentent
`navigationData.ts`, **pas** la collision physique et **pas encore**
un cheminement A*. Une tile non walkable comme l'eau n'empêche pas
à elle seule le déplacement manuel dans cette V1.

Les formes `sphere` et `capsule`, les triggers, les obstacles
mobiles et la navigation multi-niveaux sont hors périmètre.

## Cycle de vie et récupération

- Les JSON sont validés **avant** d'importer des GLB.
- Une map candidate est construite en arrière-plan de la scène
  (racine désactivée) avant de remplacer la map active.
- Si la lecture, la validation ou la construction échoue, l'ancienne
  map reste active et les objets de la candidate sont libérés.
- Un chargement devenu obsolète ne remplace pas un niveau plus récent.
- Le déchargement libère les instances, meshes et matériaux propres
  à la map. Les GLB sources restent en cache pour une future map ;
  `dispose()` du système libère aussi ces sources.

Les points `spawnPoints` servent au gameplay et ne déclenchent
pas eux-mêmes le chargement d'un personnage ou d'un ennemi.

## Vérifications

```bash
cd code
npm test
npm run build
```

Contrôles à réaliser dans Babylon.js :

1. Charger le dojo : grille 8×8, objets placés et noms visibles
   pour les GLB absents.
2. Afficher les colliders puis se déplacer et esquiver vers un mur,
   un arbre et les deux branches du bâtiment en L.
3. Décharger le dojo, charger la forêt, puis revenir au dojo :
   pas de duplication ni de résidus.
4. Simuler un JSON invalide et vérifier qu'un niveau précédent
   continue d'être affiché.
5. Remplacer un des GLB absents par un vrai modèle et recharger
   la page : le modèle doit remplacer la primitive, sans modifier
   son volume physique.
6. Vérifier le mode Gameplay (spawn de départ et limite du terrain).

Ces essais visuels ne sont **pas** remplacés par les tests unitaires
de validation, géométrie et cycle de vie ; la CI exécute ces derniers
ainsi que le contrôle TypeScript et le build Vite.
