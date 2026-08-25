# @plywise/chessboard

## 0.3.2

### Patch Changes

- adb32a2: Batch companion updates with a single-piece move, reconcile board marks once per update, and skip unchanged annotation DOM writes. Add WebKit-safe text-selection handling and a configurable cubic move easing.
- Fix initial piece transitions, honor reduced-motion preferences, improve coordinate-label contrast, and make unused piece sets tree-shakeable.

## 0.3.1

### Patch Changes

- 78a6534: Fix drag selection and jank on WebKitGTK: add `-webkit-user-select: none` (WebKitGTK 2.52 implements only the prefixed property) and drop the decorative `filter: drop-shadow` from the dragging state, which forced software painting of pointer-following transforms.

## 0.3.0

### Minor Changes

- 25a3dae: Animate position updates: `set({ position })` now reconciles by piece identity, so a piece that changed squares keeps its DOM node and glides through the existing `--pw-animation-duration` (`animationMs: 0` stays instant; newer updates retarget the running transition, captures included).
  
  Add opt-in edge coordinates: `coordinates: true` (default `false`) renders orientation-aware a–h / 1–8 labels, colored by `--pw-coordinate-color` with lichess-style opposite-square parity contrast; the layer never takes pointer events.
  
  Drag affordances: a translucent ghost of the dragged piece stays on its origin square (`.pw-piece-ghost`), and the legal destination under the pointer is highlighted live (`.pw-mark-drag-target`, `data-destination` `empty`/`occupied`). The React adapter forwards a new `coordinates` prop.

## 0.2.0

### Minor Changes

- 9aae4af: Add `cburnett` to the `pieceSets` catalog: the vendored default artwork is now also selectable as a named preset alongside rhosgfx, kiwenSuwi, chessnut, spatial, and celtic. Omitting `pieceSet` keeps rendering the same Cburnett artwork; the separate internal default module is gone (one embedded copy instead of two).
  
  Ship the vendoring attribution inside the package: `assets/SETS.md` and `assets/cburnett/LICENSE.md` are now included in the published tarball.
  
  Slim the shipped TypeScript declarations by widening embedded SVG source values from inferred template-literal types to `string`; the generated-set declaration output shrinks from ~150 KB to under 2 KB.
