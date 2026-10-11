# Caméra Android — 11 octobre 2026

Le flou a été signalé sur un Samsung Fold 3 dans l’APK, alors que les mêmes cartes passaient sur iPhone. La cause matérielle n’est pas encore identifiée : aucun Fold physique n’est accessible dans les tests automatisés.

Comparaison des branches avant changement : scanner/camera.js, scanner/worker.js, scanner/photo-quality.js et scanner/data/japanese-test sont identiques dans main et android/test-apk. L’APK embarque les fichiers web et utilise getUserMedia dans Android WebView. Elle ne télécharge pas automatiquement les nouvelles versions du code du site.

## Ajustements

- Caméra arrière automatique conservée par défaut ; choix explicite d’un objectif parmi ceux exposés après autorisation.
- Demande d’autofocus continu à l’ouverture et attente des tentatives de réglage avant capture. Repli sur la mise au point ponctuelle seulement si exposée et si le mode continu ne fonctionne pas.
- Commande de mise au point, sans promesse de netteté ; maintien du mode continu lorsqu’il est disponible.
- Résolution réellement reçue et contrôlabilité de la mise au point visibles dans « Caméra et netteté ». Diagnostic de scan enrichi sans identifiant de périphérique.
- Récupération par choix d’une autre caméra si un objectif sélectionné n’est plus disponible.

Moteur de reconnaissance, seuils, données, cadre fixe, navigation et stockage tcgCards non modifiés. URL : https://seuitsei.github.io/tcg-portfolio/test-photo.html.

Sauvegardes : backup/avant-camera-fold3-web-20261011 (00b121119ab5ff1d3865f7c72e759a4d1b30eca0) et backup/avant-camera-fold3-apk-20261011 (efbef45338d95e7815f088f9180deca8574cb251).

## Validation et limites

tests/camera.mjs contrôle les commandes avec des pistes simulées : sélection explicite, commandes refusées, repli, arrêt et capacités absentes. tests/photo-quality.cjs contrôle le filtre de qualité sur images synthétiques. tests/fold-camera-browser.cjs utilise la caméra synthétique de Chromium avec des capacités et un worker simulés : affichage du déclencheur/résolution, demande de focus, changement et libération de flux, échec d’objectif, cadre inchangé et prix d’achat conservé. Ces tests passent localement ; ils ne mesurent ni la netteté d’un téléphone ni le taux de reconnaissance.

L’APK Test 2 conserve fr.craftdrop.tcgtest2, l’origine https://localhost et la clé debug stable précédente ; versionCode 2, versionName 1.0.1. Installer par-dessus Test 2, sans désinstaller. La mise à jour physique et la conservation de son classeur doivent encore être vérifiées sur l’appareil. L’ancienne Test 1 est une autre application.

## Essai sur Fold 3

Comparer Chrome sur la même URL et l’APK sur les mêmes cartes, à distance/lumière comparables. Ouvrir « Caméra et netteté », noter la résolution et essayer chaque objectif arrière exposé. Ne pas confondre « autofocus non contrôlable ici » avec absence d’autofocus matériel. Si aucun aperçu n’est net, utiliser une photo prise par l’application caméra Samsung puis l’importer. Copier les détails du scan pour examiner la qualité ; une amélioration ne peut être confirmée qu’après cet essai réel.
