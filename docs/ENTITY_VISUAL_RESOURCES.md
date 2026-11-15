# Ressources 3D et représentations visuelles

Ce document décrit les responsabilités actuelles. Il ne définit pas un nouveau système d'entités et ne remplace pas `docs/PROJECT.md`.

## Propriété et durée de vie

| Module | Responsabilité | Ressources possédées |
| --- | --- | --- |
| `world/maps/modelRegistry.ts` | Charger et mettre en cache les sources GLB, créer des instances et associer les animations externes | `AssetContainer` sources (jusqu'à la fermeture du registre) |
| `world/maps/editableModel.ts` | Préparer et remplacer un visuel de décor ou d'ennemi, appliquer les aperçus | Instance GLB, nœud racine, matériaux/textures d'aperçu, ombres et URL locales |
| `enemies/mapEnemyScene.ts` | Synchroniser les états d'IA avec les représentations et le debug d'ennemi | Visuels d'ennemis, barres de santé, télégraphes et indicateurs |
| `enemies/enemyScene.ts` | Afficher les cibles du Playground et leurs hitboxes | Représentations des cibles et son registre GLB, libéré avec la scène |
| `character/character.ts` | Charger le héros, son rig et ses clips, ajuster sa taille | Modèle du héros et clips associés à la scène |

Les règles de combat et l'IA restent indépendantes des ressources Babylon.js.

### Règles d'instanciation

- Un modèle source est conservé dans le registre, tandis que chaque placement possède une **instance indépendante**.
- Par défaut, le registre peut instancier les meshes pour limiter les duplications.
- Pour un **visuel éditable**, utiliser `cloneMeshes = true` : un `InstancedMesh` Babylon.js partage le matériau du mesh source et ne permet pas un aperçu de matériau indépendant. Le clone partage toujours les ressources adaptées avec la source, mais possède son matériau assignable.
- Les groupes d'animations externes sont liés au squelette de chaque instance, puis détruits avec cette instance. Une source GLB ne doit pas être détruite lorsque seul un placement est supprimé.
- Les remplacements de visuels sont préparés avant le basculement : si le chargement échoue, l'ancien visuel reste actif.
- Un visuel d'édition préserve les références de ses matériaux d'origine et les restaure lorsque l'aperçu est retiré. Les matériaux PBR de la source ne sont pas modifiés.

### Cycle de vie

1. Le registre possède les `AssetContainer` chargés (y compris les anciennes versions encore utilisées après un remplacement de fichier local).
2. Le visuel possède son clone/instance et ses ressources spécifiques, et supprime les casters d'ombre avant de détruire ses meshes.
3. Un changement de map libère les représentations de l'ancienne map, pas les sources en cache tant que le registre reste actif.
4. La fermeture du registre attend ses imports locaux en cours avant de libérer les sources. Aucun nouveau chargement n'est accepté ensuite.
5. Le Playground fixe l'identité de l'élément sélectionné avant un import asynchrone et ne doit jamais appliquer ce résultat à une autre sélection.

## Évolution du projet

Pour ajouter un ennemi animé, conserver son archétype et les règles d'IA dans `enemies/`. Le modèle et ses clips restent des données de la définition ; la représentation les charge via le registre et réagit aux états de simulation.

Pour de futurs équipements, **ne pas** introduire dès maintenant un inventaire ou un gestionnaire global de sockets. Un premier équipement pourra posséder sa représentation GLB, être attaché à un os explicite du personnage et être libéré par son propriétaire. La gestion des dégâts et le déplacement resteront indépendants de ces visuels.

Le héros garde volontairement son chargement spécialisé (normalisation du rig, adaptation de clips et animation par couches). Ne déplacer vers une couche commune que les opérations réellement partagées par au moins deux usages.

## Vérifications

Les tests automatisés `world/maps/editableModel.test.ts` et `enemies/enemyScene.test.ts` couvrent les instances GLB indépendantes, les aperçus de matériaux, la restauration et la destruction.

La CI exécute `npm test` et `npm run build`. Une vérification **dans le navigateur** reste nécessaire pour le rendu PBR, les ombres, le remplacement d'assets dans l'éditeur et le fonctionnement des deux modes.

Les clones éditables ont un coût potentiel supérieur aux instances GPU. Ne pas généraliser ce mode à tous les objets sans besoin d'apparence indépendante et sans profilage.
