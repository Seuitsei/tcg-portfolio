# Third-party notices

## OpenCV / OpenCV.js

Bundled unmodified runtime: `@techstark/opencv-js@4.10.0-release.1`, retrieved from
https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js .
OpenCV is Apache-2.0 (4.5+). The TechStark wrapper is Apache-2.0.
Complete notices: [OpenCV](scanner/vendor/OPENCV-LICENSE.txt), [wrapper](scanner/vendor/OPENCV-JS-LICENSE.txt).
No change to the vendor runtime; original copyright and license notices are preserved.

## PK Scan

The normalised RGB block descriptor concept was informed by JeremyMCastillo/pk-scan,
commit d5a25ad09499a69db9edcc288e5273159ce3b10d. This implementation uses two regions
and independent OpenCV code. PK Scan's published license is MIT, carrying the
copyright notice “2015-present 650 Industries, Inc. (aka Expo)”. Its original
[license](scanner/vendor/PK-SCAN-LICENSE.txt) is preserved without rewriting authorship.

## TCGdex

Metadata and reference image URLs: https://tcgdex.net / https://tcgdex.dev .
Database repository: https://github.com/tcgdex/cards-database , MIT.
Complete [database license](scanner/vendor/TCGDEX-LICENSE.txt).
The MIT database license does not grant ownership of Pokémon artwork or trademarks.
The generated visual descriptors refer to that catalogue; source images are not
bundled in this repository. The metadata and packs were built on 2026-10-07.

## Pokémon TCG API / Pokémon TCG Data

Historical Classic Collection metadata and image references are sourced from
https://github.com/PokemonTCG/pokemon-tcg-data/blob/master/cards/en/cel25c.json .
Only explicit metadata crosswalks and derived image features are included. No
source code from this repository is copied or relicensed. The historical API is
not a runtime identification service in this app. Its announced deprecation is
documented in `docs/RESEARCH.md`.

## Artwork and reference apps

Pokémon and card artwork remain the property of their respective rights holders,
including Nintendo, Creatures and GAME FREAK / The Pokémon Company. This is an
independent identification/collection project, not endorsed by those companies.
PokéItem and PokéManager were inspected only as supplied reference applications.
No APK, proprietary source, private API credential, model or native library from
those applications is incorporated or published.
