# POC — Référence visuelle : terrain et héros

**État :** référence pour calibration du prototype ; les paramètres 3D ci-dessous sont des hypothèses de travail, pas des données extraites d'une vraie scène 3D.

## Image de référence

- Format : **1254 × 1254 px** (carré).
- Personnage central, sans interface ni obstacles dans l'arène.
- Héros mesuré approximativement : **62 px de large** et **140 px de haut**, hors ombre.
- Occupation : **4,9 % de la largeur** et **11,2 % de la hauteur** de l'image.
- Boîte englobante estimée : **x ≈ 591–653**, **y ≈ 498–638**.
- Ancrage au sol : **x ≈ 627, y ≈ 633 px**, proche du centre de l'image.

## Caméra Babylon.js — point de départ

- `ArcRotateCamera` avec projection orthographique.
- `alpha = Math.PI / 4` : azimut 45°, arbitraire pour reproduire une vue diagonale.
- `beta = Math.PI / 4` : 45° depuis la verticale, soit 45° au-dessus du plan horizontal.
- `radius = 18` : positionne la caméra, **n'est pas la valeur de zoom en orthographique**.
- `target = Vector3.Zero()` : vise le point au sol sous les pieds du héros.
- Étendue verticale orthographique totale : **12 unités** (`orthoTop = 6`, `orthoBottom = -6`).
- Étendue horizontale : **12 × ratio largeur/hauteur** ; donc 12 unités sur écran carré.
- Pour dézoomer de 25 % environ, passer l'étendue verticale de 12 à 15 unités.
- Réappliquer les bornes orthographiques lors des changements de taille de la fenêtre.

Code de départ dans `gameCamera.ts` (fichier fourni séparément).

## Héros — échelle 3D proposée

- Hauteur visible (semelles à sommet des cheveux) : **1,8 unité**.
- Largeur approximative avec les bras : **0,75–0,85 unité**.
- Origine au niveau du sol, entre les pieds.
- Proportions légèrement héroïques, tête relativement large ; silhouette lisible depuis le dessus.
- Couleurs et accessoires lisibles à faible taille affichée.

## Terrain

- Le centre est volontairement dégagé pour lire les combats et télégraphes d'attaque.
- Sol ocre/sable, pelouses irrégulières en bordure, quelques touffes et pierres plates très discrètes.
- Repères de couleurs mesurés à titre indicatif : sable **#CA8F5E**, herbe **#6A8139**, ombre **#7F6855** ; leur apparence changera selon l'éclairage 3D.
- Prévoir un plan suffisamment grand pour couvrir toute la projection inclinée de la caméra ; **40 × 40 unités** convient pour commencer.
- Positionner les éléments décoratifs en dehors de la zone de combat.
- L'image de référence contient déjà sa perspective et ses ombres : ne pas l'utiliser telle quelle comme texture de sol 3D inclinée, sinon la perspective serait appliquée deux fois.

## Gameplay — valeurs de test (non déduites de l'image)

- Collision du héros : capsule d'environ **1,8 unité de haut** et **0,35 unité de rayon**, à ajuster à son mesh.
- Vitesse de déplacement : **3 unités/s** pour démarrer les essais.
- Portée initiale de l'épée : **1,5 unité**.
- Zone libre centrale : rayon approximatif de **4–5 unités**.
- Ombre au sol lisible mais pas trop opaque pour garder les télégraphes visibles.

## Responsive

- Écran 1:1 : visible **12 × 12 unités**.
- Écran 16:9 : visible **21,3 × 12 unités**, à cadrage vertical identique.
- Écran 9:16 : visible **6,75 × 12 unités**, avec le risque de couper la zone de combat.
- Prévoir une stratégie dédiée au portrait : étendre la zone visible, suivre le héros ou redimensionner l'arène et l'interface.

## Méthode de calibration

1. Importer le héros GLB, l'ajuster à 1,8 unité et vérifier que les pieds sont au sol.
2. Ajouter le sol 3D et la caméra orthographique.
3. Afficher le rendu dans un viewport carré 1254 × 1254 (ou un autre carré équivalent).
4. Ajuster `visibleHeight` jusqu'à ce que la hauteur du héros soit ~11 % de la hauteur du viewport.
5. Ajuster `alpha` et `beta` pour retrouver la visibilité du visage, des cheveux et des pieds.
6. Tester les télégraphes, l'esquive et la présence de trois ennemis avant de figer le zoom.
7. Vérifier ensuite les ratios PC, mobile portrait et mobile paysage.

**Limite :** aucune scène 3D d'origine n'existe pour ce visuel généré ; la caméra réelle, la hauteur réelle du héros et les longueurs du terrain ne sont donc pas mesurables de manière exacte.
