# Playground Workspace — Édition et test du héros

## Objet

La page `npm run dev-playground` conserve son moteur Babylon.js, son personnage, ses animations, ses maps et ses contrôleurs. Le workspace réorganise les **mêmes éléments HTML existants** autour d'une scène centrale, sans créer de second Playground ou recopier la logique des modules.

L'interface propose :

- **Barre supérieure** : map active, sélection de map, chargement, FPS, debug et commutateur **Édition / Tester le jeu**.
- **Barre d'outils** : sélection, déplacement, rotation, échelle, snapping, rotation par incréments, annuler/rétablir, copier/coller/couper/supprimer et export JSON.
- **Explorateur gauche** : onglets **Scène** (hiérarchie et recherche) et **Catalogue** (Prefabs, décors, tuiles, ennemis/cibles).
- **Inspecteur droit** : propriétés de l'objet sélectionné, indépendantes de la navigation entre modules.
- **Panneau Outils global** : modules classés par domaine, accessible depuis la barre supérieure ou la navigation latérale. Il peut être fermé sans effacer son contexte.
- **Barre d'état** : map, nombre d'éléments sélectionnés et mode actif.

## Modes

**Édition** : bouton **✎ Édition**. Les contrôles de construction sont visibles. Le héros ne se déplace plus ; les flèches déplacent la caméra selon les règles existantes. Sélectionner un objet dans le monde ou dans l'explorateur actualise son inspecteur sans changer le module ouvert. Les outils globaux peuvent rester visibles en parallèle sur desktop.

**Tester le jeu** : bouton **▶ Tester le jeu**. Les panneaux d'édition se masquent, le canvas s'agrandit et le HUD ainsi que les contrôles du héros restent disponibles. Le retour en édition conserve la même scène, la map, le personnage, l'équipement et les ennemis. La caméra reprend son suivi habituel à la sortie de l'édition.

**F2** alterne les deux modes lorsque le focus n'est pas dans un formulaire. Le mode Gameplay séparé de Vite (`npm run dev-gameplay`) reste inchangé.

La seule source de vérité est le contrôle historique `worldEditorEnabled`. Le nouveau commutateur déclenche son événement `change` standard : `maps.setEditing`, le contrôleur humain, la caméra et l'IA de ciblage utilisent donc toujours la même logique qu'avant. L'ancienne option « Mode édition de la map » n'est plus affichée une seconde fois.

## Où sont les 13 modules ?

| Espace | Modules déjà existants |
| --- | --- |
| **Monde** | Éditeur de monde, Éclairage, Maps 3D modulaires, Caméra |
| **Héros** | Animations de déplacement, Animations d'action, Modèle chargé, Commandes |
| **Combat** | Target Lock, Collisions et hitboxes, Zone d'attaque / Portée |
| **Ennemis** | Gestion des ennemis |
| **Effets** | Floating Text |
| **Debug** | Commandes existantes d'affichage de hitbox du héros, hurtboxes/colliders ennemis, zone d'attaque, colliders de map, aggro, spawns et grille |

En mode test, le bouton **Debug** ouvre un petit panneau flottant contenant les mêmes commandes de visualisation. Les autres réglages restent accessibles en édition.

## Inspecteur de sélection et outils globaux (Lot 2)

- L'inspecteur de droite contient les nœuds d'origine `worldEditorSelection`, `worldEditorFields` et les contrôles de hauteur. Les événements de l'éditeur, la sélection multiple et les gizmos Babylon restent inchangés.
- Sans objet sélectionné, l'inspecteur présente un état vide. Après une suppression ou un changement de map, le World Editor invalide la sélection et l'inspecteur se synchronise.
- Le panneau flottant **Outils** est indépendant et n'occupe pas une colonne permanente du viewport. Les sections Éditeur, Éclairage, Maps, Caméra, Héros, Combat, Ennemis, Effets et Debug y conservent leurs contrôles et leurs listeners.
- Sur desktop, les propriétés et le panneau Outils peuvent être ouverts simultanément. Sur largeur inférieure à 760 px, les deux panneaux superposés sont mutuellement exclusifs, mais leurs états restent indépendants.
- Fermer les outils n'efface pas le dernier module affiché. Le bouton **Outils** ou la navigation latérale le rouvre.
- L'outil Éclairage conserve sa sélection de lumière locale ; la sélection de Prefab/ennemi/interactions demeure gérée par le World Editor. Les ennemis temporaires de test sont toujours gérés par leurs propres contrôles.
- Les panneaux d'édition disparaissent en mode **Tester le jeu**. Au retour en édition, l'outil global et l'état des panneaux sont restaurés. Le World Editor continue d'effacer sa sélection lors du changement de mode, conformément au comportement existant.

## Lot 4 — Nicolabz Light / Soft Spectrum

Le thème clair du Playground repose sur le design system **Nicolabz** (`theme.css`, `components.css`, `icons.css`). Sa version est épinglée dans `code/package.json`. Le mode Gameplay conserve son habillage dédié ; aucun choix de thème n'est proposé pour l'instant.

Les contrôles existants conservent leurs IDs, valeurs, gestionnaires et comportements. Les classes `nz-` apportent des fondations visuelles partagées, tandis que les classes `ws-` continuent de piloter la disposition des panneaux.

Pour l'installation, les tokens, les responsabilités de styles et la liste des vérifications, voir **[PLAYGROUND_DESIGN_SYSTEM.md](PLAYGROUND_DESIGN_SYSTEM.md)**.

## Lot 3 — Formulaires et persistance explicite

Les panneaux gardent leurs contrôles et listeners d'origine. Les paramètres fréquents restent directement accessibles tandis que les réglages avancés sont regroupés dans des sections HTML `details` (l'état du champ n'est pas effacé lorsqu'on replie la section).

- **Ennemis de test** : type, PV, défense, dégâts et vitesse en premier ; collisions et régénération dans « Avancé ». Les champs requis cachés sont révélés automatiquement si leur validation échoue. Les instances d'entraînement ne sont pas les ennemis persistants de la map.
- **Inspecteur** : position/rotation, paramètres de Prefab, puis collisions/comportement avancés et apparence. La sélection et les propriétés continuent d'être contrôlées par le World Editor.
- **Combat et éclairage** : affichages debug, dégâts forcés et ombres détaillées dans des sections avancées. Les valeurs et leur comportement métier restent inchangés.
- **Animations et textes flottants** : transitions et réglages détaillés regroupés, avec les actions JSON dans des sections explicites.

| Action dans le Playground | Portée réelle | Comment retrouver les données |
| --- | --- | --- |
| Modifier une valeur | Session active immédiatement | Dépend du module ; certaines configurations conservent aussi une surcharge locale |
| Brouillon de map (auto ou manuel) | `localStorage` de ce navigateur, associé à la map | « Restaurer le brouillon », si compatible avec la source de map ; ne modifie jamais Git |
| Sauver/restaurer les ennemis d'entraînement | `localStorage` de ce navigateur | « Restaurer localement » ; distinct du JSON de la map |
| Télécharger la map JSON | Fichier de la map active, y compris l'éclairage appliqué | Télécharger puis intégrer manuellement à `public/assets/maps` |
| Télécharger une configuration JSON | Fichier propre au module (ANIMATIONS, TARGETING, FLOATING_TEXT, ou ennemis de test) | Importer dans le module ou intégrer manuellement au fichier correspondant dans le dépôt |
| Importer une configuration JSON | Vérification du format par le module et application locale/en session | Les validations et éventuels avertissements de stockage restent visibles |

**Important :** « Télécharger » demande au navigateur d'enregistrer un fichier, sans pouvoir garantir qu'il a effectivement été conservé par l'utilisateur. Aucun bouton d'export n'écrit directement dans le dépôt. Les aperçus d'assets GLB/textures doivent toujours être copiés et référencés séparément.

Le World Editor crée automatiquement un brouillon pour les actions couvertes par son historique. Pour inclure explicitement d'autres modifications de la map, notamment l'éclairage, utiliser « Enregistrer le brouillon ». Un export JSON est nécessaire pour obtenir un fichier versionnable.

## Doublons d'interface

Les raccourcis rapides historiques et les champs détaillés correspondaient déjà à un seul état :

- `worldEditorEnabled` / `worldEditorQuickToggle` → un seul commutateur de mode visible.
- `heroHitboxVisible` / `heroHitboxQuickToggle` → commande principale dans **Debug**.
- `attackHitboxVisible` / `attackHitboxQuickToggle` → commande principale dans **Debug**.

Les contrôles rapides historiques restent dans le DOM, masqués, pour conserver les synchronisations et écouteurs existants. Il n'y a qu'un seul composant visible par fonction. Les options distinctes (snapping/affichage de grille, collider/hurtbox/attaque) ne sont pas fusionnées.

## Choisir une map et un objet

Le sélecteur de map et le bouton **Charger** de la barre supérieure sont les contrôles `mapSelect` et `mapLoad` d'origine. Les autres actions de map (retour Playground, respawn du héros, progression et affichages de zone) restent dans **Monde → Maps et zones** et **Debug**.

L'explorateur de scène reflète les données de la map active. Pour les éléments déjà éditables (Prefabs, décors, ennemis persistants et interactions), cliquer sur une ligne sélectionne l'objet via `worldEditor.selectObject` sans changer automatiquement de module ; Shift+Clic utilise la sélection multiple. Les primitives de zone, les sorties et les points d'apparition sont listés à titre informatif lorsqu'ils ne disposent pas encore d'outil de sélection directe. Les layers verrouillés ou invisibles restent protégés par la même règle que les clics dans la scène.

La recherche de l'explorateur filtre les noms et identifiants. L'onglet Catalogue conserve **les mêmes boutons de création** que l'ancien éditeur.

## Architecture

| Fichier | Responsabilité |
| --- | --- |
| `code/src/playground/workspaceModules.ts` | Déclaration des domaines, 13 modules, navigation, visibilité indépendante des panneaux et commutateur de mode |
| `code/src/playground/workspace.ts` | Construction de la disposition et déplacement des nœuds DOM existants |
| `code/src/playground/worldEditor.ts` | Exposition minimale de la sélection à l'explorateur |
| `code/src/playground.ts` | Assemblage au démarrage, sans modifier les règles de gameplay |
| `code/src/style.css` | Workspace desktop, panneaux adaptés aux écrans plus petits et scène élargie en test |

## Navigation et conservation du contexte

- Chaque espace conserve son dernier module ouvert durant la session du Playground. Cliquer à nouveau sur l'espace actif ne change pas de module.
- Fermer un panneau ne réinitialise pas son dernier choix. Le même onglet peut le rouvrir, y compris dans les espaces à module unique.
- Sélectionner un objet dans la scène ou dans l'explorateur n'ouvre plus automatiquement Monde → Éditeur. Le bouton **Propriétés** de la barre d'état ouvre l'inspecteur seul, sans changer le module global actif.
- Le mode **Tester le jeu** masque les outils d'édition sans réinitialiser la navigation. Le retour en édition restaure l'espace et le module précédents.
- Les raccourcis d'accès aux maps, aux blocs réutilisables et au debug continuent d'ouvrir explicitement leurs outils respectifs.

**Ne pas recopier les inputs dans une nouvelle interface** : les écouteurs, valeurs et états sont conservés parce que les nœuds d'origine changent uniquement de parent.

Le registre des modules est vérifié par les tests. Le changement de mode est testé pour garantir une seule notification `change` par transition réelle. Un `ResizeObserver` actualise le moteur Babylon.js lorsque la taille de la scène change.

## Vérification manuelle recommandée

1. Démarrer `cd code && npm run dev-playground`.
2. Vérifier que les six espaces de travail ouvrent les 13 modules existants.
3. Sélectionner une map, la charger et revenir à la map Playground.
4. Sélectionner un mur depuis la scène et vérifier ses dimensions dans l'inspecteur. Ouvrir **Éclairage** et **Ennemis** : l'inspecteur et la sélection du mur restent accessibles.
5. Dans **Catalogue**, créer un Prefab, le déplacer, effectuer Undo/Redo et exporter le JSON.
6. Cliquer sur **Tester le jeu** : vérifier ZQSD, course, attaque, esquive et Target Lock sans recharger la scène.
7. Activer **Debug** en mode test : vérifier la hitbox du héros, les zones d'attaque et les colliders.
8. Revenir en édition et vérifier le déplacement libre de la caméra avec les flèches.
9. Vérifier les imports/exports JSON des modules d'animation, de ciblage et de Floating Text. Replier/déplier les sections Avancé et confirmer la conservation des valeurs et événements.
10. Vérifier la navigation sur écran étroit : explorateur, inspecteur et panneau Outils repliables, sans superposition simultanée de ces deux derniers.
11. Supprimer l'objet sélectionné, changer de map et vérifier que l'inspecteur présente l'état vide sans affichage d'ancienne donnée.
12. Fermer le panneau Outils, revenir en édition depuis **Tester le jeu**, puis restaurer le dernier domaine et module utilisés.
13. Modifier un objet et une lumière, enregistrer un brouillon local, exporter la map et confirmer les messages distincts dans le navigateur.
14. Sauver/restaurer les ennemis d'entraînement localement, puis exporter/importer leur fichier JSON sans affecter la map.
15. Saisir une valeur invalide dans un champ avancé d'ennemi et vérifier que le groupe s'ouvre pour afficher l'erreur.

Ces tests visuels doivent être exécutés dans un navigateur pour être déclarés réussis.

## Limites

- L'interface d'administration est optimisée pour le desktop ; sur un écran étroit, l'explorateur et l'inspecteur deviennent des panneaux superposés, sans nouvelle UI tactile de manipulation 3D.
- Le navigateur de scène ne rend sélectionnables que les types déjà pris en charge par le World Editor ; il n'introduit pas un nouvel éditeur de primitives, spawns ou sorties.
- Les dispositions et tailles des panneaux ne sont pas encore personnalisables et persistées. L'historique de navigation des modules reste limité à la session courante.
- Les contrôles de debug de la scène sont regroupés, sans fusionner leurs règles métier distinctes.

Le présent document est modifiable. Les références `AGENTS.md`, `docs/PROJECT.md` et `docs/PROJETCT.md` sont immuables et n'ont pas été modifiées.
