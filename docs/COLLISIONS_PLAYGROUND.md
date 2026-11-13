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
