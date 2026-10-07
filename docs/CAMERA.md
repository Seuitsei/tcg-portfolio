# Optimisation caméra TEST — 7 octobre 2026

Cible demandée : iPhone 17 Pro Max, Safari. Aucun réglage spécifique au nom du téléphone n’est supposé : les capacités réelles de la piste sont interrogées.

- Capture vidéo idéale 1920×1080, 30 images/s demandées sans exigence stricte. La caméra arrière reste préférée ; aucun changement automatique d’objectif.
- Autofocus continu demandé une seule fois si `getCapabilities().focusMode` le permet. Si absent ou refusé, conservation du fonctionnement du navigateur ; aucun blocage du scan.
- Suivi en 640 pixels, cadence cible de 150 ms comprenant le temps de traitement, une seule requête à la fois. Les images vidéo inchangées ne sont pas renvoyées au moteur.
- Conservation d’une image jusqu’à 1600 pixels correspondant exactement à l’image évaluée. Pendant la séquence stable, choix selon netteté et reflets ; expiration après 650 ms. Réinitialisation sur mouvement, perte de carte, reprise ou fermeture. Mémoire bornée à une meilleure image et deux canvas.
- Durée de stabilité de 850 ms, seuils de qualité et reconnaissance inchangés. Capture manuelle toujours disponible.
- Diagnostic : dimensions, cadence et autofocus déclarés, sans identifiants de caméra.

Tests : `node tests/camera.mjs` ; `node tests/camera-browser.cjs` avec Playwright via `CODEX_PRIMARY_RUNTIME_NODE_MODULES` et binaire via `CHROMIUM_PATH`. Le second teste le flux caméra simulé et un worker de test ; il ne mesure pas les performances ni l’autofocus d’un iPhone physique. Validation sur l’iPhone de l’utilisateur encore nécessaire. Aucun gain de temps chiffré n’est garanti.

Sources : https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities et https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints
