# Scanner japonais — version de test du 10 octobre 2026

La page `test-photo.html` utilise désormais les 6 108 références officielles vérifiées par l’audit. Le catalogue visuel japonais passe de **3 878 à 9 986 cartes sur 12 781**, soit environ **78,1 % du catalogue**. Ce pourcentage décrit la présence de références, pas la précision sur des photos réelles.

## Sauvegarde et isolation

L’état précédent est conservé dans la branche [`backup/avant-integration-japonais-20261010`](https://github.com/Seuitsei/tcg-portfolio/tree/backup/avant-integration-japonais-20261010), au commit `95cc2edfef79198fb849a58f9749bc18ef709ccc`.

Les données supplémentaires sont dans `scanner/data/japanese-test/`. Seule la page photo de test active ce jeu de données via le paramètre du worker `jp=20261010`. La page habituelle conserve les index précédents ; `index.html`, les données FR/EN et l’ancien index japonais sont inchangés. Le cache japonais de test est séparé pour que ses préparations ne modifient pas le cache de la version habituelle. Les deux boutons Scanner existants sont conservés.

## Références et reconnaissance

Chaque source officielle a été téléchargée, décodée, contrôlée en dimensions et enregistrée avec son SHA-256 dans l’[audit initial](JAPANESE-REFERENCE-RESEARCH.md). Les nouveaux vecteurs utilisent le même code OpenCV que le scanner. Le préfixe de 3 878 vecteurs japonais existants est conservé octet pour octet.

Les références ORB normales et détaillées sont préparées par paquets de 64 cartes au maximum. Les paquets se téléchargent à la demande et sont conservés localement par le navigateur ; la mémoire décodée reste bornée par le worker. Le premier scan d’une série peut donc être plus lent et nécessiter une connexion. L’index de détails propose des candidats supplémentaires, puis la géométrie vérifie la correspondance. Les seuils visuels de confiance sont conservés.

Dans cette version japonaise de test, des éditions de même nom et aux vecteurs proches sont également proposées quand leur numéro diffère. Cela couvre les rééditions qui réutilisent une illustration : la couleur et l’illustration seule ne prouvent pas l’édition. Ces possibilités imposent une confirmation et ne prétendent pas identifier la finition.

## Vérification

`tests/japanese-integration.cjs` contrôle les SHA-256, tailles, identifiants, descripteurs et décodages de tous les paquets, la conservation du préfixe des vecteurs et des manifests FR/EN, ainsi que le chargement du worker réel dans les profils habituels et le profil japonais de test.

Les essais de reconnaissance utilisent des images de référence propres, légèrement floutées/modifiées et partiellement masquées par un reflet simulé. Trois scènes synthétiques contrôlent le parcours photo entière/manuelle ; deux cartes japonaises de l’ancien index servent de contrôle, dont une réédition à illustration proche. Pour ces contrôles, les références anciennes non disponibles localement sont simulées comme des non-correspondances, afin de vérifier la prudence du scanner sans dépendre du garde-fou « référence indisponible ».

Résultats détaillés : [`tests/japanese-integration-results.json`](../tests/japanese-integration-results.json). Ces essais ne mesurent pas une précision sur un téléphone, dans un classeur, et ne remplacent pas des essais avec les photos de l’utilisateur. La netteté du cadre reste une estimation visuelle ; elle ne garantit pas la lisibilité de chaque caractère.

## Cartes restantes

Il reste **2 795 cartes sans nouvelle référence intégrée**. La recherche complémentaire a trouvé **1 354 scans supplémentaires** dans une archive spécialisée, téléchargés et décodés, avec contrôle du titre de série et du numéro imprimé sur la fiche. Ils ne sont pas encore intégrés dans ce lot. Pour **1 239** de ces cartes, le nom du catalogue diverge du nom japonais de l’archive ; ces différences sont signalées explicitement.

Le [bilan complémentaire](JAPANESE-REMAINING-REFERENCES.md) et le manifeste `japanese-vintage-research.json.gz` conservent les URLs et hashes nécessaires pour préparer ce prochain lot. Leur intégration porterait la couverture à **11 340/12 781**, environ **88,7 %**, sous réserve de validation. Elle demande une nouvelle étape d’intégration et de tests, pas un simple changement de compteur.

## Reproduction

1. Recréer les sources de l’audit initial avec `scripts/audit-japanese-references.py` et le commit source indiqué dans l’audit.
2. Construire les paquets avec `node scripts/build-japanese-references.cjs ../jp-reference-cache 0 1`, puis consolider avec `node scripts/merge-japanese-shards.cjs 1`. Le constructeur accepte aussi plusieurs partitions indépendantes, puis une consolidation avec leur nombre.
3. Construire l’index avec `python scripts/build-japanese-detail-index.py`.
4. Exécuter `node tests/japanese-integration.cjs` avec les sources de l’audit dans `../jp-reference-cache`. Les deux contrôles anciens sont conservés dans `tests/fixtures/japanese/` et proviennent des URLs TCGdex déjà présentes dans le catalogue.

Dépendances : OpenCV fourni par le dépôt, sharp, aiohttp/Pillow pour la recherche, NumPy pour l’index. Le constructeur utilise `CODEX_PRIMARY_RUNTIME_NODE_MODULES` pour trouver sharp dans cet environnement.
