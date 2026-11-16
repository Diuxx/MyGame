# World Editor V2 — édition modulaire

L'éditeur V2 étend le Playground existant, avec la même logique de maps JSON, les mêmes Prefabs Babylon.js et le même héros. Il ne change pas les règles de combat ni les maps historiques.

## Ouvrir l'éditeur

```bash
cd code
npm ci
npm run dev-playground
```

Dans **Maps 3D modulaires**, sélectionner **Prototype — Auberge blanche**. Activer **Éditeur de monde**. Les flèches déplacent la caméra ; en quittant l'éditeur, elle revient sur le héros.

## Raccourcis

| Commande | Effet |
| --- | --- |
| Clic | Sélection unique |
| Shift+Clic | Ajouter/enlever de la sélection |
| Ctrl/Cmd+C | Copier Prefabs ou décors de map |
| Ctrl/Cmd+V | Prévisualiser une copie, clic pour confirmer |
| Ctrl/Cmd+X | Couper la sélection |
| Suppr | Supprimer |
| Ctrl/Cmd+D | Dupliquer avec un décalage |
| Ctrl/Cmd+Z | Annuler |
| Ctrl/Cmd+Y ou Ctrl/Cmd+Shift+Z | Rétablir |
| PageUp / PageDown | Monter / descendre d'un palier |
| G / R / S | Gizmos de déplacement, rotation ou échelle |
| Échap | Annuler le placement de copie |
| Flèches | Déplacer la caméra pendant l'édition |

Les raccourcis sont réservés au mode édition et ne remplacent pas ceux des zones de saisie.

## Édition des blocs

- Les Prefabs et les décors de map peuvent être copiés/coupés/collés/supprimés.
- La copie reste interne à l'éditeur ; aucun accès au presse-papiers du système d'exploitation n'est requis.
- L'aperçu de collage est constitué de volumes translucides ; le rendu final partage toujours ses formes sources.
- Les collages multiples préservent les espacements relatifs.
- Les champs position/rotation, le glissement et les changements de dimensions des Prefabs sont annulables.
- Pour un bloc, l'inspecteur affiche **longueur X, hauteur Y et profondeur Z**. Ces valeurs sont converties en échelles par axe (`scaleAxes`).
- Les anciens Prefabs n'ayant qu'un `scale` uniforme restent compatibles.
- Les collisions suivent les nouvelles échelles. Pour une forme cylindrique non uniforme, la collision circulaire utilise volontairement le plus grand rayon horizontal : approximation conservatrice.
- Chaque déplacement groupé par souris est une seule commande Undo/Redo.
- Les gizmos de Babylon utilisent la sélection courante ; les modifications sont validées vers les données et collisions à la fin de la manipulation.

L'historique garde jusqu'à 100 commandes par session/map et est vidé au changement de map. Les fichiers JSON et les ressources Babylon ne sont jamais conservés comme objets vivants dans l'historique.

## Terrain

Le panneau **Terrain** accepte largeur/profondeur et ancrage **Centre** ou **Origine**. Le moteur redimensionne le sol primitif unique et ses informations de navigation, collisions et bornes sans recharger le héros ou les ennemis.

La grille reste limitée à **4 096 cellules**. En mode « Centre », le delta de taille doit correspondre à des paires de cellules pour conserver l'alignement. Le redimensionnement ne coupe ni les tuiles existantes ni les positions des éléments. Une réduction qui ferait sortir un spawn/objet est refusée.

Cette première version ne redimensionne pas directement les cartes construites avec des tuiles 3D non vides : elle affiche explicitement une erreur plutôt que détruire des éléments.

## Hauteurs et layers

Les paliers Y sont configurables : 0,25 / 0,5 / 1 / 2 unités. Ils changent la position réelle, sans rendre les étages automatiquement praticables.

Les layers servent à organiser le monde et ne sont **pas** des paliers de hauteur. Layers de base : `architecture`, `furniture`, `decoration`, `entities`.

- Un bloc peut être affecté à un layer depuis l'inspecteur.
- Le panneau Layers permet de créer des catégories, masquer un layer et le verrouiller en édition.
- Les informations de layers sont enregistrées dans `editorLayers`, `editorLayerStates` et les propriétés `layer` des placements de Prefabs/décors.
- Les collisions et la logique de Gameplay demeurent indépendantes du masquage d'édition.

## Brouillons locaux

Les changements validés sont sauvegardés avec un léger délai dans `localStorage`, quand il est disponible.

- **Sauver brouillon** enregistre manuellement.
- **Restaurer** recharge explicitement un brouillon dans la map en cours.
- **Supprimer le brouillon** efface la copie locale.
- **Exporter map JSON** reste le moyen de produire un fichier du projet.

La restauration valide les données et construit d'abord la map candidate ; si elle échoue, la map précédente reste active. Les brouillons possèdent une version de schéma et une empreinte de la map source : une ancienne sauvegarde incompatible est rejetée. Les fichiers binaires GLB et textures ne sont pas intégrés à ce stockage.

## Architecture

| Composant | Responsabilité |
| --- | --- |
| `editorCommands.ts` | Historique Undo/Redo et commandes groupées avec rollback |
| `editorClipboard.ts` | Copie profonde des Prefabs, placements uniques et offsets |
| `editorTerrain.ts` | Redimensionnement et vérifications de données |
| `editorLayers.ts` | Noms, visibilité et verrouillage logiques |
| `editorSnapping.ts` | Grille, angles et accroche simple entre extrémités de murs |
| `editorGeometry.ts` | Dimensions des formes de Prefabs |
| `editorGizmos.ts` | Couche de manipulation Babylon.js |
| `editorDrafts.ts` | Brouillons versionnés et empreintes source |
| `editorInteractionV2.ts` | Commandes de l'interface et synchronisation avec la map |
| `worldEditor.ts` | Sélection, placement, drag, panneaux existants et intégration V2 |

Les règles JSON restent indépendantes de Babylon. La scène continue à partager les meshes sources entre instances.

## Limites et vérifications restantes

- Les cibles temporaires de test, les ennemis et les interactions ont un cycle de vie distinct : les commandes de coupe/copie/suppression V2 concernent actuellement **les Prefabs et les décors de map**. Les autres types continuent à disposer de leurs contrôles de placement traditionnels.
- Les gizmos visent une sélection unique ; les opérations de déplacement/copie/suppression/layer/hauteur peuvent agir sur plusieurs Prefabs ou décors.
- L'accroche intelligente entre extrémités de murs s'applique aux placements ; les ancres de surface plus avancées et la rotation de groupe autour d'un pivot virtuel restent à faire évoluer.
- Les changements de fichiers GLB locaux peuvent être prévisualisés, mais l'historique ne garantit pas la restauration des octets binaires déjà libérés.
- La navigation physique verticale et les escaliers praticables restent hors périmètre.
- Les tests automatisés ne remplacent pas un essai dans un navigateur pour confirmer l'ergonomie des gizmos, le collage et la fluidité.

Les documents de référence `AGENTS.md`, `docs/PROJECT.md` et `docs/PROJETCT.md` ne doivent pas être modifiés.
