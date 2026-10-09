# Refonte du scanner et variantes — 20261009-4

## Ce que montre l'APK fourni

Le paquet retransmis est accessible localement. Ses ressources contiennent un aperçu caméra, une capture explicite et un appel POST /api/scanner/identify avec l'image et la langue. La caméra web vise 1280 × 720 ; la capture utilise la résolution vidéo disponible puis une image JPEG redimensionnée. La détection locale sert au déclenchement ; l'identification elle-même est faite par le service distant.

Le moteur serveur n'est pas inclus dans l'APK. Aucun appel à ce service, aucune clé et aucun code de l'application originale ne sont utilisés dans notre scanner. Son principe de capture manuelle indépendante du déclenchement automatique est reproduit avec notre moteur local.

## Nouveau parcours

- Les contours restent la voie rapide pour une carte bien délimitée.
- Si les contours échouent, plusieurs fenêtres centrées servent à retrouver des références visuellement proches dans l'index. La couleur ne confirme jamais l'identité.
- Les détails ORB et une homographie vérifient les références, puis projettent leurs quatre coins dans l'image. Le quadrilatère doit être convexe, dans l'image, suffisamment grand et de proportions plausibles.
- La recherche comporte jusqu'à 16 références avec trois téléchargements simultanés. La mise en route des téléchargements est limitée à une fenêtre de huit secondes ; les requêtes en cours gardent leur délai maximum habituel. Les caractéristiques sont mises en cache comme avant.
- Une localisation temporaire permet de contrôler la stabilité sans refaire cette recherche sur chaque image. La capture finale vérifie de nouveau l'identité. Les seuils de décision et les précautions sur les réimpressions restent inchangés.
- « Prendre une photo » analyse la scène, même sans contours détectés et sans état « Image prête ».
- Le scan automatique peut être désactivé pour conserver seulement la capture manuelle.
- Les imports utilisent également cette recherche. Les images restent sur l'appareil ; seuls les téléchargements de références et les demandes de prix sont en ligne.

## Validation sur les fichiers fournis

| Carte | Ancienne détection des contours | Nouvelle photo manuelle | Nouveau parcours automatique sur image fixe |
|---|---|---|---|
| Dracolosse V 192/203, pochette de classeur | Échec | Bonne proposition, confirmation requise | Bonne proposition, confirmation requise |
| Rayquaza VMAX 218/203, toploader | Échec | Bonne proposition, confirmation requise | Bonne proposition, confirmation requise |
| Bruyverne V 117/203, pochette de classeur | Échec | Correspondance forte correcte | Correspondance forte correcte |
| Rayquaza VMAX 111/203, pochette de classeur | Échec | Bonne proposition, confirmation requise | Bonne proposition, confirmation requise |

Les quatre imports passent aussi dans Chromium avec le vrai Worker et OpenCV, à une largeur mobile. Deux images sans carte (tissu texturé et blanc uniforme) sont rejetées. Les tests de caméra simulée vérifient trois scans successifs, les flux neufs, la capture manuelle sans coins et la fermeture lors de la navigation.

Ce sont quatre exemples et des images fixes, pas une mesure générale de fiabilité ni un test comparatif sur téléphone contre l'APK. Les temps mesurés sur l'environnement de développement ne prédisent pas les temps iPhone ou Android. Les références absentes, les fortes déformations et les reflets occultant les détails peuvent encore empêcher l'identification. Le premier scan peut nécessiter des téléchargements de références.

## Variantes du classeur

Chaque exemplaire reçoit un identifiant local, conservant toutes ses données existantes. Le choix de variante est stocké sur cet exemplaire, avec l'identifiant produit Cardmarket, TCGplayer ou un libellé stable, jamais sa seule position dans la liste.

Le choix se rétablit après navigation ou rechargement, même lorsque la source réordonne ses variantes. Une correspondance absente ou non unique demande une nouvelle confirmation. Les prix, le lien, l'historique et l'écart avec le prix d'achat suivent la variante choisie. Deux exemplaires identiques peuvent garder normale et jumbo séparément.

Tests : tests/portfolio-variants.cjs couvre les doublons, la migration, le rechargement, le changement d'ordre, le changement de choix et son effacement. tests/portfolio-delete.cjs couvre toujours la suppression et la protection contre une collection modifiée dans un autre contexte.

## Reproduction

Définir CHROMIUM_PATH et les chemins des photos/références externes TCG_TEST_PHOTOS et TCG_TEST_IMAGES pour les tests protected-cards.cjs et protected-browser.cjs. Les photos de l'utilisateur et l'APK ne sont pas publiés dans le dépôt.

La version stable index.html garde l'empreinte e92df4c75e06d17885b4a8455344e859f2e19d27.


## Correctifs 20261009-5 — trois nouvelles cartes et édition du classeur

Diagnostic reproduit avec les fichiers originaux du 9 octobre à 14:20 :

- Mew 025/025 : présent dans le catalogue textuel, absent de l'index visuel car TCGdex ne fournit pas son image. Ajout d'une référence officielle française distincte du Mew 011/025. Source : https://assets.pokemon.com/assets/cms2-fr-fr/img/cards/web/CEL/CEL_FR_25.png . Le fichier fr-cel25-extra.json contient seulement ses métadonnées et descripteurs calculés, pas les photos utilisateur. Aucun remplacement par une carte similaire.
- Mentali VMAX 065/203 : 28e candidat dans la recherche de scène, hors de la limite de 16. Aucun match ORB suffisant à la résolution initiale, même sur un cadrage manuel de diagnostic.
- Dracolosse V 191/203 : premier candidat colorimétrique mais aucun match ORB suffisant à la résolution initiale.

Le recours supplémentaire élargit la localisation à 40 candidats et calcule des détails ORB à 504 × 704 avec égalisation locale du contraste CLAHE. Les coordonnées restent dans le repère logique initial ; les homographies et les seuils de confiance existants sont conservés. La vérification finale à haute résolution part du cliché original. Ses nouveaux résultats doivent avoir au moins 12 points, un ratio de 0,55 et une couverture de référence de 0,15. Les références de ce mode utilisent une cache séparée. Les téléchargements commencent pendant huit secondes au maximum ; les requêtes lancées peuvent encore atteindre leur timeout. Les candidats non traités rendent la conclusion prudente.

La voie rapide reste prioritaire. Le mode détaillé peut prendre davantage de temps sur les cartes difficiles, particulièrement lors du premier téléchargement. Les références manquantes ne sont pas présentées comme exclues. Une localisation n'est jamais une confirmation d'identité.

Résultats de tests : bonne première carte pour les sept photos, en capture manuelle et en simulation de déclenchement automatique ; vrai Worker/OpenCV dans Chromium pour les sept imports ; deux images sans carte toujours rejetées. Mentali nécessite une confirmation ; le classement strong/candidates des autres photos dépend du cadrage et des références accessibles. Ces tests ne mesurent pas une précision générale sur iPhone/Android.

Classeur : crayon de même style que la corbeille, placé au-dessus ; dialogue de modification du prix d'achat et de la variante. Le prix de marché reste calculé depuis la source. Sauvegarde atomique sur l'identifiant de chaque exemplaire, y compris les doublons. Une version indisponible reste conservée et une modification concurrente de cette carte empêche l'écrasement. Annulation, validation du prix, effacement du prix d'achat, persistance et recalcul du gain sont testés dans portfolio-editor.cjs.

Après scan : prix Cardmarket en grand et vert, placé avant les détails de finition. Les variantes multiples restent à confirmer avant d'afficher leur prix. Le prix reste une tendance agrégée du produit, sans prétendre isoler langue et état.
