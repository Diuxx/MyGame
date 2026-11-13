# Création de personnages 3D — guide débutant

## Les notions

- **Mesh (maillage)** : forme 3D du personnage, composée de sommets et de faces.
- **Matériau / texture** : couleurs et détails visibles à sa surface.
- **Rig (armature / squelette)** : structure d'os virtuels pour déplacer bras, jambes et tête.
- **Skinning** : association des parties du maillage aux os.
- **Animation** : séquence de positions du rig (repos, course, attaque, esquive, mort).
- **GLB** : format de livraison qui peut contenir géométrie, matériaux, textures et animations.

## Workflow conseillé pour ce projet

1. **POC immédiat** : conserver les formes simples déjà présentes dans `Hero.ts` et `Enemy.ts`.
2. **Modèle temporaire** : récupérer un personnage low-poly dont la licence autorise l'usage visé.
3. **Adapter le personnage** : utiliser [Blender](https://www.blender.org/) pour modifier silhouette, proportions, couleurs et équipements.
4. **Ajouter un squelette** : créer un rig dans Blender ou utiliser l'auto-rigging [Mixamo](https://www.mixamo.com/) pour un personnage humanoïde.
5. **Animations** : préparer `Idle`, `Run`, `Attack`, `Dodge` (plus tard `Cast`, `Hit`, `Death`). Les animations peuvent venir de Mixamo ou être créées dans Blender.
6. **Exporter** : dans Blender, `File > Export > glTF 2.0`, format `glTF Binary (.glb)` ; inclure les animations.
7. **Intégrer dans le jeu** : placer `hero.glb` dans `public/models/`, charger le modèle via le loader Babylon.js, puis attacher le modèle au nœud `hero-root`.
8. **Tester sur mobile** : silhouettes lisibles, maillage raisonnable, textures de taille adaptée, peu de matériaux et d'os.

## Comprendre le rig

Un personnage non riggé est une statue : Babylon.js peut déplacer le bloc entier, mais pas faire courir les bras et les jambes. Le rig permet de jouer les animations sans coder le mouvement de chaque membre.

## Exemple de chargement d'un GLB

L'importeur est déjà déclaré dans `package.json` (`@babylonjs/loaders`). À ajouter lorsque le `.glb` est disponible :

```ts
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

// scene : scène Babylon.js ; heroRoot : TransformNode existant.
const result = await ImportMeshAsync("/models/hero.glb", scene);
const modelRoot = result.meshes[0];
modelRoot.parent = heroRoot;

// Les groupes d'animation sont aussi disponibles dans result.animationGroups.
const idle = result.animationGroups.find(group => group.name === "Idle");
idle?.start(true);
```

Selon l'export GLB, le premier mesh importé peut être un nœud racine de transformation. Vérifier les dimensions, les axes, l'orientation et le pivot. Pour intégrer proprement un modèle, **conserver un nœud racine de gameplay distinct des maillages visuels**, et cacher/supprimer l'ancienne géométrie provisoire.

## Logiciels et ressources

| Outil | Utilité | Usage prévu |
| --- | --- | --- |
| [Blender](https://www.blender.org/) | Modélisation, matériaux, rigging, animation, export GLB | Outil 3D principal |
| [Mixamo](https://www.mixamo.com/) | Auto-rigging humanoïde, bibliothèque d'animations | Accélérer le POC |
| [Blockbench](https://blockbench.net/) | Modélisation low-poly facile et petites animations | Décors, monstres simples et accessoires |
| [Quaternius](https://quaternius.com/) | Packs de modèles 3D prêts à personnaliser | Prototypage ; vérifier la licence du pack |
| [Kenney](https://kenney.nl/assets) | Assets de prototypage | Environnements et objets ; vérifier chaque licence |
| [Babylon.js Sandbox](https://sandbox.babylonjs.com/) | Prévisualiser des modèles GLB / glTF | Vérifier les exports avant intégration |

**Licences :** consulter les conditions propres à chaque téléchargement, même pour des assets gratuits. Quaternius affiche maintenant une licence spécifique sur son site ; d'anciens packs peuvent porter des indications différentes. Ne pas supposer que tous les fichiers ont la même licence.

## Plan artistique minimal

Pour une esthétique stylisée, inspirée par la lisibilité d'Albion Online et la douceur d'AFK Journey :

- commencer par **un humanoïde low-poly** facile à animer ;
- utiliser des matériaux colorés peu détaillés, plutôt que de lourdes textures photoréalistes ;
- privilégier des silhouettes d'épée et d'armure visibles depuis une caméra distante ;
- réserver les effets complexes pour les boss et la magie ;
- concevoir l'équipement comme des pièces indépendantes plus tard, sans le coder dès le POC.

## Prochaine étape de production

Ne pas modéliser intégralement un héros original avant de vérifier que le passage auto/manuel et l'esquive sont agréables. Un **modèle humanoïde riggé gratuit**, avec quatre animations, suffit pour la deuxième itération.
