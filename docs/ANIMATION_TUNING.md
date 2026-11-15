# Réglage des animations et interruptions dans le Playground

Les valeurs de production sont dans `code/ANIMATIONS.json`. Le Gameplay et le Playground lisent ce même manifeste au démarrage.

## Réglages d'une action

Dans `npm run dev-playground`, ouvrir **Animations d'action** puis sélectionner `dodge` ou `attack`.

- **Vitesse de lecture** : vitesse du clip GLB. Les plages de progression sont normalisées de 0 à 1, indépendamment de cette vitesse.
- **Fenêtre d'invulnérabilité** : `settings.dodge.dodge.window`. Les dégâts ne sont ignorés que pendant cette fenêtre tant que l'esquive reste active.
- **Fenêtres d'impact** : `settings.attack.impact`. Chaque impact est déclenché une seule fois.
- **Fenêtres d'interruption** : `settings.<action>.cancel.runFrom`, `attackFrom` et `dodgeFrom`. La valeur indique la progression minimale autorisant la nouvelle commande. Une propriété absente interdit ce type d'interruption; `1` l'autorise uniquement à la fin.
- **Fondu de sortie** : `settings.<action>.blendOutSeconds`. Le rendu peut continuer pendant ce fondu, sans conserver les droits de l'action interrompue.

Dans la configuration initiale, l'esquive autorise la course dès `0.9`, à la fin de ses i-frames, mais les deux propriétés restent indépendantes. Une direction maintenue suffit à déclencher la reprise du déplacement dès cette progression. Une attaque conserve son animation par couches lorsque la locomotion est autorisée.

La timeline présente les plages, les durées calculées en millisecondes et la progression de l'action sélectionnée. Le bouton **Rejouer l'animation** sert à la prévisualisation du clip, sans simuler une nouvelle frappe ni remettre à zéro le cooldown de gameplay.

## Enregistrer les réglages

1. Modifier les paramètres en direct dans le Playground.
2. Cliquer sur **Exporter ANIMATIONS.json** pour télécharger le manifeste complet.
3. Remplacer manuellement `code/ANIMATIONS.json` par ce fichier dans la copie de travail du dépôt, puis valider le changement dans Git.
4. Relancer `npm run dev-gameplay` pour vérifier les valeurs versionnées.

L'export navigateur ne modifie **pas** le dépôt. Les modifications non exportées sont des surcharges locales de développement, enregistrées dans le `localStorage` quand il est disponible. Le mode Gameplay ne dépend pas du `localStorage`.

**Importer ANIMATIONS.json** permet d'appliquer les paramètres depuis un manifeste compatible. L'import vérifie les clips, les fenêtres, les nombres, les vitesses et les transitions; il n'importe pas de nouveaux modèles ou de nouveaux chemins d'assets. **Réinitialiser les animations** restaure les valeurs versionnées et efface les surcharges locales du module.

## Cycle de vie

Les règles de cancellation vivent dans `code/src/character/actionCancelling.ts`. Le contrôleur propriétaire de l'action décide quand libérer le gameplay. `AnimationPlayer` gère uniquement le fondu visuel des groupes et des couches.

La mort interrompt toutes les transitions. Les groupes d'animation ne doivent pas persister au-delà de la scène. Les contrôleurs humains et IA futurs doivent émettre leurs intentions vers les mêmes règles d'action.

## Vérifications recommandées

Après une modification des paramètres, exercer les cas suivants :

- Maintenir une direction pendant une esquive et vérifier la reprise dès `runFrom`.
- Vérifier que la reprise est impossible avant `runFrom` et qu'aucune i-frame ne persiste après l'interruption.
- Attaquer pendant un déplacement et vérifier le maintien des jambes en locomotion.
- Esquiver après l'impact, vérifier qu'un coup n'est jamais appliqué deux fois.
- Tester `attack → dodge`, `dodge → run`, `attack → idle` et la mort pendant une transition.
- Exporter, recharger le fichier depuis le disque, puis comparer le comportement en mode Gameplay.

## Combos d'attaque (POC : une animation réutilisée)

Le manifeste versionné `code/ANIMATIONS.json` comporte `settings.attack.combo` :

- `enabled` : active la chaîne de coups.
- `maxChain` : limite le nombre de coups successifs.
- `inputBufferMs` : autorise un clic anticipé avant la fenêtre.
- `resetAfterMs` : délai maximal pour lancer le prochain coup **après la fin** d'une attaque normale.
- `chainWindow.from/until` : intervalle normalisé durant lequel une attaque en cours peut être enchaînée. Le début ne peut pas précéder le dernier impact.
- `followUp.startProgress` : position du clip utilisée **uniquement** pour les coups suivants, toujours avant le premier impact.
- `followUp.blendSeconds` : fondu entre deux instances indépendantes des couches d'attaque.

Dans le Playground, ouvrir **Animations d'action → Attaque**. Ajuster les réglages de combo, consulter les plages `Fenêtre d'enchaînement` et `Préparation ignorée` sur la timeline, puis exporter le manifeste.

Le premier coup joue `attack` depuis 0 %. Les suivants démarrent depuis `startProgress` et alternent deux couples de groupes Babylon.js haut/bas du corps pour conserver la pose du coup précédent durant le Crossfade. Chaque coup crée de nouvelles fenêtres d'impact non consommées ; les événements situés avant `startProgress` ne sont pas rejoués.

Une esquive, une mort, une prévisualisation ou une interruption de locomotion remet le compteur de combo à zéro. Les actions maintenues au-delà du temps de récupération ne conservent pas indéfiniment la chaîne. Les règles de timing des combos sont testées dans `attackCombo.test.ts`.

Les groupes alternés restent propres au héros actuel : de vrais clips distincts pour chaque attaque pourront être ajoutés plus tard sans modifier les fenêtres de gameplay.
