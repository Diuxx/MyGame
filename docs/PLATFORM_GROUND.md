# Plateforme 3D et placement des murs — Prototype

## Test dans le Playground

```sh
cd code
npm ci
npm run dev-playground
```

Dans **Maps 3D modulaires**, charger **Prototype — Auberge blanche**, activer **Éditeur de monde**, puis ouvrir **Terrain**.

- **Sol plat** : surface historique, sans socle.
- **Plateforme rectangulaire** : surface plane au niveau Y du terrain et boîte 3D fermée sous celle-ci.
- **Épaisseur** : 0,1 à 8 unités, valeur initiale 1,2.
- **Couleur des côtés** : initialement `#D8D8D8`.

Le style est appliqué immédiatement, enregistré dans le JSON exporté et annulable via Undo/Redo. Le changement de taille dans **Terrain** met à jour simultanément le sol supérieur et le socle, sans recharger le héros.

En mode Gameplay, la même map peut être chargée avec `npm run dev-gameplay` puis `?map=prototype-inn`. Le démarrage Gameplay reste sur `dojo` par défaut.

## Configuration

`code/public/assets/maps/prototype-inn.json` utilise :

```json
{
  "terrain": {
    "visual": {
      "style": "platform",
      "thickness": 1.2,
      "sideColor": "#D8D8D8"
    }
  }
}
```

Les autres champs habituels de `terrain` (`origin`, `tiles`, `groundCollider`, `primitiveGround`) restent nécessaires. Le bloc `visual` est optionnel ; absent, il implique le rendu `flat` historique.

`zoneContent.ts` valide les styles, l'épaisseur et la couleur. `zoneScene.ts` crée une **boîte Babylon.js unique** pour la plateforme et conserve la surface supérieure existante, ce qui permet également de préserver d'éventuels motifs du sol. Le volume latéral ne reçoit aucune nouvelle collision : les limites du personnage restent déterminées par les bornes de la map et les obstacles existants.

## Bordures et placement des murs

Le placement historique utilise `findTerrainCell` : borne minimale incluse, borne maximale exclue. Ce choix reste inchangé pour les règles de navigation et pour les objets ordinaires.

Pour les **Prefabs de murs** (`wall-*`), `wallPlacement.ts` calcule le contour horizontal de toutes les parties visuelles, avec leur rotation locale, l'échelle par axe et la rotation mondiale. Le pivot est ensuite **ajusté symétriquement** contre les limites minimales et maximales :

- Nord / Sud : même décalage suivant la profondeur réelle.
- Est / Ouest : même décalage suivant l'épaisseur réelle.
- Les murs plus longs ou redimensionnés utilisent leurs nouvelles dimensions.
- Les murs trop grands pour entrer dans le terrain sont refusés explicitement.
- Les autres catégories d'objets conservent les règles précédentes.

Cette logique est réutilisée pour l'ajout, le déplacement, la rotation, l'échelle, la duplication, le collage et les gizmos. Le pointeur peut viser une petite marge aux frontières pendant le placement d'un mur ; le pivot final reste à l'intérieur et le mur ne surplombe pas le vide.

## Limites

- Plateforme **rectangulaire à bords droits** : aucun chanfrein, relief rocheux, coin arrondi ni matériau PBR ajouté.
- Le rendu `platform` s'applique aux maps ayant un `primitiveGround`. Les maps composées uniquement de tuiles ne sont pas reconstruites automatiquement.
- Le placement est ajusté pour les Prefabs dont l'identifiant commence par `wall-`, et non pour tous les modèles GLB.
- Les parties des murs non rectangulaires utilisent une enveloppe rectangulaire conservatrice.
- Il faut encore vérifier visuellement l'ombre, le cadre caméra et l'ergonomie sur un navigateur réel.

Les références immuables `AGENTS.md`, `docs/PROJECT.md` et `docs/PROJETCT.md` restent inchangées.
