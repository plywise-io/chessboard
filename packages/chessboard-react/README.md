# @plywise/chessboard-react

React lifecycle adapter for `@plywise/chessboard`. The adapter is a thin declarative shell: it creates one core renderer instance, forwards every prop change through that instance, keeps the latest interaction callback available, and destroys the instance on unmount. React never owns individual squares, pieces, or annotation nodes, and pointer movement never triggers a React render.

```sh
npm install @plywise/chessboard @plywise/chessboard-react
```

## Quick start

```tsx
import "@plywise/chessboard/style.css";
import { Chessboard } from "@plywise/chessboard-react";

export function Board({ position, destinations, lastMove }) {
  return (
    <Chessboard
      position={position}
      orientation="white"
      boardLabel="Initial chess position"
      animationMs={150}
      interaction={{ destinations, onEvent }}
      presentation={{ lastMove }}
      annotations={annotations}
      visibleLayers={visibleLayers}
    />
  );
}
```

## Props

- `position: Position` — required, controlled.
- `orientation?: Color` — `"white" | "black"`.
- `boardLabel?: string` — accessible label. Defaults to `"Chessboard"`.
- `animationMs?: number` — non-negative. `0` switches to instant updates.
- `visibleLayers?: ReadonlySet<string>` — omitted shows every layer; empty hides every annotation.
- `pieceSet?: PieceSources | string | null` — controls the piece artwork. Omission renders the vendored Cburnett default; a `PieceSources` object (raw SVG sources for each `wK..bP` code) is served as `data:image/svg+xml` so it never reaches the network; a plain base-URL string points at a directory of `{w|b}{P,N,B,R,Q,K}.svg` files for callers who self-host; `null` restores Unicode glyphs. The adapter forwards `PieceSources`-valued props untouched.
- All other `<div>` props (except `children`) are forwarded to the host element.

## Re-exported types

```ts
import type {
  Annotation, ArrowAnnotation, CircleAnnotation,
  AnnotationGesture, AnnotationModifier,
  JsonValue,
  Color, File, LastMove, Piece, Position, Presentation, Rank, Role,
  Square, Destinations, Interaction, InteractionEvent,
  PieceSources, pieceSets,
  ChessboardConfig, ChessboardUpdate,
} from "@plywise/chessboard-react";
```

## Controlled interaction

```tsx
function Game() {
  const [position, setPosition] = useState(initial);
  const [destinations, setDestinations] = useState(new Map());

  const onEvent = useCallback((event: InteractionEvent) => {
    if (event.type === "select") {
      setDestinations(computeLegalMoves(event.square, position));
    } else if (event.type === "move") {
      const next = applyMove(position, event.from, event.to);
      if (next) setPosition(next);
      setDestinations(new Map());
    } else if (event.type === "circle" || event.type === "arrow") {
      toggleAnnotation(event); // right-button gesture: caller-owned state
    }
  }, [position]);

  return (
    <Chessboard
      position={position}
      interaction={{ destinations, onEvent }}
      presentation={{ selected: [...destinations.keys()][0] }}
    />
  );
}
```

The adapter passes `onEvent` through directly to the core renderer. The core renderer always invokes the most recent callback without recreating the board. Right-button `circle`/`arrow` intents arrive through the same callback; the board suppresses the native context menu while `interaction` is enabled. Right-button gestures accept an optional `interaction.annotationGestures` list that maps modifier combinations to CSS colour strings: the adapter forwards it untouched, the renderer colours both the snapped preview and the emitted `circle`/`arrow` event when a binding matches, snapshots the colour on `pointerdown`, and falls back to the stylesheet default for unmatched combinations. Annotation `id`, `layer`, `metadata`, persistence, and toggle semantics stay with the caller. A `position` prop whose diff is exactly one piece move (identical color and role) is forwarded through the renderer's approved-move operation so the moving piece keeps its DOM node and transform transition; promotions, castling, and multi-piece diffs fall back to full position replacement.

`pieceSet` props of any accepted shape (a `PieceSources` object, a base-URL string, or `null`) are forwarded to the core renderer untouched; the adapter re-exports the `PieceSources` and `pieceSets` types from the core package so React callers can build `PieceSources` values without importing the core directly.

## Accessibility and theming

- Omitting `pieceSet` renders the vendored Cburnett default artwork (BSD-3-Clause, see `packages/chessboard/assets/cburnett/LICENSE.md`); pieces are decorative. `pieceSet` props of any accepted shape (`PieceSources` object, base-URL string, `null`) are forwarded untouched to the core renderer, which serves vendored entries as `data:image/svg+xml` URIs so default rendering is network-free. Catalog licenses and per-file SHA-1 provenance live in `packages/chessboard/assets/SETS.md`.
- Keyboard interaction is not implemented by the adapter or the core renderer; an accessible interactive board must be built above them.
- Override the documented CSS custom properties (`--pw-light-square`, `--pw-selected-color`, ...) on `.pw-board` for theming.

## Support

Supports React 18 and 19 as peer dependencies. ESM-only. TypeScript declarations are included. The stylesheet `@plywise/chessboard/style.css` is opt-in. See the [repository README](https://github.com/plywise-io/chessboard#readme) for architecture and development commands.
