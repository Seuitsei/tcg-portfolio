# Analyse de l’application fournie — 8 octobre 2026

Fichier : fr.pokeitem.app_1.2.7(1).xapk. Inspection statique des ressources et exécution locale de l’interface avec toutes les requêtes externes bloquées. Aucun accès aux comptes, serveurs ou données des utilisateurs de cette application.

## Résultats vérifiés

Le paquet contient `assets/public`, des pages et bundles Next.js et une configuration Capacitor. Les plugins déclarés comprennent CameraPreview, Camera, Filesystem, Preferences, Share, Haptics, Network, PushNotifications, SocialLogin et RevenueCat Purchases. Leur présence ne prouve pas leur fonctionnement sur chaque plateforme.

Sept routes ont été affichées dans un navigateur de 390 × 844 pixels. Les captures sont disponibles dans l’atelier. Les pages protégées ont conservé leur écran de connexion ; aucune authentification n’a été contournée. Les pages catalogue attendent des données externes. L’affichage des captures est donc incomplet par rapport à un compte connecté. La structure interne et les libellés français fournissent des indications supplémentaires, pas une preuve visuelle des écrans connectés.

## Livrables

- `atelier-interface.html` : exploration des captures et limites constatées.
- `test-interface.html` : première adaptation modifiable de l’agencement et des couleurs. Accueil du classeur, achats saisis, derniers ajouts, catalogue visuel, scanner et collection existants.
- `interface-reference/mobile.js` et `mobile.css` : interface propre au projet, indépendante des bundles de l’application fournie.

Le total affiché sur l’accueil représente uniquement les achats saisis, jamais une cote de marché. Les données de collection restent celles de `tcgCards`. Aucun nouvel abonnement, publicité, quota, compte ou suivi externe ajouté. Aucun fichier Android, secret de configuration ou bundle applicatif tiers publié.

## Direction mobile

Cible finale : Android et iOS ; le Web sert à tester. Conserver le moteur de reconnaissance et la logique de collection indépendants de l’interface. Prévoir des adaptateurs pour caméra, stockage, cycle de vie et partage. La présence de Capacitor dans l’APK constitue un exemple concret de cette organisation, mais ne remplace pas la validation de notre scanner sur de vrais appareils Android/iOS. La compilation, signature et publication sur les stores ne sont pas réalisées dans cette étape.

Modèle demandé ultérieurement : sans abonnement, petit bandeau publicitaire et publicité récompensée donnant éventuellement cinq scans réussis. Pas d’intégration pour l’instant.

## Routes trouvées dans les ressources

- `/`
- `/404`
- `/_not-found`
- `/aide`
- `/alertes`
- `/amazon`
- `/carte/_`
- `/chat`
- `/chat/_`
- `/collection`
- `/collection/cartes`
- `/collection/cartes/_/_`
- `/collection/cartes/_/_/checklist`
- `/collection/produits`
- `/collection/produits/_/_`
- `/collection/produits/_/_/_`
- `/confirmer-email`
- `/connexion`
- `/connexion-web`
- `/desabonnement`
- `/dev/feed-preview`
- `/dev/shops-preview`
- `/dev/top-cards-preview`
- `/echanges`
- `/inscription`
- `/international`
- `/marketplace`
- `/marketplace/_`
- `/mot-de-passe-oublie`
- `/onepiece`
- `/pokedex`
- `/pokedex/_`
- `/pokedex/detail`
- `/portfolio`
- `/portfolio/alertes`
- `/portfolio/analyse`
- `/portfolio/cartes`
- `/portfolio/cartes/_/_`
- `/portfolio/cartes/top`
- `/portfolio/doubles`
- `/portfolio/doubles/_/_`
- `/portfolio/fardes`
- `/portfolio/fardes/_`
- `/portfolio/fardes/detail`
- `/portfolio/gradation`
- `/portfolio/gradees`
- `/portfolio/items`
- `/portfolio/items-detail`
- `/portfolio/items/_`
- `/portfolio/items/top`
- `/portfolio/onchain`
- `/portfolio/souhaits`
- `/portfolio/statistiques`
- `/pricing`
- `/profil`
- `/recherche`
- `/reinitialiser-mot-de-passe`
- `/scanner`
- `/settings/mcp`
- `/settings/sharing`
- `/settings/tcg`
- `/social`
- `/u/_`
- `/verification`
