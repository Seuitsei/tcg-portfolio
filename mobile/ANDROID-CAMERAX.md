# APK Android — caméra native CameraX

Cette intégration concerne uniquement la branche `android/test-apk`. La branche `main`, la page web publiée et les sources `test-photo.html`, `scanner/` et `interface-reference/` ne sont pas modifiées.

Sauvegarde : `backup/avant-camerax-apk-20261011`, commit `7293edf1941cc77d783c81743aa377a60621210f`.

## Fonctionnement

CameraX 1.6.2 fournit l’aperçu natif (PreviewView compatible/TextureView) et la capture JPEG (ImageCapture, qualité maximale). Le plugin Capacitor local `CardCamera` est enregistré dans MainActivity. Il est copié dans le projet Android généré par configure-android.cjs ; aucune bibliothèque APK précompilée n’est committée.

L’aperçu occupe la zone du scanner. Ses coordonnées suivent le défilement et la taille de la fenêtre ; son conteneur est coupé aux limites de la surface défilante pour ne pas recouvrir la navigation. Le cadre 63/88 reste fixe et centré : seule sa couleur change. L’appui sur l’aperçu ou « Relancer la mise au point » demande la mise au point et la mesure d’exposition à CameraX. Les caméras arrière exposées par CameraX sont sélectionnables ; le choix automatique reste le réglage par défaut. Les capacités dépendent du matériel : une commande ne garantit pas la netteté.

Le filtre de qualité existant reçoit, quatre fois par seconde au maximum, une image de l’intérieur du cadre prise dans l’aperçu natif. Il ne mesure pas l’identité de la carte. Le déclencheur capture une photo native, corrige son orientation EXIF puis limite son côté long à 2560 pixels pour maîtriser la mémoire. La photo est remise au véritable worker existant, sans changement des seuils, de la géométrie ou des références. Le JPEG de travail dans le cache privé est supprimé après lecture ; il n’est pas téléversé.

La préparation de l’APK modifie seulement les fichiers copiés dans `mobile/www` via patch-native-web.cjs. Le navigateur ne charge pas ces fichiers générés. Une origine https://localhost, un appId et une signature identiques à Test 2 sont conservés ; versionCode 3, versionName 1.1.0. Installer par-dessus Test 2 sans désinstaller. Test 1 demeure une autre application.

## Vérifications

- `mobile/test_native_web.cjs` teste le paquet généré dans Chromium avec un plugin et un worker simulés : aucun getUserMedia WebView, photo JPEG décodée vers le worker, cadre fixe, choix d’objectif, focus, captures/reprises, annulation et navigation, prix d’achat préservé. Ce test ne valide pas le matériel CameraX.
- `mobile/test_camerax.py` teste CameraX réellement sur l’émulateur Android : mise à jour de l’APK précédent sans désinstallation si l’artefact est disponible (sinon réinstallation par-dessus), même origine et prix d’achat préservé, aperçu, demande de mise au point, JPEG natif reçu par le worker de production, reprise, navigation et arrière-plan, barre du bas inchangée. Les captures et le résultat JSON sont sauvegardés dans l’artefact de validation.
- Les contrôles existants de qualité et de navigation restent dans le workflow. Une scène de caméra virtuelle ne constitue pas une photo de carte sur téléphone et ne donne aucun taux de reconnaissance.

La validation physique sur Samsung Fold 3 reste nécessaire : aperçu, focus à différentes distances, reflets, plusieurs cartes de suite, rotation/pliage et conservation du vrai classeur lors de la mise à jour. iOS/AVFoundation et l’OCR ne font pas partie de cette étape.
