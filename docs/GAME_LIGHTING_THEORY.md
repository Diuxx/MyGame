# Principes d’éclairage pour un jeu 3D

Synthèse pratique de l’article [« Lighting Theory for 3D Games, Part 4 »](https://www.blog.radiator.debacle.us/2015/07/lighting-theory-for-3d-games-part-4.html), publié sur The RADIATOR Blog en juillet 2015. L’article emploie des exemples Unity, mais ses principes de composition s’appliquent aux moteurs 3D en général. Cette note en résume les idées sans le traduire.

## Idée centrale

L’éclairage temps réel est une composition d’approximations et d’effets distincts, pas une simulation complète de la lumière. Le critère principal est donc l’image finale : elle doit soutenir l’ambiance, rendre les formes et les actions lisibles, et rester plausible dans l’univers du jeu. Le réalisme physique n’est pas une fin en soi.

## Quatre rôles de lumière

| Portée | Directionnelle | Dans toutes les directions |
|---|---|---|
| Globale | **Lumière directionnelle** : éclaire le monde selon une direction, comme un soleil. Elle joue souvent le rôle de lumière principale. | **Ambiante** : relève le niveau des zones non directement éclairées et évite les ombres illisibles. Trop uniforme, elle a tendance à aplatir les volumes. |
| Locale | **Spot** : cône orienté, utile pour attirer l’attention ou marquer une zone. | **Point** : éclaire autour d’une position, utile pour suggérer une source proche comme une lampe ou un chandelier. |

Cette grille décrit les rôles habituels, pas une limite du moteur : le schéma du projet autorise aussi des lumières directionnelles ou hémisphériques dans la liste des lumières de carte.

Commencer par les lumières globales fournit une base cohérente; les lumières locales servent ensuite à diriger le regard et à différencier des zones. La lumière visible d’un luminaire et l’éclairage réellement calculé sont deux choses distinctes : un matériau émissif rend l’objet lumineux, mais ne remplace pas une lumière ponctuelle ou un spot.

## Éclairage direct et effets complémentaires

Un modèle direct simple ne représente pas à lui seul les rebonds de lumière, les transferts de couleur entre surfaces, la diffusion sous la peau, l’éblouissement ou l’adaptation de l’œil. Les jeux ajoutent ces impressions avec des systèmes séparés : remplissage ambiant, lumières de renfort, matériaux émissifs, halos, particules, brouillard et effets de caméra.

Ces ajouts sont des outils de composition, pas des obligations. Une lumière indirecte coûteuse peut souvent être suggérée par un remplissage discret; un halo ou des particules peuvent signaler une source sans modifier le modèle d’éclairage principal. La cohérence de l’ensemble compte davantage que la fidélité physique de chaque effet pris isolément.

## Contraste et lisibilité

La luminosité perçue dépend aussi de ce qui entoure une zone. Une source modérément lumineuse ressort davantage si les éléments secondaires sont moins lumineux; à l’inverse, éclairer uniformément toute la scène réduit les priorités visuelles. L’obscurité est donc relative et doit préserver les informations utiles au joueur.

Pour le jeu, vérifier en priorité que l’éclairage aide à lire :

- le héros, les ennemis et leurs animations;
- les chemins praticables, les limites et les obstacles;
- les attaques télégraphiées et les points d’intérêt.

Une ambiance réussie ne doit pas sacrifier ces repères au profit du contraste ou d’un effet décoratif.

## Application au projet

- Les sections JSON `lighting.world` et `lighting.map` correspondent aux lumières globales et locales. Le contrôleur Babylon.js réutilise le soleil et la lumière hémisphérique de la scène, puis instancie les lumières de la carte.
- `environment` règle séparément le fond et le brouillard; ces réglages ne remplacent pas les sources lumineuses.
- Les lumières locales peuvent renforcer un luminaire ou un point d’intérêt. Le matériau émissif du décor reste une indication visuelle distincte.
- Les ombres des lumières locales sont désactivées par défaut. N’en activer que si elles améliorent réellement la lecture, puis mesurer leur coût, en particulier sur les appareils mobiles.
- Le Playground démarre sur l’auberge `prototype-inn`; l’arène blockout `playground` reste disponible comme scène de test. Vérifier les deux avec la caméra top-down et le zoom réellement utilisés en jeu.

## Petite procédure d’itération

1. Régler la lumière globale principale et le remplissage sans ajouter de lumières locales.
2. Vérifier silhouettes, terrain et contrastes depuis la caméra de jeu.
3. Ajouter uniquement les sources locales qui aident à comprendre la scène ou à orienter le regard.
4. Ajouter au besoin un effet complémentaire léger, en gardant sa responsabilité distincte de celle des lumières.
5. Refaire le contrôle visuel et mesurer les coûts avant d’activer des ombres locales ou des effets de caméra.

## Références du projet

- Configuration et limites des sources : [LIGHTING_EDITOR.md](./LIGHTING_EDITOR.md).
- Contrôleur Babylon.js : [lightingController.ts](../code/src/world/lightingController.ts).
- Schéma des lumières de carte : [lightingSettings.ts](../code/src/world/maps/lightingSettings.ts).
- Article source : [The RADIATOR Blog — Lighting Theory for 3D Games, Part 4](https://www.blog.radiator.debacle.us/2015/07/lighting-theory-for-3d-games-part-4.html).
