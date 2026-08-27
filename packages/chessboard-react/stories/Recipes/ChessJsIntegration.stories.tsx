import type { InteractionEvent, Position, Square } from "@plywise/chessboard";
import { Chessboard } from "@plywise/chessboard-react";
import type { Meta } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { positionFromFen, START_FEN } from "../helpers.js";

// We deliberately do NOT import `chess.js` at module top level. The engine
// module is loaded through a Function-evaluated import at runtime; bundlers
// leave the specifier as a string and resolve it in the browser only. This
// keeps the Storybook build independent of the consumer's chess-engine
// choice. With no engine present the board still renders the initial
// position.
type ChessEngine = {
  board(): Array<Array<{ color: "white" | "black"; type: string } | null>>;
  moves(opts?: { square?: string; verbose?: boolean }): unknown;
  inCheck(): boolean;
  turn(): "w" | "b";
  move(input: { from: Square; to: Square }): unknown;
  fen(): string;
};

type Destinations = ReadonlyMap<Square, readonly Square[]>;
type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const FILES: readonly File[] = ["a", "b", "c", "d", "e", "f", "g", "h"];

const positionFromChess = (chess: ChessEngine): Position => {
  const map = new Map<Square, { color: "white" | "black"; role: string }>();
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    const rank = (8 - r) as Rank;
    for (let f = 0; f < 8; f++) {
      const square = board[r]?.[f];
      const file = FILES[f];
      if (!square || !file) continue;
      const sq = `${file}${rank}` as Square;
      map.set(sq, { color: square.color, role: square.type });
    }
  }
  return map as Position;
};

const destinationsFromChess = (chess: ChessEngine): Destinations => {
  const out = new Map<Square, readonly Square[]>();
  for (const move of chess.moves({ verbose: true }) as Array<{
    from: Square;
    to: Square;
  }>) {
    const list = out.get(move.from);
    out.set(move.from, list ? [...list, move.to] : [move.to]);
  }
  return out;
};

// Hide the dynamic import from Rollup/Vite by going through `new Function`.
// The browser still resolves the specifier at call time, so chess.js works
// when consumers install it, and the Storybook build does not require it.
const loadChess = async (): Promise<ChessEngine | null> => {
  if (typeof window === "undefined") return null;
  try {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (s: string) => Promise<{ Chess: new () => ChessEngine }>;
    const mod = await dynamicImport("chess.js");
    return mod.Chess ? new mod.Chess() : null;
  } catch {
    return null;
  }
};

/**
 * The renderer owns DOM updates; the engine owns legality. This story wires
 * `chess.js` to `@plywise/chessboard` so every `move` event is a real legal
 * move computed by the engine.
 *
 * `chess.js` is a separate install. It is not a peer dependency of the
 * renderer. The recipe loads it dynamically, so the Storybook build does not
 * require it. With no engine present the board still renders the initial
 * position.
 */
export default {
  title: "Recipes/ChessJsIntegration",
  tags: ["autodocs"],
} satisfies Meta;

export const ChessEngine = {
  render: () => {
    const [engine, setEngine] = useState<ChessEngine | null>(null);
    const [position, setPosition] = useState<Position>(() =>
      positionFromFen(START_FEN),
    );
    const [destinations, setDestinations] = useState<Destinations>(
      () => new Map(),
    );
    const [log, setLog] = useState<string[]>([]);

    useState(() => {
      void loadChess().then((c) => {
        if (!c) return;
        setEngine(c);
        setDestinations(destinationsFromChess(c));
      });
      return null;
    });

    const onEvent = useCallback(
      (event: InteractionEvent) => {
        if (event.type === "select" && engine) {
          const moves = engine.moves({
            square: event.square,
            verbose: true,
          }) as Array<{ to: Square }>;
          setDestinations(new Map([[event.square, moves.map((m) => m.to)]]));
          setLog((prev) => [`select ${event.square}`, ...prev.slice(0, 4)]);
          return;
        }
        if (event.type === "clear") {
          if (engine) setDestinations(destinationsFromChess(engine));
          setLog((prev) => ["clear", ...prev.slice(0, 4)]);
          return;
        }
        if (event.type === "move" && engine) {
          try {
            const result = engine.move({
              from: event.from,
              to: event.to,
            });
            if (!result) return;
            setPosition(positionFromChess(engine));
            setDestinations(destinationsFromChess(engine));
            setLog((prev) => [
              `move ${event.from}→${event.to}`,
              ...prev.slice(0, 4),
            ]);
          } catch {
            // Illegal move (should not happen — engine gates destinations).
          }
        }
      },
      [engine],
    );

    return (
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div style={{ width: "24rem" }}>
          <Chessboard
            position={position}
            interaction={{ destinations, onEvent }}
          />
        </div>
        <div style={{ minWidth: "14rem" }}>
          <strong style={{ display: "block", marginBottom: ".25rem" }}>
            FEN
          </strong>
          <code style={{ fontSize: ".75rem", wordBreak: "break-all" }}>
            {engine ? engine.fen() : "(install chess.js to see live FEN)"}
          </code>
          <pre
            style={{
              fontSize: ".75rem",
              marginTop: ".5rem",
              minHeight: "5rem",
            }}
          >
            {(log.length ? log : ["(events appear here)"]).join("\n")}
          </pre>
        </div>
      </div>
    );
  },
};
