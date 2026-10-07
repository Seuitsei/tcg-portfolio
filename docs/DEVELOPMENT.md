# Développement et restauration

## Servir l’application

Site statique sans compilation : `python -m http.server 8000` depuis la racine,
puis `http://localhost:8000/test-localisation.html`. L’accès caméra demande HTTPS
ou localhost. Ne pas ouvrir directement le fichier en `file://`.

`scanner/app.js` pilote l’interface et la caméra ; `worker.js` charge les index,
les caches et les références ; `vision.js` contient les fonctions testables de
vision. Les URLs de modules portent un numéro de version. Aucune dépendance au
contenu des pages OCR historiques.

## Reconstruire les données

Python 3.12 avec `aiohttp`, `numpy`, `Pillow`, `opencv-python-headless`.
Le build initial a utilisé OpenCV Python 5.0.0.93. Le runtime web est OpenCV 4.10.
La parité des descripteurs est contrôlée par le benchmark ; les ORB se vérifient
par appariement et ne sont pas présumés byte-identiques entre versions.

```bash
pip install aiohttp numpy Pillow opencv-python-headless==5.0.0.93
python scripts/build-index.py --cache /tmp/tcg-images --metadata /tmp/tcg-metadata
python scripts/build-global-vectors.py --cache /tmp/tcg-images --metadata /tmp/tcg-metadata
python scripts/build-celebrations.py /path/to/pokemon-tcg-data/cards/en/cel25c.json /tmp/tcg-images
```

Pour la première commande, omettre `--metadata` si les quatre JSON `fr-cards`,
`en-cards`, `fr-sets`, `en-sets` n’existent pas : le script les télécharge dans
le dossier cache. Passer alors ce même dossier à `--metadata` pour la deuxième
commande. Les téléchargements de vignettes reprennent à partir du cache ; ne pas
les recommencer inutilement. Les échecs sont recensés dans les index globaux.

La commande Classic Collection doit suivre la génération des packs car elle
complète `catalog.json` et remplace les deux packs correspondants. Garder cette
provenance et la langue réelle des références.

## Tests

Les tests requièrent Node, `sharp`, `playwright` et un Chromium installé.
`CODEX_PRIMARY_RUNTIME_NODE_MODULES` désigne le dossier contenant ces paquets,
ou adapter les deux `require` aux paquets npm locaux. `CHROMIUM_PATH` peut
spécifier l’exécutable Chromium/headless-shell.

- `node --check scanner/app.js`, puis `worker.js` et `vision.js`.
- `node tests/benchmark.cjs` : images dans `../analysis/images` à côté du dépôt,
  noms `{lang}-{id}.webp`, téléchargées avec les scripts de construction. Produit
  `tests/benchmark-results.json`. Même logique géométrique que le navigateur.
- `node tests/browser.cjs` : démarre son propre serveur local ; utilise une vidéo
  Y4M synthétique dans `../analysis/camera.y4m`, les vignettes locales et les mêmes
  scripts de production. Les réponses du CDN sont remplacées par les vignettes
  originales mises en cache pour rendre le test déterministe, sans service privé.
  Produit `tests/browser-results.json`.
- La caméra synthétique est une carte de référence projetée dans une scène
  640 × 480, pas une capture de smartphone. Voir `scripts/make-camera-fixture.py`.

Ne pas présenter ces chiffres comme une mesure de précision sur de vrais objets.

## Publier et restaurer

Vérifier avant publication :

```bash
git hash-object index.html
# doit rester e92df4c75e06d17885b4a8455344e859f2e19d27
```

Ne publier que `test-localisation.html` et les nouveaux fichiers de cette
implémentation. Ne modifier ni `index.html`, ni les anciennes pages de test/OCR.
Pas de service worker global, pas de secret, pas de package Android dans le dépôt.
La publication sur la branche servie par GitHub Pages actualise **le même lien**.

Pour restaurer uniquement la page TEST historique, récupérer
`test-localisation.html` depuis `restore/pre-visual-scanner-2026-10-07` et faire un
nouveau commit (pas de force-push). Les nouveaux fichiers deviennent inactifs.
Le commit de sauvegarde permet aussi de restaurer la totalité de l’état initial.
La promotion vers la page principale attend l’accord de l’utilisateur.
