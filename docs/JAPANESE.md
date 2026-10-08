# Japonais — version TEST

Le sélecteur « 日本語 · Japonais (partiel) » charge 3 878 références visuelles japonaises provenant de TCGdex, réparties sur 33 extensions. Catalogue récupéré le 7 octobre 2026. Les cartes sans image exploitable ne sont pas reconnues ; la couverture reste partielle. Quatre images ont échoué : S12a-055, SV1a-043, S9a-062, SV1V-072.

Le traitement des photos reste local. Les réglages caméra et seuils de reconnaissance FR/EN sont conservés. Les éditions ambiguës restent à confirmer. La première analyse peut télécharger des références supplémentaires ; elles sont ensuite mises en cache. La recherche manuelle accepte le nom japonais ou le numéro.

Les prix utilisent uniquement l’identifiant exact de la carte dans `/v2/ja/cards/`. Une cote absente reste indisponible. Le lien Cardmarket demande la langue japonaise ; vérifier la correspondance et la variante chez le vendeur.

## Validation

108 essais synthétiques sur 36 images de référence : perspective, flou/couleur et reflet simulé. Bonne carte en première position dans 107/108 essais, dans les trois premiers dans 108/108 ; aucune identification erronée classée sûre. Quatre images uniformes rejetées. Ces essais ne mesurent pas la fiabilité sur des cartes physiques ou sur iPhone.

Test navigateur : moteur réel, chargement japonais, import SV7-001, retour au français, libellé de couverture partielle et requête de prix japonaise sans substitution.

## Reproduction

Les fichiers `catalog-ja.json` et `sets-ja.json` sont les réponses des endpoints TCGdex `/v2/ja/cards` et `/v2/ja/sets`. Pour reconstruire les vecteurs, enregistrer ces réponses sous `ja-cards.json` et `ja-sets.json`, puis lancer `scripts/build-global-vectors.py --cache <images> --metadata <metadata> --langs ja` avec les dépendances Python du constructeur. Les références Pocket sont exclues par le constructeur.

Lancer `JAPANESE_IMAGES=<images> node tests/japanese.cjs` pour les déformations ; `CHROMIUM_PATH=<chromium> JAPANESE_IMAGES=<images> node tests/japanese-browser.cjs` pour le navigateur. Les images en cache portent le nom `ja-<id>.webp`.
