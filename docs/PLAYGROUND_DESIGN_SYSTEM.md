# Nicolabz Design System — Playground (Lot 4)

## Source et installation

Le design system de référence est [Diuxx/nicolabz-design-system](https://github.com/Diuxx/nicolabz-design-system), version `0.4.0`, épinglée au commit `3a27a6a1060f934d876184d62853893f6f8b82e2`.

Depuis `code/`, utiliser `npm ci` pour installer la version exacte enregistrée dans `package.json` et `package-lock.json`. Cette dépendance Git est consommée directement : **ne pas copier ses sources CSS/JS dans MyGame**, ne pas modifier ses fichiers de tokens générés.

Pour actualiser la version :
1. Vérifier un nouveau tag ou commit du dépôt Nicolabz et consulter ses changements de composants/tokens.
2. Modifier le SHA de l'URL `git+https` dans `code/package.json`.
3. Régénérer `code/package-lock.json` avec `npm install --package-lock-only` dans un environnement connecté.
4. Exécuter `npm ci`, `npm test`, `npm run build` et les vérifications visuelles ci-dessous.

## Chargement et thème

`code/src/main.ts` importe `theme.css`, `components.css` et `icons.css` **uniquement en mode Playground**, avant les styles historiques. `code/src/playground/nicolabzWorkspace.css` vient ensuite pour appliquer les tokens à la disposition spécifique au jeu. `typography.css` est volontairement exclu pour ne pas modifier les styles globaux du HUD.

Le thème de départ est **Light — Soft Spectrum** :
- `index.html` choisit `data-theme="light"` dès le `<head>` en mode Playground, avant le premier rendu.
- Le thème clair ne dépend ni des préférences système ni de `localStorage`.
- **Ne pas importer `@nicolabz/design-system/theme.js`** : ce gestionnaire prend en charge le choix automatique clair/sombre, non désiré pour l'éditeur.
- En mode Gameplay, le thème sombre existant et les styles du HUD ne sont pas migrés.
- La structure `data-theme` laisse la possibilité d'un sélecteur clair/sombre lors d'un futur lot, sans changement d'API des composants.

Les couleurs, espacements et rayons proviennent des variables `--color-*`, `--space-*` et `--radius-*` du design system. Les règles de géométrie du workspace (`--ws-left-width`, largeur des docks, z-index, etc.) appartiennent toujours à MyGame.

## Conventions

| Élément | Usage |
| --- | --- |
| `.nz-button.nz-button-primary` | Action principale : création d'un ennemi, chargement/export de map |
| `.nz-button.nz-button-secondary` | Commandes habituelles et imports |
| `.nz-icon-button` | Boutons d'outils avec libellé accessible ou attribut `title` |
| `.nz-form-panel` | Modules de l'éditeur ; appliquée aux **nœuds DOM existants** avant déplacement |
| `.nz-accordion` | Sections avancées `<details>` (éviter de recréer les champs) |
| `.ws-danger-action` | Adaptation locale des opérations destructives tant que Nicolabz ne définit pas de variante officielle |
| `.ws-*` | Position, dimensions, sélection d'objets et comportements propres au Playground |

Le préfixe `nz-` est réservé aux composants Nicolabz. Les IDs existants, les listeners, les contraintes `required`, les formulaires et les formats JSON doivent rester inchangés.

Les icônes utilisent le sprite existant `@nicolabz/design-system/icons.svg?url` via `nicolabzIcons.ts`. Vite copie le sprite dans les assets générés ; les éléments `<use>` le référencent sur la même origine. Les icônes décoratives sont marquées `aria-hidden`, tandis que les actions gardent leurs libellés ou attributs `aria-label`. Certains outils de transformation 3D gardent volontairement leurs glyphes pour éviter de leur attribuer des pictogrammes imprécis.

### Identité du projet et accès à l'explorateur

Le symbole générique du Playground a été remplacé par l'icône `shield` du sprite Nicolabz, déjà utilisée par l'interface. Un favicon SVG autonome `code/public/favicon.svg` reproduit le contour Lucide (licence ISC) pour les onglets de navigateur, qui ne prennent pas tous en charge les fragments de sprites SVG en favicon.

Le bouton hamburger de l'en-tête a été retiré. L'**Explorateur** dispose désormais de son entrée dédiée dans la barre d'icônes de gauche, sur desktop comme sur mobile. Il est **fermé par défaut** ; cliquer sur son icône l'ouvre ou le ferme, et le bouton de fermeture dans son en-tête permet également de le refermer. L'entrée indique l'état courant via `aria-pressed`, `aria-expanded` et `.is-active`.

Sur desktop, fermer l'explorateur supprime la largeur de sa colonne dans la grille, ce qui rend l'espace au viewport Babylon. Sous 1020 px, l'explorateur fonctionne comme un panneau superposé sans réserver de colonne. Les onglets **Scène / Catalogue**, leur contenu, la recherche et les sélections ne sont pas recréés lors des ouvertures successives. L'explorateur partage désormais le même panneau gauche que Monde, Héros, Combat, Ennemis, Effets et Debug. Un seul menu peut être visible à la fois ; un nouveau clic sur le menu actif le ferme. L'inspecteur droit reste indépendant sur desktop. La géométrie du panneau, notamment sa largeur ouverte et fermée, est exclusivement définie dans `style.css` : le thème Nicolabz ne doit pas redéfinir ces variables.

## Risque de collision CSS et limites

La bibliothèque contient aussi des sélecteurs génériques (`.panel`, `.button`, `.form-panel`). Ses feuilles sont chargées **avant** `style.css`, de façon à préserver les règles spécifiques à MyGame. Les adaptations finales sont regroupées dans `nicolabzWorkspace.css` et limitées à `.workspace-app`. Vérifier cet ordre lors de toute évolution de la chaîne Vite.

Les anciens styles de `style.css` sont maintenus tant qu'ils peuvent servir au gameplay, à l'initialisation ou aux éléments historiques encore déplacés dans le workspace ; il ne faut pas les supprimer sans examiner leurs usages. Ce lot ne remplace ni le viewport Babylon ni les skins de combat.

## Vérifications

- `cd code && npm ci && npm test && npm run build`.
- Playground desktop : l'explorateur démarre fermé, s'ouvre depuis le rail, se ferme par un second clic ou par sa croix et rend sa largeur au canvas ; ouvrir un autre menu remplace le contenu du panneau gauche et l'inspecteur droit reste indépendant.
- Sections avancées : plier/déplier et éditer des valeurs ; gérer les champs invalides ; sauvegarder brouillons et importer/exporter des JSON sans modification de formats.
- Clavier : parcourir les boutons avec Tab, vérifier le focus visible, F2 pour tester et revenir en édition.
- Mobile et petit écran : docks non superposés et cibles tactiles utilisables.
- Préférences OS sombre et préférence locale sombre : le Playground doit rester clair ; vérifier l'absence de flash sombre.
- Mode Gameplay : HUD et scène conservés, sans chargement des styles Nicolabz.

Une vérification de rendu réelle est nécessaire pour valider contrastes, lisibilité des symboles, responsive et interactions des panneaux. Les tests statiques ne remplacent pas une visite dans le navigateur.
