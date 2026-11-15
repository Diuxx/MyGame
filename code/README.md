# Idle RPG — Playground 3D

POC minimal **Babylon.js + TypeScript + Vite**, utilisant **le GLB Meshy fourni** par le projet. Le héros se déplace et s'anime dans une scène 3D en caméra top-down inclinée.

## Démarrer

Prérequis : Node.js 20.19+ ou 22.12+ et npm.

```bash
npm install
npm run dev-playground
npm run dev-gameplay
```

Ouvrir l'adresse affichée par Vite (généralement `http://localhost:5173`).

`npm run dev` lance le Playground. Le build de production et sa prévisualisation utilisent aussi le Playground par défaut.

Le mode **Gameplay** ouvre une scène provisoire plein écran avec le héros contrôlable. Le mode **Playground** ajoute les commandes de test du modèle, des animations, de la caméra et des cibles.

```bash
npm test    # Tests de géométrie de la caméra et des déplacements
npm run build
```

## Ce qu'on peut tester

- Les neuf clips du héros sont chargés depuis `public/assets/animations/hero/`. Leurs noms figurent dans `ANIMATIONS.json`. Relâcher les touches de déplacement en pleine course déclenche l’animation d’arrêt.

### Paramètres du héros dans ANIMATIONS.json

- `animations` décrit les clips, leur nom affiché, leur catégorie et leur boucle. `durationSeconds` documente la durée du GLB. Le moteur lit la durée réelle du clip pour calculer les fenêtres d’action.
- `settings` contient les valeurs par défaut de déplacement, de lecture, d’impact et d’esquive. `syncReference` dans chaque clip de locomotion indique la cadence de référence pour l’option de synchronisation.
- `transitions` et `blending` règlent les fondus, le masque haut du corps et le clip qui anime les jambes en garde.
- `controller` règle la garde après un coup donné ou reçu, le verrouillage de l’orientation, le déplacement pendant l’attaque, l’orientation générale et le recul de l’esquive.

Dans **Animations de déplacement**, **Exporter ANIMATIONS.json** inclut les valeurs réglées dans le Playground et conserve les autres sections. Le fichier téléchargé peut remplacer le manifeste. Les préférences du navigateur restent prioritaires dans le Playground.
- **Z/S** rapprochent ou éloignent le héros du curseur. **Q/D** le déplacent perpendiculairement à gauche ou à droite. **Maj** permet de courir. Le module **Commandes** permet de modifier ces touches dans le Playground. À l’arrêt, le héros garde sa dernière orientation.
- **Clic droit** lance une esquive dans la direction demandée, ou dans la direction du regard si aucune touche de déplacement n’est enfoncée. La direction reste fixe durant la roulade. La fenêtre d’invulnérabilité couvre 15 % à 90 % du clip par défaut (réglable) et le délai de réactivation est de 500 ms à partir du départ. Le contrôleur expose `isInvulnerable` pour la future réception de dégâts du héros.
- L'attaque est jouée une fois. À la fin, le héros reprend le déplacement si une direction est maintenue, ou revient au repos.
- Contrôles : animation, pause/reprise, vitesse, rotation et inclinaison de la caméra, zoom orthographique et orientation du personnage.
- Le chargement conserve les matériaux, le squelette et les animations du GLB.
- Le personnage est **recalibré automatiquement à 1,8 unité de haut** et ses pieds sont placés au niveau du sol, ce qui compense l'échelle `0.01` du nœud `Armature` exporté par Meshy.
- Le studio a un sol beige mat et une ombre douce projetée par la silhouette animée du héros. La case **Afficher le quadrillage** révèle les repères d'une unité.
- Trois cibles statiques sont disposées devant le héros au démarrage. Dans **Ennemis**, choisir **Nouvel ennemi** pour régler un archétype et le créer près du héros, ou sélectionner une instance pour la modifier, la soigner ou la retirer. Un contour doré repère sa barre de vie. Dans **Collisions et hitbox**, on peut afficher la hurtbox rouge du héros, les hurtboxes cyan des ennemis et leurs colliders solides jaunes.
- Pour toucher une cible, s’en approcher et faire un **clic gauche** dans sa direction sur le plateau. Le bouton **Attaque** reste disponible dans le module d’action. L’orientation reste fixe pendant le coup. Le coup teste la portée à 40 % du clip et inflige 25 dégâts de base par cible touchée. Une cible immortelle perd des PV jusqu’à 1. La régénération reprend après le délai configuré depuis le dernier coup.

## Structure

```text
public/models/hero.glb  # Modèle Meshy riggé et texturé
src/main.ts             # Sélection du mode et initialisation commune
src/playground.ts       # Contrôles de test du Playground
src/character/          # Chargement du héros, animations, entrées et mouvement
src/combat/             # Dégâts, régénération et détection d'impact
src/enemies/            # Archétypes JSON, instances et représentation 3D
src/world/              # Caméra, sol, éclairage et ombres
src/playground/         # Création et inspection des ennemis
src/ui/                 # Utilitaires DOM
src/style.css           # Interface responsive
```

Les conventions d'architecture sont dans [la référence du projet](../docs/PROJECT.md).

## Valeurs de départ

- Vue orthographique : **40° depuis la verticale** (soit 50° au-dessus de l'horizontale).
- Champ vertical visible : **25 unités**, ajustable de 5 à 40.
- Personnage : **1,8 unité de haut**, centré à l'origine, pieds sur le sol.

Ces valeurs sont des réglages de **playground**, pas des mesures exactes issues de la référence 2D. Une fois la caméra validée, nous pourrons enregistrer les constantes et intégrer une véritable arène.

## Limites

- Le déplacement est limité au sol du playground. Le héros et les mannequins disposent de colliders physiques circulaires au sol : marche, course et esquive ne traversent pas les mannequins solides. Les ennemis restent statiques ; leurs statistiques d'attaque et de vitesse ne déclenchent encore aucun comportement. Les ennemis mobiles, l'IA et la magie ne sont pas implémentés dans ce playground.
- Après un coup porté ou reçu, le héros passe en posture de combat pendant 5 secondes. À l’arrêt il joue `combat-stance`. En mouvement, le haut du corps reste en garde et les jambes jouent `walk` à la cadence de combat.
- Le déplacement horizontal du bassin est neutralisé au chargement. La hauteur du bassin reste animée et les pieds ne sont pas verrouillés au sol.
- Le modèle pèse environ 12 Mo. Il faudra optimiser textures et géométrie avant de cibler les mobiles.
- Cette archive ne contient pas `node_modules` ni `dist`. Les dépendances sont téléchargées par `npm install`.

## Provenance des assets

Le fichier `hero.glb` provient du modèle Meshy fourni par l'utilisateur. Le projet ne revendique pas de droits nouveaux sur les contenus Meshy.

Pour régénérer le modèle et les clips, passer le GLB source animé au script depuis la racine du dépôt. Il remplace le modèle de jeu et écrit les clips à partir des noms déclarés dans `ANIMATIONS.json`.

```text
node code/tools/extractHeroAnimations.mjs chemin/vers/hero-anime.glb
```

Pour convertir un GLB en FBX sans les textures Metallic et Roughness,
lancer le script Node depuis la racine du dépôt. Il utilise Blender
en arrière-plan. Le lanceur cherche Blender dans le PATH puis dans
le dossier d’installation standard sous Windows. Pour choisir un autre
exécutable, définir `BLENDER_PATH` dans PowerShell, par exemple avec
`$env:BLENDER_PATH = 'C:\Program Files\Blender Foundation\Blender 5.3\blender.exe'`.
Le FBX intègre les textures prises en charge par l’exporteur, dont la
couleur de base et la normal map. Les valeurs numériques de Metallic
et Roughness restent disponibles.

```powershell
node code/tools/exportFbx.mjs "chemin/vers/modele.glb" "chemin/vers/modele.fbx"
```

Le chemin de sortie est facultatif. Par défaut, le FBX est créé à côté
du GLB avec le même nom. Choisir un nouveau chemin si un FBX existe déjà.

Pour convertir un FBX qui contient une armature et une seule animation
en clip GLB indépendant, utiliser le même Blender depuis Node.

```powershell
node code/tools/convertFbxAnimation.mjs "chemin/vers/mutant-run.fbx" "chemin/vers/run.glb"
```

Le clip reprend le nom de sortie en minuscules, ici `run`. Par défaut,
le GLB est créé à côté du FBX. Un chemin existant est refusé.
Le clip contient les nœuds du squelette et les courbes d’animation,
sans maillage ni textures. Le déplacement de la racine du FBX est conservé.
Pour l’utiliser sur un personnage, il faut un squelette et une pose de
repos compatibles. Pour le gobelin, voir
[la conversion avec adaptation au rig](../docs/GOBELIN_POC.md).

Les clips `run` et `walk` du héros viennent des FBX Mixamo dans
`public/assets/animations/hero/fbx/`. L’option `--target` adapte le
clip à la pose de repos du héros et conserve le mouvement vertical
du bassin. Le jeu applique le déplacement horizontal.

```powershell
node code/tools/convertFbxAnimation.mjs "code/public/assets/animations/hero/fbx/run.fbx" "exports/run.glb" --target "code/public/models/hero.glb"
```

Remplacer ensuite `code/public/assets/animations/hero/run.glb` par
ce fichier. Pour la marche, utiliser `walk.fbx` et `walk.glb`.
Préparer les téléchargements Mixamo sur le personnage cible pour
obtenir les mêmes noms et la même hiérarchie d’os.

Les trois GLB de `public/assets/training/` sont des copies des fichiers fournis par l'utilisateur. Leur licence n'a pas été précisée. Leur placement au sol se fait au chargement.


## Presets d'ennemis et collisions (branche de développement)

Dans **Ennemis**, les boutons **Sauvegarder / Charger** conservent localement les types, positions et statistiques des instances. **Exporter / Importer JSON** permet d'échanger les presets versionnés. Le chargement ne restaure pas les PV courants : les instances apparaissent avec leur santé maximale. Une erreur de validation ou de chargement conserve les instances précédentes.

La détection des coups est géométrique et séparée du rendu, avec prise en charge des boîtes orientées dans le calcul pur. La collision bloquant les déplacements et le suivi exact de la lame animée ne sont pas encore implémentés. Voir [`docs/COMBAT_ARCHITECTURE.md`](../docs/COMBAT_ARCHITECTURE.md).

## Collisions et transitions (branche de développement)

Dans le module **Collisions et hitbox**, active ou désactive les collisions, affiche les volumes de debug et règle le rayon, la hauteur et le décalage vertical de la hitbox rouge du héros. Les ennemis possèdent un rayon solide configurable individuellement dans **Gestion des ennemis**, enregistré dans les presets JSON.

Les durées de fondu de déplacement, de retour au repos et de ralentissement sont ajustables dans **Animations de déplacement** et sauvegardées localement. Lorsque le héros se heurte à une cible, l'animation de locomotion dépend du déplacement réellement effectué ; il revient au repos s'il est complètement bloqué. Le détail technique et les essais manuels figurent dans [la documentation des collisions](../docs/COLLISIONS_PLAYGROUND.md).

## Hitboxes d'attaque et cycle de vie

L’attaque du haut du corps se joue au repos et en déplacement. Le clic droit
déclenche une esquive vers l’arrière avec une fenêtre d’invincibilité. Dans
**Gestion des ennemis**, **Simuler la mort** déclenche la chute du héros et le
compte à rebours de réapparition.

Le menu de droite expose des cases rapides pour masquer la hitbox rouge du
héros et la zone d'attaque orange. Le module **Zone d'attaque / Portée**
permet de régler la portée, le rayon, la hauteur et les dégâts ; la zone
orange se dessine pendant toute l'animation d'attaque, avec une option de
prévisualisation permanente. Les coups restent déclenchés uniquement pendant
leurs fenêtres d'impact, et leurs calculs utilisent les mêmes paramètres
que la visualisation.

## Maps 3D modulaires (P1)

Le catalogue `public/assets/definitions/assets.json` regroupe les tuiles,
les décors et les définitions d’ennemis et de cibles. Une carte peut définir
`"enemyCatalog": "/assets/definitions/enemies-hard.json"` pour ajouter des
ennemis ou remplacer une définition du catalogue par son identifiant. Ce
fichier contient un tableau de définitions complètes. Un ennemi peut
définir `placementAI` pour les nouveaux placements depuis l’éditeur.
Les niveaux sont définis dans `public/assets/maps/*.json`. Le Gameplay charge automatiquement le
dojo ; le Playground propose un module **Maps 3D modulaires** pour
charger, changer, décharger une map et afficher ses colliders.

Les GLB de tiles et de décor sont actuellement absents : les modèles
manquants sont remplacés par des boîtes/cylindres issus des volumes
de collision (ou une dalle pour le sol), avec le nom du fichier
attendu. Le héros est bloqué par les volumes statiques décrits dans
les données JSON. Les colliders sont indépendants du modèle 3D.

Voir [docs/MAPS_3D.md](../docs/MAPS_3D.md) pour les formats, exemples,
contraintes actuelles, commandes et étapes de vérification.

## Ambiance des maps et ennemis autonomes

Les maps peuvent maintenant définir `environment`, `enemySpawns`,
`waves` et `events` dans leurs JSON. Les ennemis sont construits
avec des primitives Babylon.js lorsque leur GLB est absent, et
partagent les règles de dégâts, les collisions et un système d'aggro
indépendant du rendu. Le Playground affiche les zones de détection,
les états de l'IA, les vagues et la progression des boss.

Guide de configuration : [docs/ENCOUNTERS_AMBIENCE.md](../docs/ENCOUNTERS_AMBIENCE.md).

## Éditeur de monde du Playground

Ouvrir le module **Éditeur de monde** sur le terrain du Playground ou
après avoir chargé une carte. Choisir une tuile,
un décor ou un ennemi dans le catalogue active l’édition. Cliquer dans
la scène pose l’élément ou remplace la tuile. Les éléments déjà posés
peuvent être déplacés en maintenant le clic gauche, y compris les
mannequins du module **Gestion des ennemis**. Ce module conserve la
sauvegarde et l’export des mannequins d’entraînement existants.
Exporter le JSON après édition ; les assets importés localement
doivent être copiés dans `public/assets`. Interactions à proximité
avec la touche **F** par défaut (ramassage, inspection). Guide :
[docs/PLAYGROUND_WORLD_EDITOR.md](../docs/PLAYGROUND_WORLD_EDITOR.md).
