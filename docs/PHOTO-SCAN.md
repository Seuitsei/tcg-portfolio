# Test photo avec contrôle de netteté — 9 octobre 2026

Page séparée : `test-photo.html`. Sauvegarde complète de l'état précédent :
`backup/avant-photo-nette-20261009`, commit `5b0447c51c79a157394e1d90f69ba8ee4ac87893`.
La page principale et les autres versions de test ne sont pas modifiées.

Le cadre reste fixe. La caméra contrôle trois bandes du cadre (nom, attaques,
numéro), la finesse des contours, l'exposition et la stabilité pendant 600 ms.
Le cadrage est calculé dans les coordonnées du flux vidéo, avec object-fit:cover.
Le vert signifie une qualité estimée suffisante, pas une identité reconnue ni
une garantie de lisibilité de chaque caractère. Pas d'OCR en continu. Les bandes
supposent une carte centrée et droite ; elles ne vérifient pas sa présence et une
texture nette peut satisfaire ce contrôle. Le bouton reste utilisable avant le vert.

Le bouton rond Scanner capture la résolution native du flux fourni par le
navigateur, puis garde la photo visible pendant l'analyse manuelle du moteur
existant. Le moteur ne reçoit aucun appel de reconnaissance live. Les recherches,
références et règles de confirmation restent celles de la version sauvegardée.
La résolution native n'est pas celle du capteur photo : elle dépend du flux caméra.

Vérifications effectuées : syntaxe JS ; contrôle de netteté sur texte synthétique
net, flou, image uniforme et mouvement ; cadrage local de la photo Aquali fourni,
accepté net et refusé après flou de 2 ou 4 pixels. Ces essais ne mesurent pas la
fiabilité sur toutes les cartes. Le test navigateur `tests/photo-browser.cjs`
contrôle l'absence d'analyse live, la capture native, le cliché figé et la reprise.
Son exécution nécessite un Chromium installé ; le téléchargement de Chromium
était indisponible dans cet environnement, donc il n'a pas été exécuté ici.
Un essai sur téléphone reste nécessaire pour régler les seuils selon sa caméra.
