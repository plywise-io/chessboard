---
"@plywise/chessboard": minor
"@plywise/chessboard-react": minor
---

Add configurable SVG piece sets and board themes.

`@plywise/chessboard` accepts a `pieceSet` base URL (a directory of `{w|b}{P,N,B,R,Q,K}.svg` files) and renders pieces as images instead of Unicode glyphs; `null` restores glyphs. A `theme` (`{ light?, dark? }`) overrides square colors through the existing `--pw-light-square`/`--pw-dark-square` variables, and `null` restores the stylesheet defaults. Both are validated at the boundary and updatable through `set`. The package now exports curated presets with permissive licenses only: `pieceSets` (rhosgfx under CC0-1.0, chessnut under Apache-2.0 pinned to an upstream commit, and fantasy/spatial/celtic under MIT artwork by Maurizio Monge, served via jsDelivr) and `boardThemes` (brown, blue, green).

`@plywise/chessboard-react` forwards the same values as `pieceSet` and `theme` props, re-exports `BoardTheme`, and re-exports the `pieceSets` and `boardThemes` presets.
