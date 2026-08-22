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

## Development

```sh
npm install
npm run check
npm test
npm run dev
```

Run `npm run format` to apply Biome formatting. Pull requests run the same checks in GitHub Actions and verify both npm tarballs.

The initial renderer covers position rendering, orientation, incremental approved moves, dynamic updates, cleanup, and the React lifecycle. Interaction, highlights, shapes, and animation interruption remain outside this commit.