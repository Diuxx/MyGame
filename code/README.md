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

Le mode **Gameplay** ouvre une scène provisoire plein écran avec le héros au repos. Le mode **Playground** garde les commandes de test du modèle, des animations et de la caméra.

```bash
npm test    # Tests de géométrie de la caméra et des déplacements
npm run build
```

## Ce qu'on peut tester

- Animations importées **sans retargeting** depuis `public/models/hero.glb` : `Idle_3`, `Walking`, `Running`, `Right_Hand_Sword_Slash`.
- **Z Q S D** déplacent le héros par rapport à l'écran. Maintenir **Maj** pour courir. Le héros s'oriente dans la direction du déplacement et revient au repos à l'arrêt. La caméra le suit.
- L'attaque est jouée une fois. À la fin, le héros reprend le déplacement si une direction est maintenue, ou revient au repos.
- Contrôles : animation, pause/reprise, vitesse, rotation et inclinaison de la caméra, zoom orthographique et orientation du personnage.
- Le chargement conserve les matériaux, le squelette et les animations du GLB.
- Le personnage est **recalibré automatiquement à 1,8 unité de haut** et ses pieds sont placés au niveau du sol, ce qui compense l'échelle `0.01` du nœud `Armature` exporté par Meshy.
- Le studio a un sol beige mat et une ombre douce projetée par la silhouette animée du héros. La case **Afficher le quadrillage** révèle les repères d'une unité.
- Trois cibles statiques sont disposées devant le héros au démarrage et projettent des ombres sur le sol.

## Structure

```text
public/models/hero.glb  # Asset Meshy fourni
src/main.ts             # Sélection du mode et initialisation commune
src/playground.ts       # Contrôles de test du Playground
src/environments.ts     # Sols, lumières, ombre et quadrillage
src/character.ts        # Import, normalisation d'échelle et alignement au sol
src/animations.ts       # Lecture des AnimationGroups
src/scene.ts            # Caméra orthographique commune
src/cameraMath.ts       # Calculs purs pour la caméra
src/cameraMath.test.ts  # Tests des calculs de caméra
src/movement.ts         # Calcul du déplacement au sol
src/movement.test.ts    # Tests des déplacements
src/style.css           # Interface responsive
```

## Valeurs de départ

- Vue orthographique : **40° depuis la verticale** (soit 50° au-dessus de l'horizontale).
- Champ vertical visible : **25 unités**, ajustable de 5 à 40.
- Personnage : **1,8 unité de haut**, centré à l'origine, pieds sur le sol.
- Quatre animations disponibles, reconnues dans le GLB fourni.

Ces valeurs sont des réglages de **playground**, pas des mesures exactes issues de la référence 2D. Une fois la caméra validée, nous pourrons enregistrer les constantes et intégrer une véritable arène.

## Limites

- Le déplacement est limité au sol du playground. Le POC ne gère pas encore les collisions, l'IA, l'équipement ou la magie.
- Le `Right_Hand_Sword_Slash` n'attache pas d'épée automatiquement.
- Les animations Meshy peuvent contenir un léger mouvement du bassin ; on n'a pas encore appliqué de verrouillage des pieds ou de retrait du root motion.
- Le modèle pèse environ 12 Mo. Il faudra optimiser textures et géométrie avant de cibler les mobiles.
- Cette archive ne contient pas `node_modules` ni `dist`. Les dépendances sont téléchargées par `npm install`.

## Provenance des assets

Le fichier `hero.glb` est une copie exacte de `Meshy_AI_Rigged_Character_T_Pose_20261113_animated_mixamo_All_animation.glb`, fourni par l'utilisateur. Le projet ne revendique pas de droits nouveaux sur les contenus Meshy.

Les trois GLB de `public/assets/training/` sont des copies des fichiers fournis par l'utilisateur. Leur licence n'a pas été précisée. Leur placement au sol se fait au chargement.
