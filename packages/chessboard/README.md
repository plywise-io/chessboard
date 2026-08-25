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

### Domain types

```ts
import type {
  Color, File, Rank, Role, Square, Piece, Position,
  Annotation, ArrowAnnotation, CircleAnnotation,
  AnnotationGesture, AnnotationModifier,
  JsonValue,
  ChessboardConfig, ChessboardUpdate, Chessboard,
  Destinations, Interaction, InteractionEvent, Presentation, LastMove,
  PieceSources, pieceSets,
} from "@plywise/chessboard";

```

- `Color`: `"white" | "black"`.
- `File`, `Rank`: file letter and rank digit of an algebraic square.
- `Square`: `${File}${Rank}`, e.g. `"e4"`.
- `Role`: `"pawn" | "knight" | "bishop" | "rook" | "queen" | "king"`.
- `Piece`: `{ readonly color: Color; readonly role: Role }`.
- `Position`: `ReadonlyMap<Square, Piece>`. The renderer validates and copies it at the seam.
- `PieceSources`: `{ readonly wK: string; readonly wQ: string; readonly wR: string; readonly wB: string; readonly wN: string; readonly wP: string; readonly bK: string; readonly bQ: string; readonly bR: string; readonly bB: string; readonly bN: string; readonly bP: string }`. Each key is a non-empty raw SVG source string; the renderer serves the entries as `data:image/svg+xml` URIs.
- `pieceSets`: `{ readonly cburnett: PieceSources; readonly rhosgfx: PieceSources; readonly kiwenSuwi: PieceSources; readonly chessnut: PieceSources; readonly spatial: PieceSources; readonly celtic: PieceSources }`. Curated raw-SVG catalogs vendored into the package; no network fetch is ever performed.
- `AnnotationModifier`: `"alt" | "ctrl" | "meta" | "shift"`. `meta` matches the Command key on macOS keyboards.
- `AnnotationGesture`: `{ readonly modifiers?: readonly AnnotationModifier[]; readonly color?: string }`. A caller-supplied binding from modifier set to CSS colour string.

### Configuration and updates

- `ChessboardConfig`: `{ position, orientation?, ariaLabel?, animationMs?, coordinates?, pieceSet?, theme?, interaction?, presentation?, annotations?, visibleLayers? }`.
- `ChessboardUpdate`: `{ position?, orientation?, ariaLabel?, animationMs?, coordinates?, pieceSet?, theme?, interaction?, presentation?, annotations?, visibleLayers? }`. Every field is optional; omitted fields are left unchanged. `interaction: null` disables interaction and clears transient pointer state.

### Piece sets (`pieceSet`)

`pieceSet` is optional. Omission renders the vendored Cburnett default artwork (BSD-3-Clause, see `assets/cburnett/LICENSE.md`). The accepted types are:

- `PieceSources`: an object with `wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP` — each key is a non-empty raw SVG source string. The renderer serves them as `data:image/svg+xml` URIs and never reaches the network. The curated entries in `pieceSets` (`cburnett`, `rhosgfx`, `kiwenSuwi`, `chessnut`, `spatial`, `celtic`) are this shape — vendored raw SVG sources embedded in the bundle.
- `string`: a base URL pointing at a directory that holds `{w|b}{P,N,B,R,Q,K}.svg` files. Useful for callers who self-host their own artwork; the renderer fetches each file at render time.
- `null`: restores Unicode glyphs and involves no asset license.

Bundled catalogs: `cburnett` is Cburnett artwork under its BSD-3-Clause option (see `assets/cburnett/LICENSE.md`); `rhosgfx` is CC0; `kiwenSuwi` is CC BY 4.0 (attribution required); `chessnut` is Apache-2.0; `spatial` and `celtic` are MIT by Maurizio Monge. Per-file SHA-1 provenance and upstream links live in `assets/SETS.md`.

### Interaction

interface Interaction {
  readonly destinations: ReadonlyMap<Square, readonly Square[]>;
  readonly onEvent: (event: InteractionEvent) => void;
  readonly annotationGestures?: readonly AnnotationGesture[];
}
```

`InteractionEvent` is a discriminated union:

- `{ type: "select", square: Square, origin: "pointer" }`
- `{ type: "clear", origin: "pointer" }`
- `{ type: "move", from: Square, to: Square, origin: "selection" | "drag" }`
- `{ type: "circle", square: Square, origin: "pointer", color?: string }`
- `{ type: "arrow", from: Square, to: Square, origin: "pointer", color?: string }`
While `interaction` is enabled, right-button gestures report annotation intents instead of moving pieces: pressing and releasing the right button on one square emits a `circle` intent, and right-dragging between two squares emits an `arrow` intent. A translucent snapped preview is shown during the gesture and the native context menu is suppressed. These are requests only — the caller decides whether to add, remove, or ignore the corresponding annotation in its own state. Spectator boards (`interaction: null` or omitted) keep the native context menu and emit nothing.

During a drag the renderer shows two transient affordances: a translucent ghost of the piece stays on its origin square (`.pw-piece-ghost`), and the legal destination under the pointer is highlighted (`.pw-mark-drag-target`, with `data-destination` `empty`/`occupied`, styled by `--pw-destination-color`/`--pw-capture-color`). Both are removed on release; neither is part of controlled state.

#### Modifier-coloured annotation gestures

`interaction.annotationGestures` is an optional list of caller-supplied bindings from a modifier combination to a CSS colour string. The colour is applied to the snapped preview and to the `circle`/`arrow` event for the duration of the gesture:

```ts
const board = createChessboard(element, {
  position,
  interaction: {
    destinations,
    onEvent,
    annotationGestures: [
      { modifiers: [], color: "#15781B" },
      { modifiers: ["shift"], color: "#dc322f" },
      { modifiers: ["alt", "ctrl"], color: "rgba(20, 85, 180, 0.9)" },
    ],
  },
});
```

- `color` is a CSS colour string. The renderer applies it through the existing annotation `color` path; there is no bundled palette, enum, or extra dependency.
- `meta` matches the Command key on macOS keyboards (the same key that surfaces as `Meta` in `PointerEvent` and `KeyboardEvent`).
- Bindings use exact sets. `{ modifiers: ["shift"], ... }` matches only when exactly shift is pressed; it does not match `ctrl`+`shift`. `modifiers` omitted or `[]` means "no modifiers pressed" (the unmodified right-button gesture).
- Supported modifier names are exactly `"alt"`, `"ctrl"`, `"meta"`, and `"shift"`. Each binding's `modifiers` list must not repeat a name; binding sets must be unique after sorting.
- The colour is snapshotted on `pointerdown`. The preview and the emitted `circle`/`arrow` event retain it even if the modifier state changes before `pointerup`.
- Right-button gestures remain enabled whenever `interaction` is set. A modifier combination without a matching binding still emits the existing `circle`/`arrow` intent using the stylesheet-default preview colour (`--pw-annotation-color`). The event object keeps its original shape with no extra `color` property.
- The renderer never owns annotation state: the binding only chooses a colour. Annotation `id`, `layer`, `metadata`, persistence, and toggle semantics stay with the caller.

`annotationGestures` is validated and copied at the boundary: it must be an array; each entry is an object; `modifiers`, when present, only contains the allowed names without duplicates; `color`, when present, is a string; the normalised binding set (sorted modifiers) must not appear twice. Invalid `annotationGestures` throw `TypeError`.

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

- `set(update: ChessboardUpdate): void` — forwards every optional field, including `pieceSet` (`PieceSources` object, base-URL string, or `null`) and `theme`. Omitted means unchanged. Pass `null` to either option to restore Unicode glyphs / stylesheet square colors.
- `move(from: Square, to: Square): void` — caller-approved single-piece move. Reuses the moving DOM node; removes only the captured node.
- `destroy(): void` — idempotent; safe to call repeatedly.

## Validation

Every public input is validated at the boundary. Bad `pieceSet` values throw `TypeError` with one of:
- `pieceSet must be a non-empty URL string, a PieceSources object, or null`
- `pieceSet has unknown piece code: <key>`
- `pieceSet.<code> must be a non-empty SVG source string`

- invalid squares, pieces, colors, orientations, animation durations, interaction inputs (including malformed `annotationGestures`), presentation inputs, annotations, and layer visibility values throw `TypeError`;
- `set` or `move` after `destroy` throw `Error`;
- caller collections are copied so later external mutation cannot silently alter rendered state.

## Semantic attributes

Stable, read-only `data-*` hooks:

- Pieces: `data-square`, `data-color`, `data-role`.
- Marks: `data-mark` and `data-square`; mark values are `selected`, `destination`, `last-move-from`, `last-move-to`, or `check`.
- Destinations: `data-destination` on destination marks and on the drag hover highlight (`.pw-mark-drag-target`), with values `empty` or `occupied`.
- Coordinates: `.pw-coordinate-file[data-file]` and `.pw-coordinate-rank[data-rank]` carry `data-parity` (`light`/`dark`) of the square they sit on. The layer never takes pointer events.

These are observability hooks for tests, browser automation, and constrained adapters. They are not a mutation interface.

## Theming

Override the CSS custom properties on `.pw-board` to theme squares, marks, and animation:

```css
.pw-board {
  --pw-light-square: #f0d9b5;
  --pw-dark-square: #b58863;
  --pw-animation-duration: 150ms;
  /* --pw-animation-easing: cubic-bezier(0.65, 0, 0.35, 1); */
  /* --pw-coordinate-color: #1f1f1f; override both parities */
  /* --pw-coordinate-on-light: #1f1f1f; custom theme light-square label */
  /* --pw-coordinate-on-dark: #1f1f1f; custom theme dark-square label */
  --pw-selected-color: rgba(20, 85, 30, 0.45);
  --pw-destination-color: rgba(20, 85, 30, 0.30);
  --pw-capture-color: rgba(150, 30, 30, 0.40);
  --pw-last-move-color: rgba(255, 220, 90, 0.45);
  --pw-check-color: rgba(220, 50, 50, 0.55);
  --pw-annotation-color: rgba(20, 85, 180, 0.90);
}
```

`coordinates: true` renders a–h / 1–8 edge labels that follow the orientation; `coordinates: false` (the default) renders none. Default labels use contrasting colors for the built-in board. Custom themes can set `--pw-coordinate-on-light` and `--pw-coordinate-on-dark` independently; `--pw-coordinate-color` overrides both parities.

`animationMs: 0` switches to instant updates. A newer approved move or position update retargets the active transition; transitions are not queued. Position updates reconcile by piece identity, so a piece that changed squares keeps its DOM node and glides; a captured piece disappears when the mover arrives.

## Accessibility

The renderer exposes the board as one labelled image. `ariaLabel` customizes that label. Default piece glyphs and annotation shapes are decorative and hidden from assistive technology. The package does not implement keyboard interaction and does not claim a fully accessible interactive-board experience.

## Lifecycle

- `createChessboard` mounts the DOM subtree under `host` and returns the controller.
- `set` is the path for arbitrary replacement and every controlled state update.
- `move` is the path for a caller-approved single-piece move.
- `destroy` removes the DOM subtree, clears internal state, and is safe to call repeatedly.

ESM-only. TypeScript declarations are included. The stylesheet is opt-in through `@plywise/chessboard/style.css`. See the [repository README](https://github.com/plywise-io/chessboard#readme) for architecture, responsibility boundary, and development commands.
