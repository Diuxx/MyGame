# Collision du héros et transitions d'animation (Playground)

> Document technique évolutif. Ne modifie pas la vision immuable du projet.

## Objectif du POC

Permettre au héros de se déplacer (marche, course, esquive) sans traverser les cibles
statiques, tout en affichant les volumes et en ajustant rapidement les paramètres.

## Vocabulaire et représentation

- **Hurtbox du héros** (rouge) : cylindre de debug. Pour ce POC son rayon est aussi
  utilisé comme rayon de collision au sol ; la hauteur et l'offset Y ne participent
  pas à la collision horizontale.
- **Hurtbox de l'ennemi** (cyan) : cylindre ou boîte défini par l'archétype JSON.
  Sert à détecter les coups d'épée. Cette zone peut être plus grande que son volume solide.
- **Collider solide de l'ennemi** (jaune) : disque au sol qui bloque le déplacement,
  indépendant de son rendu et de sa hurtbox. Dimensions modifiables par instance.
- **Hitbox d'attaque** : capsule horizontale calculée par `combat/hitDetection.ts`
  pendant les fenêtres d'impact. Elle ne pousse pas le héros.

Les colliders physiques ont volontairement une forme **circulaire 2D** sur le plan XZ.
Ils ne simulent ni gravité, ni ragdoll, ni la collision polygonale exacte des GLB.

## Architecture

- `combat/bodyCollision.ts` : détection continue (*swept circle*) et glissement tangent,
  sans Babylon.js.
- `enemies/enemyManager.ts` : transforme les ennemis actifs solides en obstacles et
  résout un déplacement du héros. Les ennemis vaincus ne bloquent plus le passage.
- `enemies/enemyState.ts` : surcharge optionnelle `collision: { solid, radius }`
  par instance. Sans surcharge, le rayon provient de la hurtbox de l'archétype.
- `enemies/enemyScene.ts` : affiche les volumes de debug, sans décider des collisions.
- `character/characterController.ts` : passe les déplacements ordinaires et l'esquive
  par le même résolveur injecté. Seul le **déplacement réellement accompli** déclenche
  la locomotion, afin de revenir au repos quand le héros est complètement bloqué.
- `playground/collisionTools.ts` : éditeur des dimensions de la hitbox du héros,
  activation de la collision et visibilité des trois volumes. Préférences validées
  puis sauvegardées dans le localStorage du navigateur.
- `character/transitionSettings.ts` et `playground/transitionTools.ts` : durées
  de transition marche/repos/ralentissement ajustables et sauvegardées.
- `enemies/enemyPersistence.ts` : conserve la configuration individuelle du
  collider dans le format JSON version 1 ; les anciens fichiers restent compatibles.

## Test manuel dans le navigateur

1. Lancer `cd code && npm ci && npm run dev-playground`.
2. Ouvrir **Collisions et hitbox** ; cocher les volumes rouge, cyan, jaune.
3. Marcher et courir droit vers un mannequin, puis le contourner en diagonale.
4. Esquiver vers un mannequin : le héros ne doit pas le traverser.
5. Réduire ou augmenter le rayon du héros ; observer les distances d'arrêt.
6. Dans **Gestion des ennemis**, désactiver **Bloque les déplacements**
   puis appliquer ; le héros doit pouvoir traverser cette instance.
7. Ajuster **Rayon solide**, sauvegarder la scène, puis exporter et réimporter le JSON.
8. Dans **Animations de déplacement**, ajuster les trois durées ; comparer les
   retours au repos lorsqu'un mannequin arrête totalement le mouvement.

## Limitations et suite

- Le héros est le seul acteur mobile. L'IA ennemie n'est pas implémentée.
- Les colliders ennemis utilisent des disques, même si la hurtbox de combat est
  rectangulaire. Le résultat est volontairement conservateur et fluide.
- Les hurtboxes de combat des ennemis restent définies par les archétypes JSON ;
  seule leur zone **solide** est éditable par instance dans ce lot.
- Le jeu en mode `dev-gameplay` n'instancie pas encore d'ennemis ; ses déplacements
  restent libres en l'absence d'obstacles.
- Aucun clip de réaction aux dégâts n'est requis pour les mannequins statiques.
  Les réactions, attaques télégraphiées et animations des ennemis mobiles viendront
  avec les prochains modèles animés.
- Les changements de contrôleur auto/manuel et les collisions de personnages
  mobiles devront partager le même résolveur, sans dupliquer les règles.

## Vérifications

- Tests purs : `npm test`.
- TypeScript + bundle : `npm run build`.
- Inspection visuelle des volumes/animations dans Chromium et sur mobile.

## Portée de l'épée et contrôle du katana dégainé

- **Hitbox d'attaque** (orange) : visualisation en temps réel de la zone
  mathématique de l'épée (capsule horizontale tronquée derrière le héros).
  La représentation est activée pendant toute l'animation d'attaque, pour faciliter
  les tests. Les dégâts, eux, ne sont appliqués qu'aux fenêtres d'impact définies
  dans **Animations d'action**. Le volume affiché ne suit pas physiquement le
  katana animé : il suit l'orientation du héros.
- Le module **Zone d'attaque / Portée** règle la longueur de l'attaque, son rayon
  latéral, sa hauteur et les dégâts de base. Ces paramètres sont transmis au
  **même calcul** que celui qui touche les ennemis via `enemyManager.strike`.
  La zone visible ne sert pas elle-même de source de collisions.
- Le menu latéral propose deux cases d'affichage rapide :
  **Hitbox du héros (rouge)** et **Zone d'attaque (orange)**. Chaque case est
  synchronisée avec son éditeur avancé. Il est possible de laisser la zone
  orange visible en permanence pour tester la portée à l'arrêt.
- Dans **Équipement**, la section *Orientation de la lame dégainée* règle les
  rotations X/Y/Z en degrés. Le katana pivote autour de son attache à la main
  (un `TransformNode` dédié), sans modifier l'orientation du squelette ou
  l'attache de la main droite.
- Les réglages de la lame restent dans la sauvegarde locale
  `mon-rpg.playground.equipment.v1`, compatible avec les anciennes valeurs
  `back` et `hand`. L'attaque est enregistrée séparément dans
  `mygame.playground.attack-hitbox.v1`.

### Vérifications manuelles complémentaires

1. Dégainer le katana depuis le module Équipement. Changer les rotations X/Y/Z
   et vérifier la position de la lame au repos et pendant l'attaque.
2. Recharger la page : la rotation de la lame doit être conservée. Cliquer sur
   « Rétablir l’orientation de la lame » pour revenir à l'alignement initial.
3. Masquer et réafficher la hitbox rouge du héros depuis la barre de droite,
   puis vérifier que la case du module Collisions reste synchronisée.
4. Activer l'affichage de l'attaque, puis attaquer à gauche de l'écran :
   la forme orange doit se tourner avec le héros, et disparaître à la fin
   de son animation (sauf si la prévisualisation permanente est activée).
5. Changer la portée et les dégâts dans **Zone d'attaque / Portée**.
   Vérifier que la distance de touche et les PV perdus évoluent ensemble.

**Limite :** cette première zone d'attaque est une capsule simplifiée, pas une
simulation de la trajectoire précise de la lame. Plus tard, une hitbox animée
pourra suivre les bones ou les points d'attache du katana, tout en conservant
le même système de dégâts.
