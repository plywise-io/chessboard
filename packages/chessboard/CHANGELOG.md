# @plywise/chessboard

## 0.2.0

### Minor Changes

- 9aae4af: Add `cburnett` to the `pieceSets` catalog: the vendored default artwork is now also selectable as a named preset alongside rhosgfx, kiwenSuwi, chessnut, spatial, and celtic. Omitting `pieceSet` keeps rendering the same Cburnett artwork; the separate internal default module is gone (one embedded copy instead of two).
  
  Ship the vendoring attribution inside the package: `assets/SETS.md` and `assets/cburnett/LICENSE.md` are now included in the published tarball.
  
  Slim the shipped TypeScript declarations by widening embedded SVG source values from inferred template-literal types to `string`; the generated-set declaration output shrinks from ~150 KB to under 2 KB.
