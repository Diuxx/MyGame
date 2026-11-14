# Éditeur de monde 3D — Playground POC

> Branche `feature/playground-world-editor`, dérivée de
> `feature/map-ambience-enemy-ai`. Les références immuables du dépôt
> ne sont pas modifiées.

## Utilisation

```bash
cd code && npm ci && npm test && npm run build
npm run dev-playground
```

Dans **Maps 3D modulaires**, charger `dojo` ou `forest`.
Ouvrir **Éditeur de monde**, activer le mode édition puis cliquer sur
un ennemi ou un mur. Maintenir le clic et glisser pour déplacer sur
le plan XZ ; Y et rotation sont modifiables numériquement. Le pas
de grille est configurable (0,5 unité ou libre). Un anneau marque
l'objet sélectionné. Le combat du héros et l'IA des ennemis de la
map sont suspendus pendant le mode édition.

**Objets** : édition des dimensions du premier collider (box/cylinder).
Les volumes suivants d'un collider composé sont préservés.
Le résultat est conservé par instance dans `objects[].colliders`
et la géométrie physique est recalculée après les modifications.
Un mur déplacé change donc réellement d'emplacement physique.

**Ennemis** : vitesse, rayon physique et rayon de hurtbox,
détection d'aggro, portée d'attaque et rayon de retour. La
configuration est conservée par instance dans les champs `overrides`
et `ai`. Déplacer l'ennemi modifie aussi son point de départ/retour
et de respawn. Les instances du même archétype ne partagent pas
leur configuration mutable.

## Remplacer le visuel

Sélectionner un objet/ennemi puis choisir un `.glb` (25 Mo maximum)
et éventuellement une image PNG/JPEG/WebP (8 Mo maximum). Ajuster
`visual.scale` (0,05 à 10) et `visual.tint` puis cliquer sur
**Appliquer l'apparence**. Le moteur charge le GLB en mémoire
et utilise un matériau d'aperçu sur les meshes de l'instance,
sans modifier les sources partagées. Les collisions restent
indépendantes du visuel.

Le chargement est uniquement **local au navigateur** et ne
téléverse pas de fichier sur GitHub. Le bouton **Exporter map JSON**
produit le niveau complet, dont les chemins de modèles/texture
sous `/assets/models/editor/` et `/assets/textures/editor/`.
Pour retrouver les visuels après un redémarrage, copier également
les fichiers binaires dans les emplacements équivalents sous
`code/public/`, puis intégrer le JSON exporté au dépôt.
Un fichier absent déclenche les primitives provisoires habituelles.

## Interactions avec le monde

Les maps peuvent contenir un tableau `interactions` :

```json
{
  "interactions": [{
    "id": "gem",
    "kind": "pickup",
    "itemId": "training_gem",
    "label": "Gemme d'entraînement",
    "position": [8, 0, 5],
    "range": 1.7
  }]
}
```

**Hors mode édition**, s'approcher et appuyer sur **E**.
`pickup` ajoute un objet à l'inventaire de session et le masque
en jeu ; `inspect` et `interact` affichent un message dans le HUD.
Les exemples `dojo` (gemme, stèle) et `forest` (herbe, autel)
permettent de tester directement. Pas encore de quêtes,
d'équipement issu du ramassage, de sauvegarde d'inventaire,
ni de zone d'interaction 3D complexe.

## Architecture

- `world/maps/editorSchema.ts` : validation de `visual`,
  des interactions, des chemins et des limites.
- `world/maps/worldInteractions.ts` : logique pure de proximité
  et d'inventaire en mémoire.
- `world/maps/worldInteractionScene.ts` : représentation Babylon
  de primitives ramassables/inspectables.
- `world/maps/modelRegistry.ts` : cache des GLB et chargement
  temporaire de GLB locaux.
- `world/maps/editableModel.ts` : modèle visuel remplaçable
  par instance, matériaux et nettoyage.
- `world/maps/mapBuilder.ts` : édition de décor, proxies de picking,
  recalcul des collisions statiques.
- `enemies/mapEnemyScene.ts` : édition des ennemis, apparition des
  modèles et mise à jour des colliders.
- `world/maps/mapSystem.ts` : orchestration et export JSON.
- `playground/worldEditor.ts` : interactions de l'interface et
  manipulation directe à la souris.

Les données du JSON ne contiennent aucune instruction exécutable.

## Limites et vérifications manuelles

- Seul le premier collider de décor est paramétrable via les champs ;
  pas encore d'édition visuelle de chacun des volumes.
- Le sélecteur n'agit que sur les ennemis déclarés dans `map.json`,
  pas sur les mannequins autonomes de l'ancien module Playground.
- Pas d'annuler/refaire ni de sauvegarde automatique ; exporter le JSON.
- Pas de validation anti-chevauchement à l'export. Le déplacement
  d'un ennemi suspend son IA, puis la réactive à la sortie du mode.
- Les assets importés localement doivent être copiés dans
  `public/assets` pour devenir permanents.
- Pas de sauvegarde des objets ramassés dans cette V1.
- Tester visuellement le clic/glisser, l'affichage des matériaux,
  les ombres, les déplacements/collisions après édition, le
  déchargement, les imports et la touche E.

Les tests purs couvrent la validation des fichiers visuels et le
comportement de ramassage ; TypeScript et Vite sont vérifiés par CI.
