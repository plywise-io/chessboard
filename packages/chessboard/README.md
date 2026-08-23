# @plywise/chessboard

Framework-agnostic, dependency-free DOM renderer for chess positions. The caller owns chess rules, move legality, FEN/PGN parsing, game state, and annotation semantics. The renderer exposes a controlled interactive surface: it draws positions, marks, and annotations; converts pointer coordinates into squares; and reports intentions; it never accepts a move on the caller's behalf.

```sh
npm install @plywise/chessboard
```

## Quick start

```ts
import { createChessboard } from "@plywise/chessboard";
import "@plywise/chessboard/style.css";

const position = new Map([
  ["e1", { color: "white", role: "king" }],
  ["e8", { color: "black", role: "king" }],
]);

const board = createChessboard(element, {
  position,
  interaction: {
    destinations: new Map([["e1", ["e2"]]]),
    onEvent: (event) => {
      if (event.type === "move") board.move(event.from, event.to);
    },
  },
});

board.destroy();
```

## Public surface

```ts
import type {
  Color, File, Rank, Role, Square, Piece, Position,
  Annotation, ArrowAnnotation, CircleAnnotation, JsonValue,
  ChessboardConfig, ChessboardUpdate, Chessboard,
  Destinations, Interaction, InteractionEvent, Presentation, LastMove,
} from "@plywise/chessboard";
```

### Domain types

- `Color`: `"white" | "black"`.
- `File`, `Rank`: file letter and rank digit of an algebraic square.
- `Square`: `${File}${Rank}`, e.g. `"e4"`.
- `Role`: `"pawn" | "knight" | "bishop" | "rook" | "queen" | "king"`.
- `Piece`: `{ readonly color: Color; readonly role: Role }`.
- `Position`: `ReadonlyMap<Square, Piece>`. The renderer validates and copies it at the seam.

### Configuration and updates

- `ChessboardConfig`: `{ position, orientation?, ariaLabel?, animationMs?, interaction?, presentation?, annotations?, visibleLayers? }`.
- `ChessboardUpdate`: `{ position?, orientation?, ariaLabel?, animationMs?, interaction?, presentation?, annotations?, visibleLayers? }`. Every field is optional; omitted fields are left unchanged. `interaction: null` disables interaction and clears transient pointer state.

### Interaction

```ts
interface Interaction {
  readonly destinations: ReadonlyMap<Square, readonly Square[]>;
  readonly onEvent: (event: InteractionEvent) => void;
}
```

`InteractionEvent` is a discriminated union:

- `{ type: "select", square: Square, origin: "pointer" }`
- `{ type: "clear", origin: "pointer" }`
- `{ type: "move", from: Square, to: Square, origin: "selection" | "drag" }`
- `{ type: "circle", square: Square, origin: "pointer" }`
- `{ type: "arrow", from: Square, to: Square, origin: "pointer" }`

A source absent from `destinations` is not selectable. An empty destination collection still identifies a selectable source. A pointer press must travel a few pixels before it becomes a drag; jitter-sized movement inside a click never lifts the piece.

While `interaction` is enabled, right-button gestures report annotation intents instead of moving pieces: pressing and releasing the right button on one square emits a `circle` intent, and right-dragging between two squares emits an `arrow` intent. A translucent snapped preview is shown during the gesture and the native context menu is suppressed. These are requests only — the caller decides whether to add, remove, or ignore the corresponding annotation in its own state. Spectator boards (`interaction: null` or omitted) keep the native context menu and emit nothing.

### Presentation

```ts
interface Presentation {
  readonly selected?: Square;
  readonly lastMove?: LastMove;
  readonly checked?: Square;
}

interface LastMove {
  readonly from: Square;
  readonly to: Square;
}
```

Presentation values are display state only. The renderer never infers legality or game status from them.

### Annotations and layers

```ts
type Annotation =
  | { id: string; kind: "arrow"; from: Square; to: Square; layer: string; color?: string; metadata?: JsonValue }
  | { id: string; kind: "circle"; square: Square; layer: string; color?: string; metadata?: JsonValue };

// Layer names are opaque strings.

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | readonly JsonValue[];
```

- `annotations` is the full keyed collection. Identifiers must be unique.
- `metadata` is recursively JSON-compatible and opaque to the renderer.
- `visibleLayers` is a `ReadonlySet<string>`. Omitted means "show every layer"; an empty set hides every annotation. Pass `null` in `set` to reset visibility to every layer.

### Instance

`createChessboard(host: HTMLElement, config: ChessboardConfig): Chessboard` returns a controller exposing:

- `set(update: ChessboardUpdate): void` — forwards every optional field. Omitted means unchanged.
- `move(from: Square, to: Square): void` — caller-approved single-piece move. Reuses the moving DOM node; removes only the captured node.
- `destroy(): void` — idempotent; safe to call repeatedly.

## Validation

Every public input is validated at the boundary:

- invalid squares, pieces, colors, orientations, animation durations, interaction inputs, presentation inputs, annotations, and layer visibility values throw `TypeError`;
- `set` or `move` after `destroy` throw `Error`;
- caller collections are copied so later external mutation cannot silently alter rendered state.

## Semantic attributes

Stable, read-only `data-*` hooks:

- Pieces: `data-square`, `data-color`, `data-role`.
- Marks: `data-mark` and `data-square`; mark values are `selected`, `destination`, `last-move-from`, `last-move-to`, or `check`.
- Destinations: `data-destination` on destination marks, with values `empty` or `occupied`.
- Annotations: `data-annotation-id`, `data-annotation-kind`, `data-annotation-layer`.

These are observability hooks for tests, browser automation, and constrained adapters. They are not a mutation interface.

## Theming

Override the CSS custom properties on `.pw-board` to theme squares, marks, and animation:

```css
.pw-board {
  --pw-light-square: #f0d9b5;
  --pw-dark-square: #b58863;
  --pw-animation-duration: 150ms;
  --pw-selected-color: rgba(20, 85, 30, 0.45);
  --pw-destination-color: rgba(20, 85, 30, 0.30);
  --pw-capture-color: rgba(150, 30, 30, 0.40);
  --pw-last-move-color: rgba(255, 220, 90, 0.45);
  --pw-check-color: rgba(220, 50, 50, 0.55);
  --pw-annotation-color: rgba(20, 85, 180, 0.90);
}
```

`animationMs: 0` switches to instant updates. A newer approved move or position update retargets the active transition; transitions are not queued.

## Accessibility

The renderer exposes the board as one labelled image. `ariaLabel` customizes that label. Default piece glyphs and annotation shapes are decorative and hidden from assistive technology. The package does not implement keyboard interaction and does not claim a fully accessible interactive-board experience.

## Lifecycle

- `createChessboard` mounts the DOM subtree under `host` and returns the controller.
- `set` is the path for arbitrary replacement and every controlled state update.
- `move` is the path for a caller-approved single-piece move.
- `destroy` removes the DOM subtree, clears internal state, and is safe to call repeatedly.

ESM-only. TypeScript declarations are included. The stylesheet is opt-in through `@plywise/chessboard/style.css`. See the [repository README](https://github.com/plywise-io/chessboard#readme) for architecture, responsibility boundary, and development commands.
