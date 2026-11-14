# Maps vivantes : ambiance, ennemis, IA et événements (MVP)

> Documentation technique évolutive. Les fichiers fondateurs
> `docs/PROJECT.md` et `docs/PROJETCT.md` ne doivent pas être modifiés.

## Démarrer

```bash
git switch feature/map-ambience-enemy-ai
cd code
npm ci
npm test
npm run build
npm run dev-playground
# ou npm run dev-gameplay
```

Le module **Maps 3D modulaires** du Playground permet de charger `dojo`
ou `forest`, d'afficher les volumes de collision et **les cercles d'aggro**,
puis de réinitialiser la progression enregistrée. Le HUD affiche les PV du héros
et les événements. En mode Gameplay, `dojo` démarre automatiquement.

### Sans GLB

Les quatre ennemis du catalogue `src/enemies/fieldEnemyDefinitions.json`
utilisent actuellement des **formes provisoires** (cylindres, boîtes) et
des étiquettes. Si un modèle valide est ajouté à son chemin `modelPath`,
il est instancié automatiquement à la place de la forme provisoire.
Les règles de combat, les hurtboxes et la navigation ne dépendent jamais
de ces meshes. Les mannequins statiques existants restent gérés par
`enemyDefinitions.json` et le module de test habituel.

## 1. Ambiance dans le même fichier map.json

Ajouter une section optionnelle `environment` :

```json
{
  "environment": {
    "background": "#B7C9C3",
    "ambient": { "color": "#D5E3EA", "intensity": 0.66 },
    "sun": {
      "direction": [-0.65, -1.4, 0.35],
      "color": "#FFE1AF",
      "intensity": 1.05,
      "shadows": { "enabled": true, "darkness": 0.3, "resolution": 1024 }
    },
    "fog": { "enabled": false, "color": "#C5CFCA", "density": 0.005 }
  }
}
```

Couleurs en `#RRGGBB`, direction en unités du monde (Y négatif),
résolution autorisée `512`, `1024` ou `2048`. La configuration est
strictement validée. L'absence de section est rétrocompatible et applique
des valeurs par défaut.

Le `createEnvironmentController` modifie **la lumière directionnelle,
la lumière hémisphérique et le ShadowGenerator déjà créés** dans
`world/environments.ts` : pas de deuxième soleil. Les meshes du décor
et les silhouettes ennemies projettent des ombres, les tiles les reçoivent.
Le nouveau soleil réoriente aussi la lumière suiveuse du héros.
Le changement de map réapplique son ambiance ; le déchargement revient
aux valeurs par défaut. Ombres filtrées PCF ; aucun baked lighting.

## 2. Catalogue et spawns

La map peut ajouter `enemySpawns`, `waves` et `events` sans modifier
la version du format JSON (toujours **version 1**, champs optionnels).

```json
{
  "enemySpawns": [
    {
      "id": "door-guard",
      "enemyId": "dojo-guard",
      "position": [12, 0, 4],
      "rotationY": 180,
      "activation": { "mode": "always" },
      "respawn": { "mode": "afterDelay", "delaySeconds": 16 },
      "ai": {
        "profile": "guard",
        "aggroRadius": 4.5,
        "attackRange": 1.5,
        "leashRadius": 7,
        "attackCooldown": 2,
        "skills": ["slash"]
      }
    }
  ]
}
```

- `activation.mode = always` : présent dès le début de la map.
- `activation.mode = wave` : attend l'activation de la vague `waveId`.
- `respawn.mode = never` : reste mort dans la session courante.
- `respawn.mode = afterDelay` : réapparaît après `delaySeconds`.
- `persistDeath: true` exige `respawn.mode = never` ; la mort est
  sauvegardée même après rechargement de la page.
- Les ennemis des vagues ne respawnent pas (afin que les vagues
  puissent se terminer).
- `enemyId` référence le catalogue de définitions, et **pas** le chemin
  du GLB. Les valeurs de statistiques, hurtboxes et dimensions
  proviennent de ce catalogue.

## 3. IA des ennemis

L'IA produit des intentions de mouvement et d'attaque dans une simulation
pure TypeScript (`enemies/mapEnemySimulation.ts`). Babylon.js ne gère
que leur présentation (`enemies/mapEnemyScene.ts`).

Le cercle d'aggro (`aggroRadius`) active la poursuite du héros.
`attackRange` indique quand préparer une attaque ; `leashRadius`
borne la poursuite autour du point d'apparition. La silhouette regarde
vers sa cible ; l'attaque possède un **windup** visible en rouge au sol
avant de toucher le héros.

| Profil | Comportement |
|---|---|
| `guard` | Garde sa position, poursuit et retourne au point de départ |
| `patrol` | Suit en boucle les positions du tableau `patrol` ; aggro interrompt la ronde |
| `aggressive` | Poursuite directe dans le périmètre de leash |
| `ranged` | Maintient une distance et recule si le héros est trop près |

Compétences MVP : `slash` (coup frontal), `cleave` (coup frontal
plus large et plus puissant), `bolt` (attaque à distance après
télégraphe), `heal` (auto-soin si PV bas). Ces compétences sont
choisies dans `ai.skills` ou imposées par une phase de boss.
Le calcul des dégâts des ennemis et du joueur utilise les
règles communes de `combat/`, et l'esquive du héros annule les dégâts
pendant sa fenêtre d'invulnérabilité.

Le héros dispose de **100 PV** dans ce POC ; mort : blocage des
actions, puis réapparition au spawn `player` après 2 secondes
avec 1,5 seconde de protection. Les données du HUD ne sont
pas stockées dans les JSON de map.

## 4. Boss, vagues, événements et persistance

```json
{
  "waves": [
    { "id": "first", "starts": "always" },
    { "id": "boss", "starts": "afterPrevious" }
  ],
  "events": [
    {
      "id": "dojo-victory",
      "when": { "type": "enemyDefeated", "target": "ancient-guardian" },
      "message": "Victoire !"
    }
  ]
}
```

Les ennemis d'une vague ont `activation: { "mode": "wave",
"waveId": "first" }`. Quand tous les membres d'une vague sont
vaincus, elle se termine et la vague suivante (`afterPrevious`)
peut commencer. Les événements MVP sont **des annonces** :
`enemyDefeated`, `waveCleared` et `bossPhase`. Ils ne sont pas
des scripts arbitraires et ne déclenchent aucun code contenu dans
les JSON. Les déclencheurs par zone, portes et cinématiques pourront
être ajoutés avec des actions explicitement validées.

Un boss est un ennemi normal plus des phases :

```json
{
  "boss": {
    "phases": [
      { "belowHealth": 0.7, "attackSpeedMultiplier": 0.75, "skill": "cleave" },
      { "belowHealth": 0.3, "attackSpeedMultiplier": 0.55, "skill": "bolt" }
    ]
  }
}
```

Les seuils (proportions de santé) doivent décroître. À chaque seuil,
un événement est émis et les attaques suivantes utilisent les
paramètres de la phase. `persistDeath: true` préserve la mort des
boss. Les vagues déjà terminées sont également conservées via
`localStorage` (`mygame.map-progress.v1.<mapId>`). La sauvegarde
est isolée par map et le bouton du Playground permet de la remettre
à zéro. Si le stockage navigateur est indisponible, l'échec est
signalé dans la console et la session en mémoire reste jouable.

## 5. Architecture

- `world/maps/environmentSettings.ts` : validation ambiance pure.
- `world/environmentController.ts` : adaptation Babylon des lumières.
- `enemies/mapEnemyConfig.ts` : schéma validé des spawns, IA,
  compétences, boss, vagues et annonces.
- `enemies/mapEnemySimulation.ts` : états `idle`, `patrol`,
  `chase`, `windup`, `return`, `dead`, dégâts et progression.
- `enemies/mapEnemyScene.ts` : modèles, primitives, barres de PV,
  labels et aggro/attaque debug.
- `enemies/mapProgress.ts` : sérialisation versionnée de la progression.
- `combat/heroVitals.ts` : vie, défaite et respawn du joueur.
- `world/maps/mapSystem.ts` : orchestration du cycle de vie du niveau,
  des lumières et de la rencontre, sans modifier les APIs de base du
  contrôleur.
- `ui/heroHud.ts` : affichage de la vie et des annonces.

## 6. Vérifications et limites

Les tests TypeScript purs couvrent la validation du JSON, la détection,
le retour à l'origine, les dégâts avec télégraphe, le respawn, le déblocage
des vagues, la transition de phase, et la persistance.

La visualisation doit également être vérifiée manuellement : ouvrir
`dojo` dans le Playground, afficher les cercles d'aggro, combattre
la sentinelle jusqu'à sa mort et son retour, vaincre la vague, puis
observer le boss. Tester `forest` pour les profils patrouilleur et
archer. Décharger/recharger une map et vérifier que seules les morts
persistantes subsistent.

**Limites du MVP :** pas de A*, un ennemi peut rester bloqué par
un obstacle dont le contournement demande un chemin complexe ;
`bolt` ne teste pas encore la ligne de vue ; pas de projectiles
physiques ni d'animations de personnages, les télégraphes sont
des disques simplifiés ; le profil `guard` et `aggressive` partagent
encore largement leurs décisions de poursuite ; les événements
annoncent uniquement des messages ; pas de sauvegarde cloud.

Ne pas fusionner sans tester aussi le rendu dans le navigateur.
