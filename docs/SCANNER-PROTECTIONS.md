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
