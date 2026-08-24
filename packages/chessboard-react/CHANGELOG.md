# @plywise/chessboard-react

## 0.2.1

### Patch Changes

- adb32a2: Batch companion updates with a single-piece move, reconcile board marks once per update, and skip unchanged annotation DOM writes. Add WebKit-safe text-selection handling and a configurable cubic move easing.
- Updated dependencies [adb32a2]
  - @plywise/chessboard@0.3.2

## 0.2.0

### Minor Changes

- 25a3dae: Animate position updates: `set({ position })` now reconciles by piece identity, so a piece that changed squares keeps its DOM node and glides through the existing `--pw-animation-duration` (`animationMs: 0` stays instant; newer updates retarget the running transition, captures included).
  
  Add opt-in edge coordinates: `coordinates: true` (default `false`) renders orientation-aware a–h / 1–8 labels, colored by `--pw-coordinate-color` with lichess-style opposite-square parity contrast; the layer never takes pointer events.
  
  Drag affordances: a translucent ghost of the dragged piece stays on its origin square (`.pw-piece-ghost`), and the legal destination under the pointer is highlighted live (`.pw-mark-drag-target`, `data-destination` `empty`/`occupied`). The React adapter forwards a new `coordinates` prop.

### Patch Changes

- Updated dependencies [25a3dae]
  - @plywise/chessboard@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [9aae4af]
  - @plywise/chessboard@0.2.0
