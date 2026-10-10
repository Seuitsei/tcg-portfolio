# Références japonaises restantes — recherche complémentaire

Le lot officiel de 6 108 cartes est décrit dans [le bilan d’intégration](JAPANESE-SCANNER-INTEGRATION.md). Cette recherche complémentaire ne modifie pas le scanner.

## Archives anciennes

**1 354 scans distincts** ont été téléchargés et décodés depuis [PCG Search](https://pcg-search.com/card/search.php), une archive indépendante. Chaque correspondance exige le code de série de l’archive, le titre de la bonne série et le numéro imprimé indiqué par la fiche. Les noms du catalogue ne sont pas utilisés comme preuve quand ils sont mal traduits. **1 239 différences de noms** sont conservées explicitement, sans correction automatique du catalogue.

Chaque fichier est contrôlé en dimensions et proportion portrait, avec SHA-256. Les 1 354 images ont des hashes distincts. Il s’agit d’un contrôle documentaire et de fichier ; tous les numéros n’ont pas été relus individuellement dans les pixels et aucun taux de reconnaissance réel n’est annoncé.

| Série | Scans vérifiés |
|---|---:|
| E1 | 128 |
| E2 | 92 |
| E3 | 90 |
| E4 | 91 |
| E5 | 91 |
| PCG1 | 82 |
| PCG2 | 82 |
| PCG3 | 85 |
| PCG4 | 106 |
| PCG5 | 86 |
| PCG6 | 86 |
| PCG7 | 52 |
| PCG8 | 75 |
| PCG9 | 68 |
| VS1 | 140 |

Manifeste complet : `japanese-vintage-research.json.gz`. Reproduction : `python scripts/research-japanese-vintage.py` (aiohttp et Pillow). Le cache local accélère les vérifications répétées, mais les URLs et hashes sont sauvegardés dans le manifeste.

Les trois entrées VS restantes ont des identifiants de catalogue qui ne correspondent pas à une fiche de même numéro : `VS1-143`, `VS1-144`, `VS1-151`. Elles restent exclues plutôt que de leur associer une énergie de numéro différent.

## Autres pistes

- Les 60 divergences de noms de l’audit officiel comprennent de nombreuses mentions Prism Star ou des qualificatifs de professeur. Une normalisation limitée et vérifiée peut en résoudre une partie. Certaines divergences portent sur des cartes différentes ou des numéros inversés : elles nécessitent une revue individuelle.
- Les 162 cas officiels à plusieurs images incluent 160 cartes de SV11B/SV11W. Le [site officiel](https://www.pokemon-card.com/ex/sv11/index.html) indique des variantes miroir en plus des cartes normales. Une solution est de vérifier et conserver plusieurs références visuelles pour un même identifiant de carte, en demandant la finition à l’utilisateur, au lieu de choisir une image arbitrairement. Cette prise en charge n’est pas construite dans ce lot.
- Trois références officielles M6 sont horizontales. Le scanner actuel suppose une carte portrait ; un traitement géométrique adapté et des tests sont nécessaires. Elles ne sont pas comptées comme références standard prêtes.
- Les séries PMCG/Neo et certaines promos nécessitent encore un rapprochement documentaire, particulièrement quand il n’existe pas de numéro d’extension imprimé ou quand le catalogue contient une traduction erronée. Une illustration seule ne suffit pas à prouver l’édition.

## Suite proposée

Préparer les descripteurs de ces 1 354 scans secondaires, contrôler les noms et numéros signalés, tester les rééditions et les cartes anciennes, puis les intégrer au profil japonais de test. Cette étape n’a pas encore été faite. Le catalogue atteindrait alors potentiellement 11 340 références, et 1 441 entrées resteraient à résoudre.
