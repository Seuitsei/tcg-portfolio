# Prix sur la page TEST

Après une identification forte ou le choix explicite d’un candidat, la fiche demande les prix de l’ID exact à `https://api.tcgdex.net/v2/{fr|en}/cards/{id}`. Aucune photo n’est envoyée. Le scanner, son worker et la page stable ne sont pas modifiés.

- Cardmarket : tendance du produit et moyenne 30 jours en EUR. La série supplémentaire « holo » est affichée séparément lorsqu’elle existe ; elle n’est pas assimilée automatiquement à une finition reverse.
- TCGplayer : prix marché en USD, séparés selon les variantes fournies.
- Les variantes détaillées ont priorité. Plusieurs variantes imposent un choix ; une variante sans prix ne récupère jamais silencieusement le prix général ou celui d’une autre édition.
- Langue : le catalogue est demandé dans la langue sélectionnée, mais cela ne signifie pas que la cote correspond à cette langue. Les réponses FR/EN observées pour Kyogre partagent les mêmes prix et identifiants. Cardmarket est présenté comme une cote regroupant les langues ; TCGplayer comme référence du marché américain, sans certifier la langue. La fiche Cardmarket porte un filtre de langue à vérifier sur le site.
- Date fournie par chaque source, avertissement au-delà de 7 jours, aucun zéro artificiel pour une donnée manquante. Aucun taux de conversion.
- Cache en mémoire pendant une heure, délai maximal de 12 secondes, bouton de relance, protection contre les réponses d’une ancienne sélection.
- Le prix d’achat et la finition du portfolio restent des saisies indépendantes. Pas de serveur ni de clé payante.

Les correspondances externes sont celles de TCGdex et peuvent comporter des erreurs ; l’édition, la langue et l’état doivent être vérifiés sur la fiche marchande. Certains marchés/variantes ne fournissent pas de prix. Les liens externes Cardmarket peuvent être soumis à leur protection anti-robot.

Sources consultées le 7 octobre 2026 :
- https://tcgdex.dev/markets-prices
- https://tcgdex.dev/reference/card
- https://tcgdex.dev/faq

Tests : `node tests/prices.cjs` avec Playwright accessible via `CODEX_PRIMARY_RUNTIME_NODE_MODULES` et éventuellement `CHROMIUM_PATH`. Les fixtures sont des extraits de réponses publiques du 7 octobre 2026, utilisés uniquement par les tests, jamais comme prix de production.

Validation effectuée : tests DOM (`tests/prices-dom.cjs`, jsdom via `JSDOM_PATH`) et navigateur Chromium (`tests/prices.cjs`) réussis : EUR/USD, libellés FR/EN, cache, choix d’édition, variante sans prix, marché absent, zéro absent, relance, réponse obsolète et largeur mobile 390 px. Syntaxe JS et diff vérifiés. Empreinte de `index.html` stable inchangée : `e92df4c75e06d17885b4a8455344e859f2e19d27`.
