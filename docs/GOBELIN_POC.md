# Gobelin animé du dojo

Dans le Playground, ouvrir **Maps 3D modulaires**, charger **Cour du dojo**
et activer **Afficher les zones d’aggro des ennemis**. Le gobelin apparaît à
`[4, 0, 2.5]`, à environ 4 unités du héros. Le rayon d’aggro est de 3 unités.
Avec le profil existant `guard`, le rayon de poursuite effectif est de
4,5 unités autour du spawn (75 % des 6 unités configurées).
Le panneau affiche l’état de simulation et le clip sélectionné.

Le gobelin joue Idle au repos et pendant le windup. Il joue Run pendant
une poursuite ou un retour dès que les collisions autorisent un déplacement.
Le combat utilise `slash` et le respawn intervient après 10 secondes.

## Conversion hors ligne

Depuis la racine du dépôt, avec Blender 5.3 dans le PATH :

```powershell
blender -b --python-exit-code 1 --python code/tools/exportGoblin.py
```

- Le GLB Meshy initial, `code/public/models/enemies/goblin.glb`, contient
  le maillage, ses UV et ses trois textures PBR. Le FBX Meshy voisin contient
  le maillage pondéré et l’armature de 24 os, avec des références à des
  textures externes absentes des fichiers fournis. Le script vérifie les
  UV des 10 371 triangles avant d’appliquer le matériau du GLB au maillage
  riggé du FBX. Il écrit `code/public/assets/models/enemies/goblin.glb`.
- Les FBX Mixamo restent dans `code/public/assets/animations/common/`.
  Ils partagent les 24 noms d’os et la hiérarchie du gobelin, avec des
  rotations de repos différentes, notamment aux épaules et aux bras.
  Le script transpose les rotations dans les axes de repos du gobelin,
  conserve le rebond vertical du bassin et écarte la translation horizontale.
  Il écrit `dwarf-idle.glb` (7 s) et `mutant-run.glb` (environ 0,87 s)
  dans le même dossier. Les deux GLB transportent l’armature et un clip,
  sans géométrie ni textures.
- Origine des fichiers fournis : modèle et textures Meshy, animations
  Mixamo. Les conditions de licence des exports d’origine s’appliquent.

## Compatibilité et remplacement

Babylon met les fichiers source en cache. Chaque instance lie ses groupes
aux nœuds de son propre squelette et les libère au remplacement visuel
ou au déchargement. Le registre vérifie les noms, la parenté et les
transformations locales de repos. Il signale les clips incompatibles
dans la console et garde le modèle affiché. Un modèle absent utilise
la silhouette de secours existante. Si seul Run manque, Idle reste
disponible pendant le déplacement.

Les deux clips sources peuvent servir à d’autres personnages Meshy.
Les GLB convertis s’appliquent directement aux modèles qui partagent
la pose de repos et le squelette du gobelin. Pour un autre rig, vérifier
les proportions et les axes, adapter les clips hors ligne, puis contrôler
visuellement les appuis et les articulations sur le nouveau personnage.
