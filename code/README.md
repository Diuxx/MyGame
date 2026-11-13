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

- Les onze clips de `public/models/hero.glb` sont disponibles dans les modules d’animation. Leurs noms exacts figurent dans `ANIMATIONS.json`. Le héros se tourne vers son déplacement et passe progressivement entre le repos, la marche et la course.
- **Z/S** rapprochent ou éloignent le héros du curseur. **Q/D** le déplacent perpendiculairement à gauche ou à droite. **Maj** permet de courir. Le module **Commandes** permet de modifier ces touches dans le Playground. À l’arrêt, le héros garde sa dernière orientation.
- **Clic droit** lance une esquive dans la direction demandée, ou dans la direction du regard si aucune touche de déplacement n’est enfoncée. La direction reste fixe durant la roulade. La fenêtre d’invulnérabilité couvre 15 % à 65 % du clip et le délai de réactivation est de 500 ms à partir du départ. Le contrôleur expose `isInvulnerable` pour la future réception de dégâts du héros.
- L'attaque est jouée une fois. À la fin, le héros reprend le déplacement si une direction est maintenue, ou revient au repos.
- Contrôles : animation, pause/reprise, vitesse, rotation et inclinaison de la caméra, zoom orthographique et orientation du personnage.
- Le chargement conserve les matériaux, le squelette et les animations du GLB.
- Le personnage est **recalibré automatiquement à 1,8 unité de haut** et ses pieds sont placés au niveau du sol, ce qui compense l'échelle `0.01` du nœud `Armature` exporté par Meshy.
- Le studio a un sol beige mat et une ombre douce projetée par la silhouette animée du héros. La case **Afficher le quadrillage** révèle les repères d'une unité.
- Trois cibles statiques sont disposées devant le héros au démarrage. Dans **Ennemis**, choisir **Nouvel ennemi** pour régler un archétype et le créer près du héros, ou sélectionner une instance pour la modifier, la soigner ou la retirer. Un contour doré repère sa barre de vie. **Afficher les zones de touche** montre les volumes utilisés pour les impacts.
- Pour toucher une cible, s’en approcher et faire un **clic gauche** dans sa direction sur le plateau. Le bouton **Attaque** reste disponible dans le module d’action. L’orientation reste fixe pendant le coup. Le coup teste la portée à 40 % du clip et inflige 25 dégâts de base par cible touchée. Une cible immortelle perd des PV jusqu’à 1. La régénération reprend après le délai configuré depuis le dernier coup.

## Structure

```text
public/models/hero.glb  # Asset Meshy fourni
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

- Le déplacement est limité au sol du playground. Les ennemis sont statiques. Leurs statistiques d'attaque et de vitesse sont éditables, mais ne déclenchent aucun comportement. Le POC ne gère pas les collisions de déplacement, l'IA, l'équipement ou la magie.
- Le repos de combat utilise `Idle_9`. Le nœud `mixamorig:RightHand` est exposé pour le futur attachement d'une épée.
- Le déplacement horizontal du bassin est neutralisé au chargement. La hauteur du bassin reste animée et les pieds ne sont pas verrouillés au sol.
- Le modèle pèse environ 12 Mo. Il faudra optimiser textures et géométrie avant de cibler les mobiles.
- Cette archive ne contient pas `node_modules` ni `dist`. Les dépendances sont téléchargées par `npm install`.

## Provenance des assets

Le fichier `hero.glb` est le modèle Meshy fourni par l'utilisateur. Le projet ne revendique pas de droits nouveaux sur les contenus Meshy.

Les trois GLB de `public/assets/training/` sont des copies des fichiers fournis par l'utilisateur. Leur licence n'a pas été précisée. Leur placement au sol se fait au chargement.
