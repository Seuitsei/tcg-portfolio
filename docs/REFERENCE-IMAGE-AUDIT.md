# Audit des références visuelles

Vérification : 2026-10-09T15:17:33+00:00.

Les **1 820 références françaises et 565 anglaises retrouvées sont intégrées** au catalogue et aux packs de reconnaissance. Les cartes Pocket sont exclues. Les références déjà présentes dans les packs ORB sont comptées. Une référence trouvée correspond à une image téléchargée, décodée et vérifiée dans la langue indiquée ; son association au numéro doit être conservée lors de l’intégration.

Les séries non résolues ne sont pas nécessairement introuvables : aucune image n’a été confirmée dans les sources testées. Les anciennes séries et les séries japonaises nécessitent d’autres sources. Les erreurs réseau restent distinctes des réponses 404 dans le cache du script.

| Langue | Cartes physiques | Présentes avant ajout | Manquantes avant ajout | Images retrouvées | Restantes |
|---|---:|---:|---:|---:|---:|
| fr | 20054 | 17155 | 2899 | 1820 | 1079 |
| en | 21256 | 19684 | 1572 | 565 | 1007 |
| ja | 12781 | 3878 | 8903 | 0 | 8903 |

## Intégration

Les images officielles restent associées à leur langue et à leur numéro. Les packs contiennent les points ORB normaux et renforcés, calculés à partir des fichiers vérifiés. Le catalogue peut préparer ces nouvelles références sans dépendre du téléchargement des images depuis un autre domaine. Les fichiers téléchargés sont mémorisés localement dans IndexedDB.

Un index de détails permet de proposer des cartes dont les couleurs sont altérées par une pochette ou des reflets. Il ne décide jamais de l’identité : les correspondances géométriques restent nécessaires. Les seuils de validation forte sont conservés. Une couleur fortement altérée peut seulement produire une proposition à confirmer si au moins 24 correspondances cohérentes couvrent largement les deux images, sans rival proche. La recherche couleur conserve une piste dédiée aux anciennes références pour éviter que les ajouts les éliminent du classement.

Le premier chargement de cet index représente environ 19 Mo en français ou 13 Mo en anglais. Les packs de séries se chargent à la demande. Les scans difficiles peuvent encore demander un traitement plus long ; les alternatives à confirmer restent affichées. Les photos utilisateur ne sont pas publiées et le traitement visuel reste local.

La page stable `index.html` est conservée. Sauvegarde avant intégration : branche `backup/avant-complement-references-20261009`.

## Vérification

- Les neuf nouvelles photos en classeur retrouvent leur bonne carte dans l’interface Chromium avec le moteur réel, dont les quatre Trainer Gallery. Les sept anciennes photos retrouvent également leur carte. Les résultats incertains restent des propositions à confirmer.
- Un morceau de tissu et une image blanche restent rejetés ; la règle de confirmation sous voile coloré rejette les correspondances faibles, localisées ou ambiguës.
- Les 30 références Trainer Gallery sont préparées en français et en anglais sans téléchargement des images externes. Après redémarrage du worker, les packs et l’index de détails sont récupérés dans IndexedDB, avec les téléchargements de références bloqués.
- Trois scans successifs, le redémarrage de la caméra et le cadre fixe rouge/vert sont vérifiés avec une caméra simulée. Les tests ne remplacent pas un essai sur iPhone ou Android physique.

## Limites de la recherche

| Langue | Autre source à rechercher | Aucune image confirmée aux URL testées | Erreur réseau non résolue | URL non vérifiée |
|---|---:|---:|---:|---:|
| fr | 858 | 221 | 0 | 0 |
| en | 867 | 140 | 0 | 0 |
| ja | 8899 | 4 | 0 | 0 |

## Séries avec références manquantes

| Langue | Série | Identifiant | Manquantes | Retrouvées | Restantes |
|---|---|---|---:|---:|---:|
| en | Shining Fates Shiny Vault | swsh4.5sv | 122 | 122 | 0 |
| en | MEP Black Star Promos | mep | 89 | 0 | 89 |
| en | Shining Legends | sm3.5 | 78 | 78 | 0 |
| en | Dragon Majesty | sm7.5 | 78 | 78 | 0 |
| en | Crown Zenith Galarian Gallery | swsh12.5gg | 70 | 70 | 0 |
| en | SM Black Star Promos | smp | 67 | 62 | 5 |
| en | Aquapolis | ecard2 | 40 | 0 | 40 |
| en | My First Battle | mfb | 34 | 0 | 34 |
| en | SVP Black Star Promos | svp | 34 | 2 | 32 |
| en | Skyridge | ecard3 | 32 | 0 | 32 |
| en | 30th Classic Collection | 30th-c | 30 | 0 | 30 |
| en | Astral Radiance Trainer Gallery | swsh10tg | 30 | 30 | 0 |
| en | Lost Origin Trainer Gallery | swsh11tg | 30 | 30 | 0 |
| en | Silver Tempest Trainer Gallery | swsh12tg | 30 | 30 | 0 |
| en | Brilliant Stars Trainer Gallery | swsh9tg | 30 | 30 | 0 |
| en | BW trainer Kit (Excadrill) | tk-bw-e | 30 | 0 | 30 |
| en | BW trainer Kit (Zoroark) | tk-bw-z | 30 | 0 | 30 |
| en | HS trainer Kit (Gyarados) | tk-hs-g | 30 | 0 | 30 |
| en | HS trainer Kit (Raichu) | tk-hs-r | 30 | 0 | 30 |
| en | SM trainer Kit (Alolan Raichu) | tk-sm-r | 30 | 0 | 30 |
| en | XY trainer Kit (Bisharp) | tk-xy-b | 30 | 0 | 30 |
| en | XY trainer Kit (Latias) | tk-xy-latia | 30 | 0 | 30 |
| en | XY trainer Kit (Latios) | tk-xy-latio | 30 | 0 | 30 |
| en | XY trainer Kit (Noivern) | tk-xy-n | 30 | 0 | 30 |
| en | XY trainer Kit (Pikachu Libre) | tk-xy-p | 30 | 0 | 30 |
| en | XY trainer Kit (Suicune) | tk-xy-su | 30 | 0 | 30 |
| en | XY trainer Kit (Sylveon) | tk-xy-sy | 30 | 0 | 30 |
| en | XY trainer Kit (Wigglytuff) | tk-xy-w | 30 | 0 | 30 |
| en | Unseen Forces Unown Collection | exu | 28 | 0 | 28 |
| en | McDonald's Collection 2021 | 2021swsh | 25 | 0 | 25 |
| en | Scarlet & Violet Energy | sve | 24 | 0 | 24 |
| en | SWSH Black Star Promos | swshp | 22 | 22 | 0 |
| en | SM trainer Kit (Lycanroc) | tk-sm-l | 18 | 0 | 18 |
| en | McDonald's Collection 2022 | 2022swsh | 15 | 0 | 15 |
| en | McDonald's Collection 2023 | 2023sv | 15 | 0 | 15 |
| en | McDonald's Collection 2024 | 2024sv | 15 | 0 | 15 |
| en | McDonald's Collection 2011 | 2011bw | 12 | 0 | 12 |
| en | McDonald's Collection 2012 | 2012bw | 12 | 0 | 12 |
| en | McDonald's Collection 2014 | 2014xy | 12 | 0 | 12 |
| en | McDonald's Collection 2015 | 2015xy | 12 | 0 | 12 |
| en | McDonald's Collection 2016 | 2016xy | 12 | 0 | 12 |
| en | McDonald's Collection 2017 | 2017sm | 12 | 0 | 12 |
| en | McDonald's Collection 2018 | 2018sm | 12 | 0 | 12 |
| en | McDonald's Collection 2019 | 2019sm | 12 | 0 | 12 |
| en | DP trainer Kit (Manaphy) | tk-dp-m | 12 | 0 | 12 |
| en | EX trainer Kit 2 (Minun) | tk-ex-m | 12 | 0 | 12 |
| en | EX trainer Kit 2 (Plusle) | tk-ex-p | 12 | 0 | 12 |
| en | DP trainer Kit (Lucario) | tk-dp-l | 11 | 0 | 11 |
| en | EX trainer Kit (Latias) | tk-ex-latia | 10 | 0 | 10 |
| en | EX trainer Kit (Latios) | tk-ex-latio | 10 | 0 | 10 |
| en | Best of game | bog | 9 | 0 | 9 |
| en | HGSS Black Star Promos | hgssp | 9 | 0 | 9 |
| en | Mega Evolution Energy | mee | 8 | 0 | 8 |
| en | Forbidden Light | sm6 | 6 | 6 | 0 |
| en | Yellow A Alternate | xya | 6 | 0 | 6 |
| en | Poké Card Creator Pack | ex5.5 | 5 | 0 | 5 |
| en | BW Black Star Promos | bwp | 3 | 0 | 3 |
| en | XY Black Star Promos | xyp | 3 | 0 | 3 |
| en | POP Series 6 | pop6 | 2 | 0 | 2 |
| en | Celebrations | cel25 | 1 | 0 | 1 |
| en | Double Crisis | dc1 | 1 | 0 | 1 |
| en | Team Rocket Returns | ex7 | 1 | 0 | 1 |
| en | Generations | g1 | 1 | 0 | 1 |
| en | Miscellaneous Promos | miscp | 1 | 0 | 1 |
| en | Rising Rivals | pl2 | 1 | 1 | 0 |
| en | Guardians Rising | sm2 | 1 | 1 | 0 |
| en | Burning Shadows | sm3 | 1 | 1 | 0 |
| en | Destined Rivals | sv10 | 1 | 0 | 1 |
| en | Chilling Reign | swsh6 | 1 | 1 | 0 |
| en | Fates Collide | xy10 | 1 | 1 | 0 |
| en | BREAKthrough | xy8 | 1 | 0 | 1 |
| fr | Promo SM | smp | 248 | 221 | 27 |
| fr | Éveil des Légendes | dp6 | 146 | 146 | 0 |
| fr | Diamant & Perle | dp1 | 130 | 130 | 0 |
| fr | Trésors Mystérieux | dp2 | 124 | 124 | 0 |
| fr | Destinées Radieuses Coffre Étincelant | swsh4.5sv | 122 | 122 | 0 |
| fr | L'appel des Légendes | col1 | 106 | 106 | 0 |
| fr | Duels au Sommets | dp4 | 106 | 106 | 0 |
| fr | Tempête | dp7 | 106 | 106 | 0 |
| fr | Aube Majestueuse | dp5 | 100 | 100 | 0 |
| fr | Destinées Occultes Coffre Étincelant | sma | 94 | 94 | 0 |
| fr | MEP Black Star Promos | mep | 88 | 0 | 88 |
| fr | Légendes Brillantes | sm3.5 | 78 | 78 | 0 |
| fr | Majesté Des Dragons | sm7.5 | 78 | 78 | 0 |
| fr | Zénith Suprême Galerie Galaroise | swsh12.5gg | 70 | 70 | 0 |
| fr | Harmonie des Esprits | sm11 | 69 | 69 | 0 |
| fr | Destinées Occultes | sm115 | 69 | 69 | 0 |
| fr | Promo DP | dpp | 42 | 0 | 42 |
| fr | Collection McDonald's 2019 | 2019sm-fr | 41 | 0 | 41 |
| fr | Collection McDonald's 2018 | 2018sm-fr | 40 | 0 | 40 |
| fr | Alliance Infaillible | sm10 | 38 | 38 | 0 |
| fr | SVP Black Star Promos | svp | 32 | 0 | 32 |
| fr | Collection Classique30ᵉ Anniversaire | 30th-c | 30 | 0 | 30 |
| fr | Astres Radieux Galerie de Dresseurs | swsh10tg | 30 | 30 | 0 |
| fr | Origine Perdue Galerie de Dresseurs | swsh11tg | 30 | 30 | 0 |
| fr | Tempête Argentée Galerie de Dresseurs | swsh12tg | 30 | 30 | 0 |
| fr | Stars Étincelantes Galerie de Dresseurs | swsh9tg | 30 | 30 | 0 |
| fr | BW Kit du dresseur (Minitaupe) | tk-bw-e | 30 | 0 | 30 |
| fr | BW Kit du dresseur (Zoroark) | tk-bw-z | 30 | 0 | 30 |
| fr | HS Kit du dresseur (Léviator) | tk-hs-g | 30 | 0 | 30 |
| fr | HS Kit du dresseur (Raichu) | tk-hs-r | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Scalproie) | tk-xy-b | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Latias) | tk-xy-latia | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Latios) | tk-xy-latio | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Bruyverne) | tk-xy-n | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Pikachu Libre) | tk-xy-p | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Suicune) | tk-xy-su | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Nymphali) | tk-xy-sy | 30 | 0 | 30 |
| fr | XY Kit du dresseur (Grodoudou) | tk-xy-w | 30 | 0 | 30 |
| fr | EX Forces Cachées Collection Zarbi | exu | 28 | 0 | 28 |
| fr | Wizards Black Star Promos | basep | 26 | 0 | 26 |
| fr | Collection McDonald's 2021 | 2021swsh | 25 | 0 | 25 |
| fr | Promo HGSS | hgssp | 25 | 0 | 25 |
| fr | Écarlate et Violet Énergie | sve | 24 | 0 | 24 |
| fr | Promo Nintendo | np | 21 | 0 | 21 |
| fr | SM Kit du dresseur (Raichu d'Alola) | tk-sm-r | 19 | 0 | 19 |
| fr | Détective Pikachu | det1 | 18 | 18 | 0 |
| fr | SM Kit du dresseur (Lougarox) | tk-sm-l | 18 | 0 | 18 |
| fr | Promo SWSH | swshp | 16 | 16 | 0 |
| fr | Collection McDonald's 2022 | 2022swsh | 15 | 0 | 15 |
| fr | Collection McDonald's 2023 | 2023sv | 15 | 0 | 15 |
| fr | Collection McDonald's 2024 | 2024sv | 15 | 0 | 15 |
| fr | Aquapolis | ecard2 | 14 | 0 | 14 |
| fr | Collection McDonald's 2011 | 2011bw | 12 | 0 | 12 |
| fr | Collection McDonald's 2012 | 2012bw | 12 | 0 | 12 |
| fr | Collection McDonald's 2013 | 2013bw | 12 | 0 | 12 |
| fr | Collection McDonald's 2014 | 2014xy | 12 | 0 | 12 |
| fr | Collection McDonald's 2015 | 2015xy | 12 | 0 | 12 |
| fr | Collection McDonald's 2016 | 2016xy | 12 | 0 | 12 |
| fr | Collection McDonald's 2017 | 2017sm | 12 | 0 | 12 |
| fr | DP Kit dresseur (Manaphy) | tk-dp-m | 12 | 0 | 12 |
| fr | EX Kit dresseur (Négapi) | tk-ex-m | 12 | 0 | 12 |
| fr | EX Kit dresseur (Positi) | tk-ex-p | 12 | 0 | 12 |
| fr | DP Kit dresseur (Lucario) | tk-dp-l | 11 | 0 | 11 |
| fr | EX Kit dresseur (Latias) | tk-ex-latia | 10 | 0 | 10 |
| fr | EX Kit dresseur (Latios) | tk-ex-latio | 10 | 0 | 10 |
| fr | Méga-Évolution Énergie | mee | 8 | 0 | 8 |
| fr | carte alternative A Jaune | xya | 6 | 0 | 6 |
| fr | Fossile | base3 | 2 | 0 | 2 |
| fr | Promo XY | xyp | 2 | 0 | 2 |
| fr | Team Rocket | base5 | 1 | 0 | 1 |
| fr | Pouvoirs Émergents | bw2 | 1 | 0 | 1 |
| fr | Expedition | ecard1 | 1 | 0 | 1 |
| fr | HeartGold SoulSilver | hgss1 | 1 | 1 | 0 |
| fr | Déchaînement | hgss2 | 1 | 0 | 1 |
| fr | Indomptable | hgss3 | 1 | 1 | 0 |
| fr | Triomphant | hgss4 | 1 | 1 | 0 |
| fr | Vainqueurs Suprêmes | pl3 | 1 | 1 | 0 |
| fr | Éclipse Cosmique | sm12 | 1 | 1 | 0 |
| fr | Ultra-Prisme | sm5 | 1 | 1 | 0 |
| fr | Évolutions à Paldea | sv02 | 1 | 1 | 0 |
| fr | Étincelles Déferlantes | sv08 | 1 | 0 | 1 |
| fr | Origine Perdue | swsh11 | 1 | 1 | 0 |
| fr | XY | xy1 | 1 | 1 | 0 |
| ja | スタートデッキ100 バトルコレクション | MC | 774 | 0 | 774 |
| ja | スカーレット&バイオレット プロモカード | SV-P | 288 | 0 | 288 |
| ja | VMAXクライマックス | S8b | 285 | 0 | 285 |
| ja | MEGAドリームex | M2a | 250 | 0 | 250 |
| ja | GXウルトラシャイニー | SM8b | 250 | 0 | 250 |
| ja | TAG TEAM GX タッグオールスターズ | SM12a | 226 | 0 | 226 |
| ja | ブラックボルト | SV11B | 174 | 0 | 174 |
| ja | ホワイトフレア | SV11W | 174 | 0 | 174 |
| ja | ポケモンカード★VS | VS1 | 143 | 0 | 143 |
| ja | メガ プロモカード | M-P | 132 | 0 | 132 |
| ja | フュージョンアーツ | S8 | 129 | 0 | 129 |
| ja | 基本拡張パック | E1 | 128 | 0 | 128 |
| ja | GXバトルブースト | SM4p | 125 | 0 | 125 |
| ja | ニンジャスピナー | M4 | 120 | 0 | 120 |
| ja | アビスアイ | M5 | 118 | 0 | 118 |
| ja | タッグボルト | SM9 | 118 | 0 | 118 |
| ja | ムニキスゼロ | M3 | 117 | 0 | 117 |
| ja | オルタージェネシス | SM12 | 117 | 0 | 117 |
| ja | インフェルノX | M2 | 116 | 0 | 116 |
| ja | ダブルブレイズ | SM10 | 116 | 0 | 116 |
| ja | ミラクルツイン | SM11 | 115 | 0 | 115 |
| ja | ストームエメラルダ | M6 | 113 | 0 | 113 |
| ja | 闇、そして光へ... | neo4 | 113 | 0 | 113 |
| ja | 裂空のカリスマ | SM7 | 112 | 0 | 112 |
| ja | 超爆インパクト | SM8 | 111 | 0 | 111 |
| ja | 禁断の光 | SM6 | 110 | 0 | 110 |
| ja | 金の空、銀の海 | PCG4 | 106 | 0 | 106 |
| ja | 拡張パック | PMCG1 | 102 | 0 | 102 |
| ja | サイバージャッジ | SV5M | 100 | 0 | 100 |
| ja | 闇からの挑戦 | PMCG6 | 98 | 0 | 98 |
| ja | リーダーズスタジアム | PMCG5 | 96 | 0 | 96 |
| ja | 金、銀、新世界へ... | neo1 | 96 | 0 | 96 |
| ja | 白銀のランス | S6H | 95 | 0 | 95 |
| ja | 漆黒のガイスト | S6K | 95 | 0 | 95 |
| ja | 地図にない町 | E2 | 92 | 0 | 92 |
| ja | メガブレイブ | M1L | 92 | 0 | 92 |
| ja | メガシンフォニア | M1S | 92 | 0 | 92 |
| ja | 裂けた大地 | E4 | 91 | 0 | 91 |
| ja | 神秘なる山 | E5 | 91 | 0 | 91 |
| ja | 一撃マスター | S5I | 91 | 0 | 91 |
| ja | 海からの風 | E3 | 90 | 0 | 90 |
| ja | 摩天パーフェクト | S7D | 90 | 0 | 90 |
| ja | まぼろしの森 | PCG5 | 86 | 0 | 86 |
| ja | ホロンの研究塔 | PCG6 | 86 | 0 | 86 |
| ja | チャンピオンロード | SM6b | 86 | 0 | 86 |
| ja | ロケット団の逆襲 | PCG3 | 85 | 0 | 85 |
| ja | 伝説の飛翔 | PCG1 | 82 | 0 | 82 |
| ja | 蒼空の激突 | PCG2 | 82 | 0 | 82 |
| ja | ひかる伝説 | SM3p | 82 | 0 | 82 |
| ja | リミックスバウト | SM11a | 80 | 0 | 80 |
| ja | ウルトラムーン | SM5M | 78 | 0 | 78 |
| ja | ウルトラサン | SM5S | 78 | 0 | 78 |
| ja | きせきの結晶 | PCG8 | 75 | 0 | 75 |
| ja | ドリームリーグ | SM11b | 75 | 0 | 75 |
| ja | コレクションムーン | SM1M | 73 | 0 | 73 |
| ja | コレクションサン | SM1S | 73 | 0 | 73 |
| ja | 迅雷スパーク | SM7a | 73 | 0 | 73 |
| ja | ナイトユニゾン | SM9a | 70 | 0 | 70 |
| ja | ジージーエンド | SM10a | 69 | 0 | 69 |
| ja | スカイレジェンド | SM10b | 69 | 0 | 69 |
| ja | フルメタルウォール | SM9b | 69 | 0 | 69 |
| ja | さいはての攻防 | PCG9 | 68 | 0 | 68 |
| ja | サン＆ムーン | SM1p | 68 | 0 | 68 |
| ja | ドラゴンストーム | SM6a | 66 | 0 | 66 |
| ja | ロケット団 | PMCG4 | 65 | 0 | 65 |
| ja | 新たなる試練の向こう | SM2p | 65 | 0 | 65 |
| ja | ダークオーダー | SM8a | 65 | 0 | 65 |
| ja | 闘う虹を見たか | SM3H | 64 | 0 | 64 |
| ja | 光を喰らう闇 | SM3N | 64 | 0 | 64 |
| ja | ウルトラフォース | SM5p | 63 | 0 | 63 |
| ja | フェアリーライズ | SM7b | 63 | 0 | 63 |
| ja | アローラの月光 | SM2L | 62 | 0 | 62 |
| ja | 覚醒の勇者 | SM4S | 62 | 0 | 62 |
| ja | キミを待つ島々 | SM2K | 61 | 0 | 61 |
| ja | 超次元の暴獣 | SM4A | 61 | 0 | 61 |
| ja | 遺跡をこえて... | neo2 | 57 | 0 | 57 |
| ja | めざめる伝説 | neo3 | 57 | 0 | 57 |
| ja | ホロンの幻影 | PCG7 | 52 | 0 | 52 |
| ja | ポケモンジャングル | PMCG2 | 48 | 0 | 48 |
| ja | 化石の秘密 | PMCG3 | 48 | 0 | 48 |
| ja | ポケモンカード★web | web1 | 47 | 0 | 47 |
| ja | マグマ団VSアクア団 ダブルクライシス | CP1 | 34 | 0 | 34 |
| ja | ロケット団の栄光 | SV10 | 34 | 0 | 34 |
| ja | 超電ブレイカー | SV8 | 32 | 0 | 32 |
| ja | 伝説キラコレクション | CP2 | 27 | 0 | 27 |
| ja | VSTARユニバース | S12a | 5 | 0 | 5 |
| ja | バトルリージョン | S9a | 1 | 0 | 1 |
| ja | バイオレットex | SV1V | 1 | 0 | 1 |
| ja | トリプレットビート | SV1a | 1 | 0 | 1 |

Le détail carte par carte, les URL vérifiées, la taille des images et leur SHA-256 figurent dans `reference-image-audit.json`.

Reproduction : `python scripts/audit-reference-images.py --cache /chemin/cache`.
