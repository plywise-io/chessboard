# Plywise Chessboard

A framework-agnostic, dependency-free chessboard renderer with a small React adapter. The renderer owns DOM updates and exposes a controlled interactive surface; the caller owns chess rules, FEN/PGN parsing, move legality, game state, and annotation semantics.

## Packages

- `@plywise/chessboard`: DOM renderer and its TypeScript interface. Zero runtime dependencies.
- `@plywise/chessboard-react`: lifecycle adapter for React 18 and 19.

The renderer owns its DOM subtree. React supplies positions, marks, annotations, layer visibility, and interaction policy through props; it never owns individual squares, pieces, or annotation nodes.

## Architecture

```text
packages/
  chessboard/        framework-agnostic renderer
  chessboard-react/  React lifecycle adapter
examples/
  react/             browser example and Playwright smoke consumer
```

## Responsibility boundary

The renderer is intentionally narrow. It does not implement any of the following; the caller must:

- parse FEN, PGN, or any other position serialisation;
- know chess rules, compute legal destinations, or detect check, checkmate, stalemate, repetition, draws, time forfeit, or clocks;
- track game trees, move numbering, turns, premoves, or ghost pieces;
- interpret annotation metadata (engine source, evaluation, confidence, training concept, assistant explanation, opening reference, debug flag);
- accept or reject moves on the renderer's behalf.

What the renderer does:

- render a caller-supplied `Position` in white or black orientation;
- convert pointer coordinates into squares using the current board rectangle and orientation;
- expose a single structured event callback for selection changes and move intentions;
- draw caller-supplied selection, destination, last-move, and check marks without allocating 64 square nodes;
- reconcile keyed arrow and circle annotations by stable identifier;
- theme the board, pieces, marks, and annotation colors through documented CSS custom properties;
- follow its host element's geometry responsively without a resize callback;
- preserve the moving DOM node across caller-approved moves and capture only the captured node;
- remain JSON-compatible internally (`BoardSnapshot`/`BoardCommand`) so a future constrained adapter can describe state without scraping pixels or DOM, without exposing either type publicly today.

## Usage

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
    destinations: new Map([
      ["e1", ["e2"]],
    ]),
    onEvent: (event) => {
      if (event.type === "move") {
        // Decide whether to accept. Reject by doing nothing.
        if (legal(event.from, event.to)) board.move(event.from, event.to);
      }
    },
  },
});

board.set({ orientation: "black" });
board.destroy();
```

```tsx
import "@plywise/chessboard/style.css";
import { Chessboard } from "@plywise/chessboard-react";

export function Board({ position, onMove, lastMove }) {
  return (
    <Chessboard
      position={position}
      interaction={{
        destinations,
        onEvent: onMove,
      }}
      presentation={{ lastMove, checked }}
      annotations={annotations}
      visibleLayers={visibleLayers}
    />
  );
}
```

## Controlled interaction model

The renderer never accepts a move on the caller's behalf. Pointer gestures express an **intention**; only the caller's subsequent `move` or `set({ position })` mutates authoritative state.

- Pointer Events are the only input source. Mouse, touch, and pen share one path through `setPointerCapture`.
- Selecting a square whose source is in `interaction.destinations` emits `{ type: "select", square, origin: "pointer" }`.
- Selecting the active source again, a non-source square, or an empty area outside the board emits `{ type: "clear", origin: "pointer" }`.
- Selecting a destination square for the active source emits `{ type: "move", from, to, origin: "selection" }`.
- Pressing a piece, dragging across squares, and releasing on a destination emits `{ type: "move", from, to, origin: "drag" }`.
- Drops on the source, outside the board, on a square not in `destinations`, after cancellation, or with a non-primary pointer emit no event and restore the controlled position.
- Passing `interaction: null` to `set` disables interaction on update and clears transient pointer state.

The caller controls whether a move is applied. The renderer never optimistically mutates the position.

## Presentation marks

Presentation state is controlled and display-only:

```ts
board.set({
  presentation: {
    selected: "e1",
    lastMove: { from: "e2", to: "e4" },
    checked: "e8",
  },
});
```

- `selected` is the highlighted source square.
- `lastMove` marks its `from` and `to` squares so the caller can show the most recent move without rendering extra pieces.
- `checked` marks the square of the king currently in check.
- `destinations` (inside `interaction`) marks the legal targets for each selectable source; occupied and empty destinations are distinguished in the rendered state so CSS can style captures differently from quiet moves.

The renderer validates every supplied square. Presentation values never imply legality or game status.

## Annotations, layers, and metadata

Annotations are a keyed collection of arrows and circles:

```ts
board.set({
  annotations: [
    { id: "best", kind: "arrow", from: "d5", to: "e7", layer: "engine", color: "#15781B" },
    { id: "weak", kind: "circle", square: "f6", layer: "user", color: "#dc322f" },
  ],
  visibleLayers: new Set(["user", "engine"]),
});
```

- Every annotation carries a unique stable `id`, a `kind`, geometry in domain squares, a caller-defined `layer`, an optional `color`, and optional recursively JSON-compatible `metadata`.
- Annotation metadata is opaque to the renderer. Names like `engine`, `assistant`, `opening`, `training`, and `debug` carry no renderer semantics.
- `visibleLayers` controls which layers are drawn. Hidden layers remain in caller state but are absent from the rendered layer.
- Omitting `visibleLayers` shows every layer; an empty set hides every annotation. Core updates accept `null` to reset visibility to every layer.
- The renderer reconciles annotations by `id`. Adding, changing, hiding, or removing one annotation preserves unaffected nodes; orientation changes recompute geometry without recreating annotation nodes.

## Modifier-coloured annotation gestures

Right-button gestures may carry optional, caller-configured modifier bindings. Each binding in `interaction.annotationGestures` resolves a pressed modifier combination to a CSS colour string used for both the snapped preview and the emitted event:

```ts
interface Interaction {
  readonly destinations: ReadonlyMap<Square, readonly Square[]>;
  readonly onEvent: (event: InteractionEvent) => void;
  readonly annotationGestures?: readonly AnnotationGesture[];
}

type AnnotationModifier = "alt" | "ctrl" | "meta" | "shift";

interface AnnotationGesture {
  readonly modifiers?: readonly AnnotationModifier[];
  readonly color?: string;
}
```

- `color` is a CSS colour string. The renderer applies it through the existing annotation `color` path; there is no bundled palette, enum, or extra dependency.
- `meta` matches Command on macOS keyboards (the same key that surfaces as `Meta` in `PointerEvent` and `KeyboardEvent`).
- Bindings use exact sets. `modifiers: ["shift"]` matches only a right-button gesture whose pressed modifiers are exactly shift; it does not match `ctrl`+`shift`. `modifiers` omitted or empty means "no modifiers pressed" (the unmodified right-button gesture).
- Supported modifier names are exactly `"alt"`, `"ctrl"`, `"meta"`, and `"shift"`. Each binding's `modifiers` list must not repeat a name.
- The colour is snapshotted on `pointerdown`. The preview and the emitted `circle`/`arrow` event retain it even if the modifier state changes before `pointerup`.
- Right-button gestures remain enabled whenever `interaction` is set. A modifier combination without a matching binding still emits the existing `circle`/`arrow` intent using the stylesheet-default preview colour (`--pw-annotation-color`).
- The renderer never owns annotation state: the binding only chooses a colour. Annotation `id`, `layer`, `metadata`, persistence, and toggle semantics stay with the caller.

`CircleEvent` and `ArrowEvent` gain an optional `color?: string`. The property is included at runtime only when a configured binding resolves to a colour; events for unmodified gestures and bindings without a `color` retain their original shape with no extra field.

## Semantic attributes

Every observable state has a stable, read-only `data-*` attribute for tests, browser automation, and constrained adapters. They are observability hooks, not a mutation interface.

- Pieces: `data-square`, `data-color`, `data-role` on each `.pw-piece` node.
- Marks: `data-mark` and `data-square`; mark values are `selected`, `destination`, `last-move-from`, `last-move-to`, or `check`.
- Destinations: `data-destination` on destination marks, with values `empty` or `occupied`.
- Annotations: `data-annotation-id`, `data-annotation-kind`, and `data-annotation-layer` on annotation shapes.

## Theming variables

The renderer exposes CSS custom properties on `.pw-board`:

| Variable | Purpose |
| --- | --- |
| `--pw-light-square` | Light square color |
| `--pw-dark-square` | Dark square color |
| `--pw-animation-duration` | Transition duration for piece movement |
| `--pw-animation-easing` | Easing curve for piece movement transitions |
| `--pw-coordinate-color` | Coordinate label color for both square parities |
| `--pw-coordinate-on-light` | Coordinate label color on light squares |
| `--pw-coordinate-on-dark` | Coordinate label color on dark squares |
| `--pw-selected-color` | Selected square color |
| `--pw-destination-color` | Empty destination color |
| `--pw-capture-color` | Occupied destination color |
| `--pw-last-move-color` | Last move source and destination color |
| `--pw-check-color` | Checked king color |
| `--pw-annotation-color` | Default arrow and circle color |

Animation duration is non-negative; `0` switches to instant updates. Position updates reconcile by piece identity, so a moved piece keeps its DOM node and glides; newer updates retarget the running transition. Direct drag positioning is unanimated by design; dropping a piece animates its settle onto the square. Pass `coordinates: "edge"` (or `true`) to render orientation-aware a–h / 1–8 edge labels, or `coordinates: "inside"` to label every square; see [Coordinates](#coordinates).

## Coordinates

`coordinates` accepts `boolean | "edge" | "inside"` (default off). When enabled, the host element carries `data-coordinates="edge"` or `data-coordinates="inside"`; when off, `"none"`. `true` is equivalent to `"edge"`, `false` (or omitted) turns coordinates off; any other value throws `TypeError`. `"edge"` renders the 16 orientation-aware a–h / 1–8 labels in a `.pw-coordinates` layer. `"inside"` renders 64 `.pw-coordinate.pw-coordinate-inside` spans — one per square — each carrying `data-square="<name>"`, the full square name as text (e.g. `"e4"`), positioned on its cell, and a `data-parity` of `"light"` or `"dark"` so themes can color in-square labels. Flipping orientation repaints the inside labels in place; toggling at runtime via `set({ coordinates })` switches layers atomically.

Pieces come from the vendored **Cburnett** default artwork, embedded in the
bundle as data URIs so rendering never touches a network. Pass a `pieceSet`
to swap styles or host your own assets:

```ts
import { createChessboard, pieceSets } from "@plywise/chessboard";

// Built-in curated set, shipped as raw SVG sources.
createChessboard(host, { position, pieceSet: pieceSets.kiwenSuwi });

// Your own assets: a base URL pointing at {w|b}{P,N,B,R,Q,K}.svg.
createChessboard(host, {
  position,
  pieceSet: "https://example.com/pieces/spatial/",
});

// Unicode glyphs.
createChessboard(host, { position, pieceSet: null });

// Omit the option to render the vendored Cburnett default.
createChessboard(host, { position });
```

`pieceSet` accepts a `PieceSources` object (`{ wK, wQ, wR, wB, wN, wP, bK, bQ,
bR, bB, bN, bP }` — each a raw SVG source string), a plain base-URL string
for callers who want to self-host a directory of `{w|b}{P,N,B,R,Q,K}.svg`
files, `null` to render Unicode glyphs, or omission to use the vendored
Cburnett default. The curated entries in `pieceSets` ship inside the package
as embedded raw SVG sources (PieceSources-shaped objects); the renderer
serves them as `data:image/svg+xml` URIs so they never reach the network.
The vendored catalog contains six curated entries and nothing else:

| Set | License | Look |
| --- | --- | --- |
| `pieceSets.cburnett` | BSD-3-Clause option | Classic tournament set by Colin M.L. Burnett |
| `pieceSets.rhosgfx` | CC0-1.0 | Flat clean, no attribution required |
| `pieceSets.kiwenSuwi` | CC BY 4.0 (attribution) | Hand-drawn minimal set by neverRare |
| `pieceSets.chessnut` | Apache-2.0 | Flat modern set by Lex Luengas |
| `pieceSets.spatial` | MIT | Geometric set by Maurizio Monge |
| `pieceSets.celtic` | MIT | Celtic set by Maurizio Monge |

Licensing note: the default set is Cburnett artwork by Colin M.L. Burnett,
vendored under its BSD-3-Clause option — retain the notice in
`packages/chessboard/assets/cburnett/LICENSE.md` when distributing this
package or its artifacts. The bundled curated entries stay copyleft-free on
purpose: `rhosgfx` is CC0; `kiwenSuwi` is CC BY 4.0 (keep the attribution in
your app's credits/docs); `chessnut` is Apache-2.0 (retain the upstream
NOTICE when distributing the artwork); `spatial` and `celtic` are MIT artwork
by Maurizio Monge. `pieceSet: null` renders Unicode glyphs and involves no
asset license. The NOTICE entries `kiwenSuwi` © neverRare, `chessnut` © Lex
Luengas, and `spatial` / `celtic` © Maurizio Monge must travel with this
package or any artifact that embeds it; per-file SHA-1 provenance and
upstream links live in `packages/chessboard/assets/SETS.md`. Licenses were
verified against lila's `COPYING.md`, each upstream `LICENSE`, and the
Wikimedia Commons file pages for the vendored set.

## Lifecycle

- `createChessboard(host, config)` returns a controller. The renderer validates inputs at the boundary and throws `TypeError` for invalid squares, pieces, colors, orientations, animation durations, interaction inputs, presentation inputs, annotations, layer visibility, and any other public value.
- `set(update)` forwards controlled changes: position replacement, approved single-piece `move`, orientation flip, `ariaLabel`, `animationMs`, `coordinates`, `interaction`, `presentation`, `annotations`, `visibleLayers`, `pieceSet` (`PieceSources` object, base-URL string, or `null`), `theme`. Omitted fields are left unchanged; boards created without `pieceSet` render the vendored default set, `pieceSet: null` restores glyphs, `theme: null` restores stylesheet square colors, and `interaction: null` disables interaction and clears transient pointer state.
- `move(from, to)` is the caller-approved single-piece move. It preserves the moving DOM node, removes only the captured node, and does not animate if `animationMs` is `0`.
- `destroy()` is idempotent and safe to call repeatedly. Calls to `set` or `move` after `destroy` throw `Error`. The DOM subtree is removed on destroy.

Caller collections are copied at the seam. External mutation of `Position`, `destinations`, `annotations`, or `visibleLayers` after `set` cannot silently alter rendered state.

## Accessibility

The renderer exposes the board as one labelled image. `ariaLabel` in the core package and `boardLabel` in React customize that label; pieces and annotation shapes are decorative and hidden from assistive technology. The package does not implement keyboard interaction, roving square focus, screen-reader move entry, or move announcements, and therefore does not claim a fully accessible interactive-board experience. Callers that need an accessible interactive board must build that layer above the renderer.

## React adapter

`@plywise/chessboard-react` exposes the core contract as props:

- `interaction` (`{ destinations, onEvent, annotationGestures? } | null`).
- `presentation` (`{ selected?, lastMove?, checked? }`).
- `annotations` (`Annotation[]`).
- `visibleLayers` (`ReadonlySet<string> | undefined`; omitted shows all, empty hides all).
- `coordinates` (`boolean | "edge" | "inside"`, default `false`) and the remaining `ChessboardConfig` fields (`orientation`, `boardLabel`, `animationMs`, `pieceSet`, `theme`).

The adapter creates exactly one core renderer instance, forwards every prop change through that instance, keeps the latest `onEvent` available without recreating the board, and destroys the instance on unmount. No React state is used for board DOM, drag coordinates, or transient pointer state; pointer movement never triggers a React render.

Re-exported domain types include `Color`, `File`, `Rank`, `Role`, `Square`, `Piece`, `Position`, `Annotation`, `ArrowAnnotation`, `CircleAnnotation`, `AnnotationGesture`, `AnnotationModifier`, `JsonValue`, `Destinations`, `Interaction`, `InteractionEvent`, `Presentation`, `LastMove`, `ChessboardConfig`, and `ChessboardUpdate`.

## Support contract

- ESM-only packages with TypeScript declarations; CommonJS `require` is not supported.
- `@plywise/chessboard-react` supports React 18 and 19 and does not install a second React copy.
- Current stable Chrome, Edge, Firefox, and Safari are the browser target. Legacy browsers are not supported.
- Node.js 22 and npm 11.17 are required for repository development and publishing, not for browser runtime.
- Styles are opt-in through `@plywise/chessboard/style.css`.

## Out of scope

The renderer does not implement chess rules, FEN/PGN parsing, legal-move calculation, turns, premoves, ghost pieces, free drawing, board editing, keyboard interaction, screen-reader move entry, full keyboard navigation, a public agent namespace, a public schema package, a custom piece element factory, raw SVG access, or 3D/canvas rendering. The internal `BoardSnapshot` and `BoardCommand` types are private and not exported.

## Development

```sh
npm ci
npm exec -- playwright install chromium
npm run verify
npm run dev        # Vite example on http://localhost:5173
npm run storybook # interactive API reference on http://localhost:6006
```

The Storybook playground (`packages/chessboard-react/stories/`) doubles as the
living API reference: every feature — interaction, presentation marks,
annotation layers, modifier-coloured gestures, themes, and piece sets — has a
runnable story with controls.

`npm run verify` runs Biome, TypeScript, unit tests, `publint`, Are the Types Wrong, the packed-tarball consumer build, and Chromium smoke tests. Run `npm run format` to apply Biome fixes.

## Benchmarks

`npm run bench` runs a reproducible Chromium benchmark against approved moves, 1,000-position updates, arbitrary replacements, annotation replacements, 32/50-board throughput, and 60/120 Hz drag input. It reports deterministic median/p95/p99 synchronous JS durations where applicable, aggregate board-owned DOM mutation counts, and drag-input delivery cadence; it writes `benchmarks/report.json` together with the same JSON on stdout. Timing is advisory; correctness assertions and multi-board viewport visibility fail the command.

After the initial release, user-visible package changes require `npm run changeset`. The manually triggered release workflow opens versioning pull requests and publishes through npm trusted publishing; the npm organization must authorize `.github/workflows/release.yml` before it is run.
