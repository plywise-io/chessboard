---
"@plywise/chessboard": minor
"@plywise/chessboard-react": minor
---

Add controlled interaction, presentation marks, layered annotations, and semantic attributes.

`@plywise/chessboard` now exposes one optional `interaction` (`{ destinations, onEvent } | null`), one `presentation` value (`{ selected?, lastMove?, checked? }`), `annotations` (a keyed `Annotation[]` of arrows and circles with opaque JSON-compatible `metadata`), and `visibleLayers` (a `ReadonlySet<string>`; omitted shows every layer, empty hides every annotation). A single structured `InteractionEvent` callback reports square selection, selection clearing, and move intentions with `selection` or `drag` origin. Pointer Events convert client coordinates into squares using the current board rectangle and orientation; selection, last move, and check marks appear without allocating 64 square nodes, and stable `data-mark`, `data-destination`, `data-annotation-id`, `data-annotation-kind`, and `data-annotation-layer` attributes expose rendered state for tests and constrained adapters. CSS custom properties (`--pw-selected-color`, `--pw-destination-color`, `--pw-capture-color`, `--pw-last-move-color`, `--pw-check-color`) theme the marks. Caller collections are copied at the seam, invalid public input throws `TypeError`, lifecycle misuse after `destroy` throws `Error`, and `destroy` remains idempotent. The internal `BoardSnapshot` and `BoardCommand` types stay private.

`@plywise/chessboard-react` exposes the same values as props (`interaction`, `presentation`, `annotations`, `visibleLayers`), re-exports the public domain types (`Annotation`, `ArrowAnnotation`, `CircleAnnotation`, `JsonValue`, `Interaction`, `InteractionEvent`, `Presentation`, `LastMove`, `Destinations`, `ChessboardConfig`, `ChessboardUpdate`), keeps a single core renderer instance across prop updates, and never triggers a React render during pointer movement.
