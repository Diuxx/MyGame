# Catalogue visuel du Playground

Le catalogue se trouve dans **Explorateur → Catalogue**. Il présente les assets
placeables du monde actif sous forme de cartes à deux colonnes.

## Parcours

- Rechercher en français, avec ou sans accents, par nom, type ou identifiant. Les termes sont combinés.
- Filtrer par catégorie, ou choisir « Blocs modulaires (toutes catégories) ».
- Cliquer sur une carte puis sur le terrain, comme auparavant. Le message de sélection et le bouton d'annulation restent au-dessus de la grille.
- Le raccourci « Blocs modulaires » ouvre le catalogue et applique le filtre correspondant.
- Le catalogue conserve le filtre et la recherche lorsque l'explorateur est fermé ou lors d'un changement de map.

## Responsabilités

- `catalogEntries.ts` construit et filtre les entrées à partir des définitions validées existantes.
- `visualCatalog.ts` gère les cartes et les filtres DOM.
- `catalogThumbnails.ts` génère les images à la demande à partir du GLB/glTF réel ou des primitives du prefab.
- `worldEditor.ts` reste propriétaire du placement, de la prévisualisation sur le terrain et de l'annulation.

Les noms affichés sont les champs `name` des fichiers
`public/assets/definitions/assets.json` et `blockout-prefabs.json`.
Les clés techniques, dimensions, collisions, chemins des modèles et références
des maps restent identiques. Pour les objets sans catégorie dédiée, la
classification est dans `objectCategories` dans `catalogEntries.ts` ; les
nouveaux objets non classés restent visibles dans Décors. Les catégories de prefab
et catégories des ennemis existantes restent les sources de leur classification,
avec une exception de présentation pour les luminaires modulaires.

## Miniatures et performances

Pas de scène par carte, de rendu continu ni d'instanciation dans la scène de jeu :
les cartes visibles sont prises en charge séquentiellement par un renderer Babylon
isolé, réutilisé pendant un lot. Le cadrage orthographique utilise les volumes
réels du modèle. Les images WebP (256 × 256, PNG si WebP n'est pas supporté)
sont mises en cache pour la session ; le renderer est libéré après chaque lot.
Les assets hors écran ne déclenchent pas de nouveau rendu. Un modèle indisponible
affiche « Aperçu indisponible » et reste sélectionnable. La première visite peut
nécessiter le chargement des modèles ; un pipeline de fichiers WebP précalculés
pourra être ajouté si les mesures montrent que c'est nécessaire.

## Validation

Tests unitaires : `catalogEntries.test.ts`, inclus dans `npm test`.
Validation navigateur à réaliser : ouverture du catalogue, saisie de « fenetre »,
filtres Nature/Architecture/Entraînement, chargement des miniatures en défilant,
placement et annulation, changement de map, retour à l'onglet Scène, mobile.
