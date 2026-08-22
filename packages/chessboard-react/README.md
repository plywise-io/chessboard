# @plywise/chessboard-react

React lifecycle adapter for `@plywise/chessboard`.

```sh
npm install @plywise/chessboard @plywise/chessboard-react
```

```tsx
import "@plywise/chessboard/style.css";
import { Chessboard } from "@plywise/chessboard-react";

export function Board({ position }) {
  return <Chessboard position={position} />;
}
```

The position remains controlled by the caller. Chess rules, move legality, and FEN/PGN parsing stay outside the renderer.
