# Roadmap — POC Idle Action RPG

> **Statut :** document de travail · **Version :** 0.1 · **Périmètre :** prototype solo, jouable localement

## Stack technique du starter (décision POC)

- **Moteur 3D :** Babylon.js + TypeScript, bundling Vite.
- **Cible immédiate :** navigateur PC et mobile ; emballage Electron/Tauri ou Capacitor ultérieurement.
- **Graphismes :** primitives temporaires, puis modèles low-poly exportés en `.glb` depuis Blender.
- **Architecture :** une simulation de combat partagée par les contrôleurs joueur et IA.
- **Tests :** règles pures avec `node:test`, sans exiger de rendu 3D.

**Implémenté dans le starter :** arène, épée, magie simple, esquive, un ennemi, progression des stages et bascule de contrôle. Le reste de cette roadmap demeure à développer.

## 1. Vision du jeu

Un **Idle Action RPG** en **3D stylisée, caméra isométrique / 3⁄4**, centré sur **un héros unique**.

Le héros combat automatiquement grâce à une **IA configurable** ; le joueur peut **reprendre le contrôle à n'importe quel moment**, puis rendre la main à l'IA sans interrompre le combat.

Le joueur commence avec **une épée**, débloque ensuite **la magie**, et fait évoluer son personnage par un système hybride :

- **Progression choisie :** points de caractéristiques et décisions de build.
- **Progression par usage :** maîtrises de l'épée, de l'esquive et de la magie.

**Inspiration visuelle :** lisibilité des personnages et équipements d'*Albion Online* ; rendu 3D stylisé et atmosphère colorée d'*AFK Journey*.

### Question à valider

> Le combat automatique, la reprise en main instantanée et la progression hybride créent-ils une boucle de jeu agréable, compréhensible et motivante ?

## 2. Périmètre du POC

| Domaine | Cible du POC |
| --- | --- |
| Personnage | 1 héros unique |
| Terrain | 1 arène réutilisée |
| Caméra | 3D isométrique / 3⁄4, fixe au départ |
| Contrôles | Déplacement, attaque, esquive, compétence magique, bascule auto/manuelle |
| Attaques | Attaque simple à l'épée, projectile magique, éventuellement un buff *Lame enchantée* |
| IA | Ciblage, déplacement, attaque, esquive, utilisation simple de la magie |
| Personnalisation IA | 3 à 5 paramètres lisibles, principalement pour l'esquive |
| Progression | XP de niveau, 4 caractéristiques, 3 maîtrises par usage |
| Ennemis | 3 archétypes (mêlée, distance, lourd) + 1 boss |
| Stages | 10 vagues/stages avec difficulté croissante, puis un boss |
| Récompenses | XP et ressources simples ; équipement basique si le temps le permet |
| Sauvegarde | Sauvegarde locale du build, de la progression et des réglages IA |

### Hors périmètre initial

- Multijoueur, serveur de jeu et synchronisation des comptes.
- Monde ouvert, génération procédurale avancée et multiples biomes.
- Arbres de talents étendus, classes fixes et centaines d'objets.
- Économie, boutique, crafting, familiers et PvP.
- IA générative ou modèle de langage pour piloter le personnage : **une IA déterministe à règles suffit**.
- Progression lorsque l'application est fermée (*offline idle*) : à étudier après validation du combat automatique.

## 3. Boucle principale

1. Entrer dans un stage.
2. Laisser l'IA combattre, ou reprendre le contrôle manuellement.
3. Réussir ou échouer face à des ennemis de difficulté croissante.
4. Gagner de l'XP, des ressources et de la maîtrise par usage.
5. Distribuer les points, ajuster le build et configurer l'IA.
6. Tenter le stage suivant, ou rejouer les précédents pour progresser.

**Règle clé :** les modes manuel et automatique utilisent **le même personnage, les mêmes capacités, les mêmes coûts et les mêmes temps de recharge**. Seule la source des décisions change.

## 4. Roadmap d'implémentation

### Phase 1 — Prototype du combat

**Objectif :** obtenir un combat manuel lisible et satisfaisant.

- [ ] Créer une arène 3D simple et une caméra 3⁄4.
- [ ] Déplacer le héros sur le plan de jeu.
- [ ] Ajouter une attaque à l'épée avec portée, dégâts et animation provisoire.
- [ ] Ajouter une esquive directionnelle avec durée, cooldown et éventuelle fenêtre d'invulnérabilité.
- [ ] Ajouter un ennemi de mêlée avec points de vie et attaque télégraphiée.
- [ ] Afficher les PV et les temps de recharge essentiels.

**Critère de validation :** le joueur peut attaquer, éviter une attaque annoncée et vaincre un ennemi dans l'arène.

### Phase 2 — Combat automatique et reprise en main

**Objectif :** prouver la mécanique centrale du jeu.

- [ ] Créer une logique d'IA simple : détecter une cible, s'approcher, attaquer.
- [ ] Ajouter l'esquive automatique sur une attaque télégraphiée.
- [ ] Permettre le passage **AUTO ⇄ MANUEL** via une touche et un bouton d'interface.
- [ ] Conserver position, animation, PV, ressources et cooldowns pendant la transition.
- [ ] Empêcher les entrées IA et joueur de commander le héros simultanément.
- [ ] Prévoir un état de repli si aucune cible n'est disponible.

**Critère de validation :** le joueur peut interrompre le pilotage de l'IA pendant un combat, agir, puis lui rendre la main sans rupture.

### Phase 3 — Magie et premières synergies

**Objectif :** introduire deux façons de combattre avec un même héros.

- [ ] Ajouter un projectile magique avec portée, coût et cooldown.
- [ ] Permettre son usage en mode manuel et automatique.
- [ ] Ajouter un indicateur simple de ressource magique, si nécessaire.
- [ ] **Optionnel :** ajouter *Lame enchantée*, un buff temporaire de l'épée.
- [ ] Vérifier que les attaques physiques et magiques ont des usages distincts.

**Critère de validation :** le héros peut alterner épée et magie sans changer de classe ni de personnage.

### Phase 4 — Progression hybride

**Objectif :** rendre les décisions de progression perceptibles en jeu.

- [ ] Ajouter l'XP générale et les niveaux.
- [ ] Accorder des points à distribuer entre **Force, Agilité, Vitalité, Arcane**.
- [ ] Créer trois maîtrises : **Épée, Esquive, Magie**.
- [ ] Donner de l'XP de maîtrise pour les actions pertinentes (éviter le gain par simple spam à vide).
- [ ] Définir des effets modestes et mesurables pour chaque statistique et maîtrise.
- [ ] Ajouter un panneau simple de consultation et distribution des points.
- [ ] Sauvegarder et recharger la progression.

**Critère de validation :** deux répartitions de points et deux profils de maîtrise produisent des comportements ou performances observablement différents.

### Phase 5 — Stages, ennemis et boss

**Objectif :** disposer d'une boucle de progression rejouable.

- [ ] Créer un gestionnaire de stages/vagues et un écran de fin de stage.
- [ ] Définir 10 vagues avec augmentation progressive de la difficulté.
- [ ] Ajouter un ennemi à distance, puis un ennemi lourd à attaque annoncée.
- [ ] Ajouter un boss avec au moins une attaque de zone lisible et esquivable.
- [ ] Gérer victoire, défaite et redémarrage du stage.
- [ ] Donner XP et récompenses simples après réussite.
- [ ] Permettre de rejouer les stages terminés.

**Critère de validation :** le joueur franchit plusieurs stages, rencontre un palier de difficulté et dispose d'une raison claire de progresser ou d'ajuster son build.

### Phase 6 — Configuration de l'IA et équilibrage

**Objectif :** faire de l'IA un véritable levier de personnalisation.

- [ ] Ajouter 3 profils d'esquive : **prudent**, **équilibré**, **offensif**.
- [ ] Ajouter une option « esquiver les attaques télégraphiées ».
- [ ] Ajouter une option « conserver une charge d'esquive » si le système de charges est retenu.
- [ ] Régler la priorité d'utilisation du projectile magique (p. ex. dès que disponible ou uniquement à distance).
- [ ] Afficher clairement les décisions prises par l'IA pour faciliter le débogage.
- [ ] Sauvegarder et recharger les paramètres IA.
- [ ] Comparer plusieurs configurations contre le même ennemi/boss.

**Critère de validation :** modifier les paramètres de l'IA change le résultat ou la manière de combattre, sans donner d'avantage caché au mode automatique.

## 5. Règles de conception

1. **Une seule logique de combat :** les dégâts, collisions, coûts, cooldowns et effets ne dépendent pas du mode de contrôle.
2. **Deux pilotes interchangeables :** le joueur et l'IA produisent des intentions (déplacer, attaquer, esquiver, lancer une compétence) ; le héros exécute ces intentions.
3. **Règles IA explicables :** aucune réaction « magique » ; l'IA agit à partir d'informations de jeu définies et de ses paramètres.
4. **Lisibilité d'abord :** privilégier des télégraphes nets et des animations courtes à des effets spectaculaires mais confus.
5. **Progression mesurable :** toute nouvelle statistique ou maîtrise doit apporter un changement perceptible et testable.
6. **Contenu réutilisable :** utiliser des données configurables pour les ennemis, vagues, compétences et caractéristiques plutôt que les disperser dans le code.
7. **Simplicité :** ne pas introduire d'infrastructure réseau, d'abstractions génériques ou de systèmes secondaires avant d'en avoir besoin.

## 6. Organisation technique indicative

> Organisation logique, indépendante du moteur choisi ; **pas nécessairement une classe par ligne**.

```text
Game
├── Combat
│   ├── Damage / Health
│   ├── Abilities (sword, dodge, magic)
│   └── Cooldowns
├── Character
│   ├── Stats
│   ├── Masteries
│   └── Progression
├── Control
│   ├── PlayerInput
│   ├── CombatAI
│   └── ControlModeSwitcher
├── Stages
│   ├── Waves
│   ├── Enemies
│   └── Rewards
├── UI
│   ├── HUD
│   ├── Progression
│   └── AISettings
└── Persistence
    └── LocalSave
```

La priorité est de **séparer les décisions** (joueur / IA) des **actions exécutées** (déplacement, attaque, esquive, magie), sans créer de couches abstraites inutiles.

## 7. Vérifications à prévoir

- [ ] Le changement de mode fonctionne avant, pendant et après une attaque.
- [ ] Une esquive respecte toujours son cooldown ou son nombre de charges.
- [ ] Une attaque ennemie annoncée peut être esquivée manuellement.
- [ ] L'IA ne déclenche pas une compétence indisponible.
- [ ] Les dégâts et cooldowns sont identiques entre mode manuel et automatique.
- [ ] L'XP d'usage n'augmente pas en attaquant dans le vide indéfiniment.
- [ ] Un stage se termine correctement en cas de victoire et de défaite.
- [ ] Une sauvegarde restaurée conserve le héros, ses maîtrises et les réglages IA.
- [ ] Le jeu reste lisible avec plusieurs ennemis et des effets magiques simultanés.

## 8. Définition de « POC terminé »

Le POC est validé lorsqu'une personne peut, sans intervention du développeur :

1. Démarrer une partie avec un héros à l'épée.
2. Vaincre un premier ennemi en mode manuel.
3. Activer l'IA et observer le combat automatique.
4. Reprendre le contrôle pendant le combat, esquiver, puis réactiver l'IA.
5. Débloquer ou utiliser la magie.
6. Faire progresser ses statistiques et ses maîtrises.
7. Modifier au moins un paramètre d'esquive et observer une différence.
8. Traverser plusieurs stages, affronter un boss et rejouer un stage.
9. Quitter puis retrouver la progression et les réglages sauvegardés.

## 9. Après le POC (à décider, pas à développer maintenant)

- Système de compétences évolutives et spécialisations sans classe fixe.
- Équipement plus riche et personnalisations visuelles.
- Davantage de stratégies IA, conditions et priorités.
- Nouveaux environnements, boss, motifs d'attaque et événements.
- Progression idle hors session, uniquement avec des règles d'équilibrage explicites.
- Éventuelles fonctionnalités sociales ou multijoueur.

---

**Prochaine décision technique :** choisir le moteur selon la plateforme cible (navigateur vs jeu desktop/mobile), les outils d'édition 3D souhaités et le langage à privilégier.
