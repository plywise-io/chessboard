# @plywise/chessboard

Framework-agnostic DOM renderer for chess positions. The caller owns chess rules, move legality, and FEN/PGN parsing.

```sh
npm install @plywise/chessboard
```

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

ESM-only. TypeScript declarations are included. The board is exposed to assistive technology as one labelled image; keyboard interaction is not implemented.

See the [repository README](https://github.com/plywise-io/chessboard#readme) for architecture and development commands.
