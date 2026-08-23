---
"@plywise/chessboard": minor
"@plywise/chessboard-react": minor
---

Animate position updates: `set({ position })` now reconciles by piece identity, so a piece that changed squares keeps its DOM node and glides through the existing `--pw-animation-duration` (`animationMs: 0` stays instant; newer updates retarget the running transition, captures included).

Add opt-in edge coordinates: `coordinates: true` (default `false`) renders orientation-aware a–h / 1–8 labels, colored by `--pw-coordinate-color` with lichess-style opposite-square parity contrast; the layer never takes pointer events.

Drag affordances: a translucent ghost of the dragged piece stays on its origin square (`.pw-piece-ghost`), and the legal destination under the pointer is highlighted live (`.pw-mark-drag-target`, `data-destination` `empty`/`occupied`). The React adapter forwards a new `coordinates` prop.
