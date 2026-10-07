# Recherche et analyse des applications de référence

État étudié le 7 octobre 2026. Analyse statique limitée aux packages fournis, noms de composants, flux d’appels pertinents et JavaScript client. Pas de connexion aux comptes des applications, d’appel de leur API privée, de copie de code propriétaire ni d’extraction de secret. Les APK et leur code ne sont pas publiés dans ce dépôt.

## Applications Android

| Question | PokéItem 1.2.7 (`fr.pokeitem.app`) | PokéManager 8.1.1 (`pt.tscg.pokemanager`) |
|---|---|---|
| Architecture visible | Application Capacitor avec interface Next.js/React embarquée | Application Android avec code Java/Kotlin ; composants BigAR |
| Caméra | Branche web `getUserMedia`, arrière idéale, 1280 × 720 ; branche native avec échantillonnage caméra | CameraX embarqué ; bibliothèques OpenCV natives présentes. La présence d’une bibliothèque seule ne prouve pas son utilisation par tous les modes |
| Flux / auto-capture | Échantillon réduit à 128 pixels de large, comparaison en niveaux de gris et tests de structure/bordure ; boucle d’environ 280 ms | Les détails exacts de la boucle native ne sont pas établis par cette inspection |
| Stabilité | Seuils de différence entre images et 3 à 8 observations selon le type de structure ; temporisation après déclenchement | Non déterminée précisément |
| Prétraitement | Capture JPEG, branche de redimensionnement avec limite 1280 et qualité 0,85 ; autre capture intermédiaire à 0,92 | Chemin de fichier image temporaire observé ; paramètres de redimensionnement/compression non établis |
| Reconnaissance | POST de l’image et de la langue vers une route d’identification serveur ; résultat contenant candidats et confiance | `ProScannerManager.scanPayload` obtient le fichier image et appelle `ProScannerApiRepository.scan`, puis `ScanAPI.scan` ; traitement Pro serveur confirmé |
| Confiance | Champs candidats, confiance supérieure et niveaux de résultat visibles côté client ; calibration serveur inconnue | `getScannerProMinScore` lu depuis la configuration distante puis passé à l’appel de scan ; rôle du seuil confirmé, formule et calibration inconnues |
| Variantes | Métadonnées de langue et d’indice de variante, confirmation utilisateur, correction de sélection | Identifiants de résultat/layout et états succès/aucun résultat/échec ; classement exact des variantes non déterminé |
| OCR / embeddings | Des champs OCR existent dans les corrections ; le moteur serveur n’est pas livré avec le client | Aucun modèle TFLite/ONNX identifié dans les fichiers inspectés ; cela n’exclut pas des modèles distants ou téléchargés |
| Redressement | Aucun algorithme de perspective suffisamment établi dans la branche inspectée | OpenCV présent, sans preuve suffisante de l’algorithme exact dans le Pro scanner |

Dans PokéManager, les noms `SCANNER_PRO_MIN_SCORE`, `SCANNER_PRO_UPLOAD_PHOTO`, `ProScannerManager`, `MassScan` et les événements succès/échec sont effectivement présents. Surtout, les appels montrent que le seuil est réellement transmis au dépôt API ; l’analyse ne repose donc pas uniquement sur le nom d’une constante. Le code serveur, sa latence et son modèle ne peuvent pas être déduits de ces packages.

La fluidité apparente combine donc au moins deux problèmes différents : sélectionner une bonne image localement, puis identifier la carte. La nouvelle implémentation sépare également ces étapes, avec son propre moteur de reconnaissance local.

## Briques étudiées

| Solution | Licence / statut | Décision |
|---|---|---|
| OpenCV 4.10, build JavaScript/WASM | Apache-2.0 ; build npm épinglé `@techstark/opencv-js@4.10.0-release.1` | Retenu pour contours, perspective, ORB et RANSAC dans un Worker |
| TCGdex | Base sous MIT ; les illustrations gardent leurs droits propres | Retenu pour métadonnées FR/EN et références visuelles |
| PK Scan | MIT dans le dépôt inspecté, commit `d5a25ad09499a69db9edcc288e5273159ce3b10d` | Inspiration pour les grilles RGB normalisées et le cache ; pas de portage de l’application native |
| ML Kit | SDK mobile Google gratuit, pas une bibliothèque web open source de remplacement | Non retenu pour la page GitHub Pages ; pertinent si une vraie application native est décidée |
| ONNX Runtime Web | MIT | Bonne piste pour un futur modèle d’embeddings validé ; le runtime seul ne fournit pas un modèle adapté aux cartes |
| TensorFlow / Lite | Apache-2.0 pour le code ; vérifier séparément la licence des poids | Non ajouté sans modèle et dataset de validation adéquats |
| MediaPipe | Apache-2.0 pour le code ; modèles à vérifier séparément | Une détection générique n’apporte pas directement l’identité d’une carte ; pas de dépendance supplémentaire dans cette version |
| pHash / dHash / aHash et histogrammes seuls | Algorithmes ; licence selon implémentation | Écartés comme preuve principale : détails perdus, sensibilité au cadrage et aux réimpressions |
| IndexedDB | API du navigateur | Retenu ; SQLite/WASM serait une dépendance supplémentaire inutile pour ce cache |

### PK Scan : ce qu’il fait réellement

Le code et le README montrent une application Expo avec OCR ML Kit sur trois zones, recherche SQLite locale, puis une comparaison visuelle de secours. Cette dernière exploite une grille de couleurs normalisée. Ses chiffres publiés concernent des images transformées et des groupes de candidats, pas une preuve de précision sur tout le catalogue filmé en conditions réelles. Notre pipeline inverse la priorité : visuel d’abord, vérification géométrique ensuite. L’OCR n’est pas utilisé dans ce prototype TEST.

### Autres projets

- **the-tin-app/the_tin** : projet iOS avec reconnaissance locale et packs d’empreintes, AGPL-3.0. Architecture intéressante, mais aucun code repris : cela introduirait des obligations différentes de la pile permissive choisie. Source : https://github.com/the-tin-app/the_tin
- **philmantatsky/real-time-trading-card-recognizer** : reconnaissance par embeddings/ArcFace et TensorRT. Code annoncé MIT, poids issus d’un entraînement basé sur un checkpoint NVIDIA aux conditions distinctes. Dépendances GPU et absence de validation web mobile suffisante : non intégré. Le projet souligne lui-même l’écart possible entre résultats synthétiques et vraies photos. Source : https://github.com/philmantatsky/real-time-trading-card-recognizer
- **t-sinclair2500/pokemon-scanner** : projet Python combinant plusieurs briques OCR/visuelles. Son existence ne démontre pas un moteur prêt pour un navigateur mobile. Aucun composant repris. Source : https://github.com/t-sinclair2500/pokemon-scanner

## Catalogue et conditions

La FAQ officielle TCGdex indique une API gratuite sans clé, sans limite dure publiée, et recommande le cache pour les volumes importants. Le build fait un téléchargement initial des vignettes avec concurrence bornée et reprise du cache. L’application utilise un index préconstruit, pas un balayage de dizaines de milliers d’images à chaque scan. Les images ne sont pas redistribuées en masse : le dépôt contient des caractéristiques dérivées et des URL.

La base MIT ne transfère pas les droits Pokémon sur les illustrations. Les attributions sont conservées. Aucun droit de réutilisation des composants propriétaires des deux APK n’est supposé.

Le dépôt officiel Pokémon TCG Data annonce la dépréciation de Pokémon TCG API et une fermeture prévue le 1er mars 2027. Il ne sert donc pas de socle à la nouvelle version. Seul un rapprochement historique explicite des cartes de Célébrations comble les images absentes de TCGdex ; leur hébergement est une dépendance à remplacer si ces images deviennent indisponibles.

## Sources primaires

- https://github.com/JeremyMCastillo/pk-scan — code, README et LICENSE inspectés
- https://opencv.org/license/
- https://docs.opencv.org/4.13.0/dc/d16/tutorial_akaze_tracking.html
- https://tcgdex.dev/faq
- https://tcgdex.dev/assets
- https://github.com/tcgdex/cards-database/blob/master/LICENSE
- https://github.com/PokemonTCG/pokemon-tcg-data
- https://docs.pokemontcg.io/getting-started/rate-limits/
- https://developers.google.com/ml-kit/guides
- https://github.com/microsoft/onnxruntime/blob/main/LICENSE
- https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE
- https://github.com/tensorflow/tensorflow/blob/master/LICENSE

Aucun petit serveur supplémentaire n’a démontré ici un bénéfice justifiant sa mise en place. Un futur service d’embeddings ne sera à évaluer qu’avec des photos réelles, un modèle légalement réutilisable et un coût mesuré ; aucun budget hypothétique n’est présenté comme un devis.
