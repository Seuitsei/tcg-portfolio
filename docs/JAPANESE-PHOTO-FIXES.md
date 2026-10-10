# Photos japonaises — correction du 10 octobre 2026

URL conservée pour cette mise à jour et les suivantes : https://seuitsei.github.io/tcg-portfolio/test-photo.html.

Sauvegarde : `backup/avant-correction-photos-jp-20261010`, commit `09a718517eac69c9e9d8a9388e6e131b920d0146`.

## Causes reproduites

Le catalogue TCGdex annonce la série S10b mais renvoie zéro carte. Les cartes japonaises Pokémon GO étaient donc absentes du catalogue et des vecteurs. L’intégration ajoute 93 cartes numérotées, dont les secrètes, avec les noms et numéros de la base type-null/PTCG-database et des images du domaine officiel pokemon-card.com. Huit énergies sans numéro sont exclues : elles demandent des identifiants séparés.

Sur les photos réelles, Dracaufeu S10b-011 et Arceus S12a-262 présentent des correspondances géométriques solides avec les bonnes références, mais celles-ci échappaient à la nomination des candidats. Les reflets perturbent les couleurs et l’ancien index de détails utilisait seulement des détails normaux dans la zone d’illustration. La détection de contours peut aussi englober la pochette.

## Changement

- Préparer six références existantes de S12a, dont les quatre VSTAR dorées, dans des paquets locaux ; leurs vecteurs existants sont conservés.
- Ajouter les détails de la version améliorée des références, répartis entre le nom, l’illustration, les attaques et le numéro. Pour les références TCGdex de faible résolution, conserver tous les niveaux de la pyramide ORB.
- Dans le profil japonais de test, examiner jusqu’à 32 nominations de détails, avec les régions normales et améliorées. Le scan manuel japonais commence par cette recherche ; le profil habituel conserve son parcours.
- Chaque nomination passe toujours par la géométrie. Les seuils de décision et les protections contre les rééditions restent inchangés. Les quatre photos difficiles sont proposées à confirmer, sans certification automatique.
- Catalogue japonais de test : 12 874 cartes ; références visuelles : 10 079. Ce sont des comptes de références, pas un taux de réussite.
- Le nouvel index de détails compressé représente environ 17,4 Mo, chargé une fois puis mis en cache. Les paquets de cartes restent téléchargés à la demande. Le premier chargement et les photos difficiles peuvent prendre plus de temps.

## Validation

`tests/japanese-real.cjs` exécute le véritable worker avec OpenCV sur quatre photos locales de l’utilisateur, sans les publier : S8b-252, S10b-011, S10b-049 et S12a-262. Les bonnes cartes doivent être en première proposition, jamais rejetées. Une image blanche doit être rejetée. Les photos sont fournies via `TCG_JP_PHOTOS`.

`tests/japanese-photo-data.cjs` vérifie les hashes et décodages des paquets, les identifiants, la conservation du préfixe des vecteurs, des contrôles synthétiques et le chargement des anciens profils français, anglais et japonais. Les résultats locaux ne remplacent pas des essais sur iPhone.

Sources et hashes : `japanese-photo-reference-sources.json`. Les photos utilisateur et caches d’images ne sont pas committés.
