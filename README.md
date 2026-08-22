# Plywise Chessboard

A framework-agnostic chessboard renderer with a small React adapter.

## Packages

- `@plywise/chessboard`: DOM renderer and its TypeScript interface.
- `@plywise/chessboard-react`: lifecycle adapter for React.

The renderer owns DOM updates. React supplies positions and configuration; it does not render individual squares or pieces.

## Architecture

```text
packages/
  chessboard/        framework-agnostic renderer
  chessboard-react/  React adapter
examples/
  react/             browser smoke test and usage example
```

Chess rules, FEN/PGN parsing, move validation, and game state belong to the caller. A position is a map from squares to pieces. `move` applies a caller-approved move and preserves the moving DOM node; `set` handles arbitrary position or orientation changes.

## Usage

```ts
import { createChessboard } from "@plywise/chessboard";
import "@plywise/chessboard/style.css";

const position = new Map([
  ["e1", { color: "white", role: "king" }],
  ["e8", { color: "black", role: "king" }],
]);

const board = createChessboard(element, { position });
board.move("e1", "e2");
board.destroy();
```

```tsx
import "@plywise/chessboard/style.css";
import { Chessboard } from "@plywise/chessboard-react";

export function Board({ position }) {
  return <Chessboard position={position} />;
}
```

## Support contract

- ESM-only packages with TypeScript declarations; CommonJS `require` is not supported.
- `@plywise/chessboard-react` supports React 18 and 19 and does not install a second React copy.
- Current stable Chrome, Edge, Firefox, and Safari are the browser target. Legacy browsers are not supported.
- Node.js 22 and npm 11.17 are required for repository development and publishing, not for browser runtime.
- Styles are opt-in through `@plywise/chessboard/style.css`.

## Accessibility

The renderer exposes the board as one labelled image. `ariaLabel` in the core package and `boardLabel` in React customize that label; individual decorative piece glyphs are hidden from assistive technology. Keyboard interaction is not implemented yet, so the package does not claim an accessible interactive-board experience.

## Scope

The initial renderer covers position rendering, orientation, incremental approved moves, dynamic updates, cleanup, and the React lifecycle. Interaction, highlights, shapes, and animation interruption remain out of scope.

## Development

```sh
npm ci
npm exec -- playwright install chromium
npm run verify
npm run dev
```

`npm run verify` runs Biome, TypeScript, unit tests, `publint`, Are the Types Wrong, a packed-tarball consumer build, and the Chromium smoke test. Run `npm run format` to apply Biome fixes.

After the initial release, user-visible package changes require `npm run changeset`. The manually triggered release workflow opens versioning pull requests and publishes through npm trusted publishing; the npm organization must authorize `.github/workflows/release.yml` before it is run.