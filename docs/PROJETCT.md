# PROJETCT.md — Référence fondatrice du projet Idle Action RPG

> **STATUT : IMMUABLE — DOCUMENT DE RÉFÉRENCE**
>
> Ce document fixe la vision, les principes et les décisions validées du projet. Il ne s'agit ni d'un journal de développement ni d'une roadmap modifiable au quotidien.
>
> Les développeurs et agents doivent le **lire et le respecter, sans le modifier**. Une évolution nécessite une demande distincte, explicitement autorisée par le propriétaire du projet. Les hypothèses de prototype, ajustements techniques et tâches à venir doivent être consignés dans d'autres fichiers.

## 1. Vision

Créer un **Idle Action RPG à héros unique**, offrant une sensation de progression constante inspirée de *Solo Leveling* et une grande liberté de personnalisation. Chaque joueur doit pouvoir construire une identité de combat propre, par ses décisions, ses spécialisations, son équipement et le comportement de son personnage.

Le jeu associe les qualités d'un idle RPG — progression et combats automatisés — à celles d'un action RPG — déplacements, attaques, esquives, timing et intervention directe.

**Ambition :** favoriser des héros très différents, sans promettre mathématiquement que deux joueurs ne puissent jamais obtenir la même configuration.

## 2. Piliers du gameplay

### Un seul héros

- Le joueur développe **un personnage principal unique** ; le concept ne repose pas sur une équipe de héros à collectionner.
- L'apparence, les statistiques, les compétences, l'équipement et l'intelligence de combat sont personnalisables.
- Les spécialisations doivent pouvoir se combiner **sans classes rigides**.

### Combat hybride : automatique et manuel

- Le héros peut combattre **automatiquement**, selon une IA configurable.
- Le joueur peut **reprendre le contrôle immédiatement et à tout moment**, puis rendre la main à l'IA.
- Les deux modes utilisent **les mêmes actions et règles de combat** : déplacements, attaques, esquives, compétences, cooldowns, dégâts et contraintes.
- Le changement de contrôleur ne doit ni recréer le héros ni réinitialiser arbitrairement son état.
- L'IA propose des choix compréhensibles : esquiver, engager ou se replier, gérer les distances et déclencher des compétences selon des règles explicites.
- L'IA n'a pas vocation à être parfaite : les erreurs et compromis de décision font partie du gameplay et de sa personnalisation.

### Progression et stages

- Le jeu propose des **stages successifs** dont la difficulté augmente.
- Le joueur peut rejouer des étapes antérieures pour améliorer son héros et franchir un obstacle.
- La progression est **hybride** : attribution volontaire de points de caractéristiques **et** acquisition de maîtrises par l'utilisation réelle des capacités.
- Le héros commence avec une **épée** ; la **magie** devient accessible ensuite et peut se combiner avec le combat physique.
- Les équipements et compétences doivent créer des styles de jeu distincts, et non seulement des différences numériques.

## 3. Direction artistique et présentation

- **3D stylisée en temps réel**, fantasy semi-cartoon, avec volumes doux, formes arrondies et silhouettes légèrement héroïques.
- Personnages et équipements lisibles même lorsque le héros est relativement petit à l'écran.
- Environnements chaleureux, colorés et légèrement féeriques. La première référence d'arène est une **clairière au sol sableux/ocre et aux bordures herbeuses**, avec un centre dégagé.
- Caméra **haute, inclinée, de type top-down / isométrique**, avec projection orthographique privilégiée pour les premiers essais.
- Les télégraphes d'attaque, les zones de danger, les esquives et les effets magiques doivent être clairement perceptibles.
- Références artistiques : **Albion Online** et **AFK Journey**. Elles guident l'ambiance et la lisibilité, sans chercher à copier leurs personnages ou environnements.
- Une texture peinte sur un sol 3D est envisageable si elle sert la direction artistique ; toute solution doit rester cohérente avec la caméra.

## 4. Technologie et production d'assets retenues

- **Moteur :** Babylon.js.
- **Langage :** TypeScript.
- **Environnement :** Node.js, Vite, Git.
- **Personnages 3D :** génération initiale avec Meshy ; retouches et optimisation possibles dans Blender.
- **Squelette et animations humanoïdes :** rig compatible Mixamo, animations issues de Meshy ou Mixamo selon les besoins.
- **Échange d'assets 3D :** GLB / glTF.
- **Plateformes cibles :** PC, Web, Android et iOS.

La stratégie consiste à **partager au maximum le même gameplay et les mêmes assets** entre plateformes. Le navigateur est la première cible pratique du POC ; les emballages desktop et mobile viendront selon les besoins et les validations réelles.

## 5. Démonstrateur initial et progression du POC

Le travail commence par un **playground minimal**, destiné à vérifier la chaîne d'import des modèles, l'animation et le cadrage visuel avant l'ajout de systèmes de jeu.

### Première validation

- Un seul personnage 3D riggé et animé, importé dans Babylon.js.
- Un sol simple et une caméra top-down inclinée, correctement calibrée.
- Lecture des animations **repos, marche, course et attaque** présentes dans le modèle de démonstration.
- Réglages de zoom, angle et orientation du personnage pour observer son rendu.

### Évolution fonctionnelle envisagée

1. Déplacement du héros, orientation et animations associées.
2. Épée équipée séparément et esquive.
3. Premier ennemi, collisions et attaques télégraphiées.
4. Reprise de contrôle manuelle et retour automatique sans rupture.
5. Configuration des décisions de l'IA.
6. Premières capacités magiques.
7. Points de statistiques et maîtrises par usage.
8. Stages, récompenses et premier boss.

Cet ordre est une **progression de conception**, pas une déclaration que toutes ces fonctionnalités sont implémentées. Le détail des jalons et l'état réel du code doivent vivre dans une roadmap ou un suivi technique modifiable.

## 6. Principes directeurs

- **Gameplay d'abord :** valider le plaisir du combat et la qualité de la bascule auto/manuel avant d'étendre le contenu.
- **POC minimal :** éviter de construire prématurément des systèmes complexes de loot, de génération, d'économie ou de personnalisation exhaustive.
- **Règles uniques :** aucune duplication des règles d'attaque, de dégâts, d'esquive ou de cooldown entre le joueur et l'IA.
- **Évolution modulaire :** prévoir la future personnalisation des corps, coiffures, armures, armes et accessoires sans imposer immédiatement son implémentation complète.
- **Lisibilité :** rendre les gestes, attaques ennemies et effets compréhensibles du point de vue de la caméra.
- **Maintenabilité :** découpage clair des responsabilités, composants simples, gestion explicite des erreurs et tests proportionnés.
- **Multiplateforme raisonné :** garder PC, Web et Mobile en vue, mais vérifier les performances et l'ergonomie sur de vrais appareils avant toute promesse.
- **Décisions explicites :** une expérimentation abandonnée (par exemple le rendu des personnages en sprites 2D) ne remplace pas automatiquement une décision de référence.

## 7. Frontière avec les documents évolutifs

Ce fichier décrit **ce que le jeu doit être**. Il ne doit pas recevoir les changements de version du moteur, noms de branches, chiffres de performance provisoires, bugs, tâches en cours ou captures d'état du playground.

Ces informations doivent être consignées dans des documents distincts, tels qu'une roadmap, un journal de décisions techniques ou la documentation du POC.

**Règle de gouvernance :** aucun assistant ni outil automatique ne modifie `docs/PROJETCT.md` au cours d'une tâche ordinaire. Une modification exige une autorisation explicite, distincte et ciblant ce fichier. Préserver l'historique des versions en cas de révision autorisée.
