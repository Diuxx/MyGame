# Idle Action RPG

Prototype web d’un RPG d’action 3D centré sur un héros personnalisable. Le projet vise à combiner la progression et le combat automatisés avec la possibilité de reprendre la main à tout moment. Le prototype utilise Babylon.js, TypeScript et Vite.

## Démarrage

Prérequis recommandés pour le jeu et les tests : Node.js 22.12 ou plus récent et npm.

Depuis la racine du dépôt :

```bash
cd code
npm ci
npm run dev-gameplay
```

Ouvre l’adresse affichée par Vite pour jouer au prototype. Pour lancer le **Playground** et accéder aux outils de réglage du jeu, utilise `npm run dev-playground` depuis `code/`.

## Tests et build

Depuis `code/` :

```bash
npm test
npm run build
```

## Documentation

- [Guide du prototype et commandes du jeu](code/README.md)
- [Architecture du projet](docs/PROJECT.md)
- [Vision fondatrice](docs/PROJETCT.md)
