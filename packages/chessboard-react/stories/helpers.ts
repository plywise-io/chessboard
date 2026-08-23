import type { Annotation, Position, Square } from "@plywise/chessboard";

const ROLE_BY_LETTER = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
} as const;

/** Demo helper: consumers own FEN parsing and position building. */
export function positionFromFen(fen: string): Position {
  const [placement] = fen.split(" ");
  const position = new Map<
    Square,
    { color: "white" | "black"; role: string }
  >();
  let file = 0;
  let rank = 8;
  for (const ch of placement) {
    if (ch === "/") {
      rank -= 1;
      file = 0;
      continue;
    }
    if (/\d/.test(ch)) {
      file += Number(ch);
      continue;
    }
    position.set(`${"abcdefgh"[file]}${rank}` as Square, {
      color: ch === ch.toUpperCase() ? "white" : "black",
      role: ROLE_BY_LETTER[ch.toLowerCase() as keyof typeof ROLE_BY_LETTER],
    });
    file += 1;
  }
  return position as Position;
}

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const ARROW = (
  from: Square,
  to: Square,
  layer: string,
  color: string,
): Annotation => ({
  id: `${layer}:${from}-${to}`,
  kind: "arrow",
  from,
  to,
  layer,
  color,
});

const CIRCLE = (square: Square, layer: string, color: string): Annotation => ({
  id: `${layer}:${square}`,
  kind: "circle",
  square,
  layer,
  color,
});

export const ANNOTATION_EXAMPLES: readonly Annotation[] = [
  ARROW("g1", "f3", "engine", "#268bd2"),
  ARROW("e2", "e4", "ideas", "#15781B"),
  CIRCLE("d5", "tactics", "#c0392b"),
];

/**
 * Demo pseudo-legality: pawn pushes and knight jumps only. Real products
 * supply true legal destinations from their chess engine.
 */
export function demoDestinations(
  position: Position,
): ReadonlyMap<Square, readonly Square[]> {
  const result = new Map<Square, readonly Square[]>();
  for (const [square, piece] of position) {
    const fileIndex = "abcdefgh".indexOf(square[0]);
    const rank = Number(square[1]);
    if (piece.role === "pawn") {
      const direction = piece.color === "white" ? 1 : -1;
      const targets: Square[] = [];
      if (rank + direction >= 1 && rank + direction <= 8) {
        targets.push(`${"abcdefgh"[fileIndex]}${rank + direction}` as Square);
        if (
          (piece.color === "white" && rank === 2) ||
          (piece.color === "black" && rank === 7)
        ) {
          targets.push(
            `${"abcdefgh"[fileIndex]}${rank + 2 * direction}` as Square,
          );
        }
      }
      if (targets.length > 0) result.set(square, targets);
    }
    if (piece.role === "knight") {
      const jumps: Array<[number, number]> = [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ];
      const targets = jumps
        .map(([df, dr]) => [fileIndex + df, rank + dr] as const)
        .filter(([f, r]) => f >= 0 && f < 8 && r >= 1 && r <= 8)
        .map(([f, r]) => `${"abcdefgh"[f]}${r}` as Square);
      if (targets.length > 0) result.set(square, targets);
    }
  }
  return result;
}
