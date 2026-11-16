# Stylized Nature MegaKit — map de démonstration

Cette intégration conserve le fonctionnement actuel des maps JSON, du registre de modèles et du Playground.
La nouvelle zone **nature-showcase** ne remplace aucune map existante.

## Installer le pack 3D

Le dépôt contient les références des modèles, la map et un importateur, mais pas les 47 Mo de
ressources du pack, qui proviennent de l'archive de l'utilisateur. Installer localement la version
**Stylized Nature MegaKit [Standard]** (Quaternius) :

```bash
# Depuis la racine du dépôt
python3 code/scripts/import-nature-megakit.py "/chemin/vers/Stylized Nature MegaKit[Standard].zip"
```

L'importateur copie les 68 fichiers `.gltf`, leurs `.bin`, toutes les textures du dossier `glTF/`
et la licence dans :

```text
code/public/assets/models/nature-megakit/
  Pine_1.gltf
  Pine_1.bin
  Bark_NormalTree.png
  Bark_NormalTree_Normal.png
  ...
  LICENSE.txt
```

Les fichiers restent côte à côte : les URI relatives déclarées dans les modèles glTF sont donc
résolues automatiquement. Inutile de convertir le pack en GLB ou de recopier séparément le
répertoire `Textures/` (les textures nécessaires sont déjà dans `glTF/`).

Alternative : décompresser directement l'archive d'assets préparée pour ce projet à la racine
du dépôt ; son arborescence commence par `code/public/assets/models/nature-megakit/`.

## Ouvrir la map

```bash
cd code
npm ci
npm run dev-playground
```

Dans le panneau **Maps 3D modulaires**, choisir **Nature — Forêt stylisée**, puis
**Charger / remplacer**. Le héros apparaît sur le chemin, au sud de la clairière.

Pour tester directement dans le mode Gameplay :

```bash
npm run dev-gameplay
# Ouvrir /?map=nature-showcase sur l'URL locale de Vite
```

## Organisation

- `code/public/assets/definitions/assets.json` : 19 références réutilisables (arbres,
  rochers, buissons, herbes, fleurs, fougères, champignons et pierres) et leurs collisions.
- `code/public/assets/maps/nature-showcase.json` : terrain 64×64 unités,
  187 placements statiques, un point d'apparition et l'ambiance lumineuse.
- `code/src/world/maps/zoneScene.ts` : texture de terrain procédurale légère
  (herbe, sentier et clairière), sans tuiles individuelles.
- `code/src/world/maps/validation.ts` : prise en charge des chemins `.gltf`
  en plus des `.glb` existants.
- `code/scripts/import-nature-megakit.py` : extraction sûre de la partie `glTF/`
  avec vérification des fichiers référencés.

Le pack utilise la licence **CC0 1.0** (fichier `License_Standard.txt` dans l'archive,
copié vers `LICENSE.txt` par l'importateur).

## Limites et vérifications

- Le sol est une texture générée sur un seul mesh ; ce n'est pas un véritable terrain avec du relief.
- Les colliders sont volontairement simplifiés : les plantes sont décoratives, les troncs
  et les rochers bloquent les déplacements.
- Les 187 placements utilisent le cache de modèles existant, pas encore des `thin instances`.
  Réduire la densité et profiler sur mobile avant production.
- Sans les fichiers importés, le système affiche ses remplaçants géométriques.
- Le chargement est asynchrone et ne télécharge les glTF que lorsqu'on visite la zone.

```bash
cd code
npm test
npm run build
```

En navigateur : vérifier les textures d'écorce et de feuillage, le point d'apparition,
les collisions, et un aller-retour Playground → Nature → Playground sans résidus visuels.
