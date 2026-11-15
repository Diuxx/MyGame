# Target Lock — verrouillage de cible (POC)

Le Target Lock utilise un **ZQSD relatif à la caméra par défaut**, sans suivi du curseur. Lorsqu'une cible est verrouillée, le héros se tourne vers elle tout en conservant ses commandes de déplacement. Le verrouillage est **autorisé par défaut** dans `code/TARGETING.json`, mais **aucune cible n'est acquise par proximité**.

## Déclenchement et annulation

1. Depuis `code/`, lancer `npm run dev-playground` ou `npm run dev-gameplay`.
2. **Coup réussi :** la première cible vivante réellement touchée est verrouillée si aucune cible n'est encore sélectionnée. Une attaque ratée ne déclenche rien.
3. **W :** sélectionner l'ennemi vivant le plus proche dans le rayon d'acquisition, puis parcourir les autres cibles à portée.
4. **X :** annuler immédiatement le ciblage et revenir au ZQSD classique.
5. **Cible trop éloignée :** au-delà du rayon de perte, elle est automatiquement libérée. Même si elle revient dans la zone, aucune nouvelle cible n'est choisie avant un prochain coup réussi ou un appui sur W.
6. **Mort / suppression / inactivité de la cible :** déverrouillage immédiat sans nouveau ciblage automatique.

En mode normal, la direction des touches ZQSD dépend de la caméra et le héros regarde le sens du mouvement ; à l'arrêt, il garde sa dernière orientation. La souris ne détermine jamais la direction des mouvements ou des attaques. Avec un verrouillage, le héros regarde sa cible, que le référentiel de déplacement sélectionné soit **Caméra** (ZQSD dans les directions visibles) ou **Cible** (Z/S avancent/reculent et Q/D tournent autour).

Le verrouillage automatique par attaque réussie, l'annulation X et la sélection W sont disponibles dans le Playground **et** dans le mode Gameplay. Le Playground permet en plus de modifier à chaud les paramètres et de remapper W/X dans **Commandes**. Une case permet de désactiver complètement le ciblage pour tester le mode libre.

## Configuration

`code/TARGETING.json` est la source versionnée :

- `enabled` — autoriser l'acquisition sur coup réussi et via W.
- `acquireRadius` — rayon dans lequel W peut sélectionner les cibles.
- `releaseRadius` — distance maximale de conservation de la cible, même si l'ennemi recule.
- `turnSpeed` — vitesse de rotation du héros vers sa cible.
- `movementReference` — `camera` ou `target`.
- `showTargetRing` — anneau rouge sous l'ennemi verrouillé.
- `showDebugRadius` — indication du rayon de sélection (debug).

Dans le Playground, les changements sont appliqués immédiatement et mémorisés sous `mon-rpg.playground.target-lock.v1`. Utiliser **Exporter TARGETING.json** pour enregistrer les paramètres dans le dépôt, **Importer** pour charger une configuration validée et **Rétablir** pour effacer les surcharges locales. Une ancienne surcharge locale avec `enabled: false` continue de désactiver le mode : la réinitialiser ou cocher **Activer le ciblage au combat** pour tester le nouveau défaut.

## Architecture et limites

- `character/targetSelection.ts` : conservation de cible, cycle des cibles, orientation et calculs indépendants du moteur 3D.
- `character/targetingSettings.ts` : validation du manifeste et valeurs éditables.
- `character/targetLockSystem.ts` : état actif, acquisition explicite, perte de cible, indicateurs Babylon.js et nettoyage.
- `enemies/targetCandidates.ts` : adaptation des ennemis mobiles des maps, utilisée par les deux modes.
- `playground/targetLockSources.ts` : ajout des cibles d'entraînement du Playground.
- `playground/targetLockTools.ts` : réglages et import/export JSON.
- `character/heroInput.ts` : actions clavier W/X configurables et entrées existantes.
- `character/characterController.ts` : déplacement normal ZQSD et orientation indépendante lorsque la cible est verrouillée.

Le déplacement reste manuel : **le Target Lock ne déplace pas le héros automatiquement vers l'ennemi**. Les règles de combat, les collisions et les animations existantes sont conservées ; une animation de strafe dédiée peut être ajoutée ensuite pour éviter les glissements visuels des jambes.
