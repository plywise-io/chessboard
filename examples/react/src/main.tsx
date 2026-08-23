import type {
  Annotation,
  Interaction,
  InteractionEvent,
  Piece,
  Position,
  Presentation,
  Square,
} from "@plywise/chessboard";
import "@plywise/chessboard/style.css";
import {
  type BoardThemeName,
  boardThemes,
  Chessboard,
  type PieceSetName,
  pieceSets,
} from "@plywise/chessboard-react";
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const BACK_RANK = [
  "rook",
  "knight",
  "bishop",
  "queen",
  "king",
  "bishop",
  "knight",
  "rook",
] as const;

function initialPosition(): Position {
  const position = new Map<Square, Piece>();
  FILES.forEach((file, index) => {
    const role = BACK_RANK[index];
    if (!role) return;
    position.set(`${file}1`, { color: "white", role });
    position.set(`${file}2`, { color: "white", role: "pawn" });
    position.set(`${file}7`, { color: "black", role: "pawn" });
    position.set(`${file}8`, { color: "black", role });
  });
  return position;
}

function legalDestinations(
  position: Position,
  source: Square,
): readonly Square[] {
  const piece = position.get(source);
  if (!piece) return [];
  const file = source[0];
  const rank = Number(source[1]);
  const out: Square[] = [];
  if (piece.role === "pawn") {
    const dir = piece.color === "white" ? 1 : -1;
    const startRank = piece.color === "white" ? 2 : 7;
    if (rank + dir >= 1 && rank + dir <= 8) {
      const one = `${file}${rank + dir}` as Square;
      if (!position.has(one)) {
        out.push(one);
        if (rank === startRank) {
          const two = `${file}${rank + 2 * dir}` as Square;
          if (!position.has(two)) out.push(two);
        }
      }
    }
  } else if (piece.role === "rook") {
    for (const dx of [-1, 1] as const) {
      for (
        let f = FILES.indexOf(file as (typeof FILES)[number]) + dx;
        f >= 0 && f < 8;
        f += dx
      ) {
        const sq = `${FILES[f]}${rank}` as Square;
        out.push(sq);
        if (position.has(sq)) break;
      }
    }
    for (const dy of [-1, 1] as const) {
      for (let r = rank + dy; r >= 1 && r <= 8; r += dy) {
        const sq = `${file}${r}` as Square;
        out.push(sq);
        if (position.has(sq)) break;
      }
    }
  }
  return out;
}

function lastEventLabel(event: InteractionEvent): string {
  if (event.type === "select") return `select ${event.square}`;
  if (event.type === "clear") return "clear";
  if (event.type === "circle") return `circle ${event.square}`;
  if (event.type === "arrow") return `arrow ${event.from}→${event.to}`;
  return `move ${event.from}→${event.to} (${event.origin})`;
}

const ANNOTATIONS: readonly Annotation[] = [
  {
    id: "user-arrow",
    kind: "arrow",
    from: "e2",
    to: "e4",
    layer: "user",
    color: "#15781B",
    metadata: { line: "main", eval_cp: 32 },
  },
  {
    id: "engine-circle",
    kind: "circle",
    square: "d5",
    layer: "engine",
    color: "#268bd2",
    metadata: { multipv: 1, depth: 24 },
  },
  {
    id: "training-arrow",
    kind: "arrow",
    from: "d2",
    to: "d4",
    layer: "training",
    color: "#d33682",
    metadata: { lesson: 3, source: "lichess-puzzles" },
  },
];

const NO_ANNOTATIONS: readonly Annotation[] = [];

function App() {
  const [position, setPosition] = useState(initialPosition);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [selected, setSelected] = useState<Square | undefined>(undefined);
  const [lastEvent, setLastEvent] = useState("no gesture yet");
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showStateMarks, setShowStateMarks] = useState(false);
  const [lastMove, setLastMove] = useState<Presentation["lastMove"]>();
  const [hiddenLayers, setHiddenLayers] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [drawn, setDrawn] = useState<readonly Annotation[]>([]);
  const [pieceSetName, setPieceSetName] = useState<PieceSetName | "glyphs">(
    "firi",
  );
  const [themeName, setThemeName] = useState<BoardThemeName>("brown");
  const stateRef = useRef({ position });
  useEffect(() => {
    stateRef.current.position = position;
  }, [position]);

  const destinations = useMemo(() => {
    const map = new Map<Square, readonly Square[]>();
    for (const square of position.keys()) {
      const moves = legalDestinations(position, square);
      if (moves.length > 0) map.set(square, moves);
    }
    return map;
  }, [position]);

  const onEvent = useCallback((event: InteractionEvent) => {
    setLastEvent(lastEventLabel(event));
    if (event.type === "select") {
      const moves = legalDestinations(stateRef.current.position, event.square);
      if (moves.length === 0) {
        setSelected(undefined);
        return;
      }
      setSelected(event.square);
      return;
    }
    if (event.type === "clear") {
      setSelected(undefined);
      return;
    }
    if (event.type === "circle" || event.type === "arrow") {
      // Right-button gesture: toggle the requested shape in caller state.
      const annotation: Annotation =
        event.type === "circle"
          ? {
              id: `circle:${event.square}`,
              kind: "circle",
              square: event.square,
              layer: "user",
            }
          : {
              id: `arrow:${event.from}-${event.to}`,
              kind: "arrow",
              from: event.from,
              to: event.to,
              layer: "user",
            };
      setDrawn((prev) =>
        prev.some((existing) => existing.id === annotation.id)
          ? prev.filter((existing) => existing.id !== annotation.id)
          : [...prev, annotation],
      );
      return;
    }
    if (event.type === "move") {
      if (event.from === event.to) return;
      const piece = stateRef.current.position.get(event.from);
      if (!piece) return;
      const allowed = legalDestinations(stateRef.current.position, event.from);
      if (!allowed.includes(event.to)) return;
      const next = new Map(stateRef.current.position);
      setLastMove({ from: event.from, to: event.to });
      next.delete(event.from);
      next.set(event.to, piece);
      setPosition(next);
      setSelected(undefined);
    }
  }, []);

  const interaction = useMemo<Interaction>(
    () => ({ destinations, onEvent }),
    [destinations, onEvent],
  );
  const presentation = useMemo<Presentation>(
    () => ({
      ...(selected === undefined ? {} : { selected }),
      ...(lastMove === undefined
        ? showStateMarks
          ? { lastMove: { from: "e2", to: "e4" } }
          : {}
        : { lastMove }),
      ...(showStateMarks ? { checked: "e1" } : {}),
    }),
    [lastMove, selected, showStateMarks],
  );
  // `undefined` keeps every layer visible; an explicit `Set` filters them.
  const visibleLayers = useMemo(() => {
    if (hiddenLayers.size === 0) return undefined;
    const all = ["user", "engine", "training"];
    return new Set(all.filter((layer) => !hiddenLayers.has(layer)));
  }, [hiddenLayers]);

  const toggleLayer = useCallback((layer: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }, []);

  const mergedAnnotations = useMemo(() => [...ANNOTATIONS, ...drawn], [drawn]);

  return (
    <main>
      <h1>Plywise Chessboard</h1>
      <Chessboard
        position={position}
        orientation={orientation}
        boardLabel="Demo chess position"
        animationMs={150}
        interaction={interaction}
        annotations={showAnnotations ? mergedAnnotations : NO_ANNOTATIONS}
        pieceSet={
          pieceSetName === "glyphs" ? null : (pieceSets[pieceSetName] ?? null)
        }
        theme={boardThemes[themeName] ?? null}
        presentation={presentation}
        {...(visibleLayers === undefined ? {} : { visibleLayers })}
      />
      <div className="controls">
        <label>
          Pieces{" "}
          <select
            data-testid="piece-set"
            value={pieceSetName}
            onChange={(event) =>
              setPieceSetName(event.target.value as PieceSetName | "glyphs")
            }
          >
            <option value="glyphs">Unicode glyphs</option>
            {Object.keys(pieceSets).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Board{" "}
          <select
            data-testid="board-theme"
            value={themeName}
            onChange={(event) =>
              setThemeName(event.target.value as BoardThemeName)
            }
          >
            {Object.keys(boardThemes).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            setOrientation((current) =>
              current === "white" ? "black" : "white",
            )
          }
        >
          Flip orientation
        </button>
        <button
          type="button"
          aria-pressed={showAnnotations}
          data-testid="toggle-annotations"
          onClick={() => setShowAnnotations((prev) => !prev)}
        >
          {showAnnotations ? "Hide" : "Show"} annotations
        </button>
        <button
          type="button"
          aria-pressed={!hiddenLayers.has("user")}
          data-testid="toggle-user-layer"
          onClick={() => toggleLayer("user")}
        >
          {hiddenLayers.has("user") ? "Show" : "Hide"} user
        </button>
        <button
          type="button"
          aria-pressed={!hiddenLayers.has("training")}
          data-testid="toggle-training-layer"
          onClick={() => toggleLayer("training")}
        >
          {hiddenLayers.has("training") ? "Show" : "Hide"} training
        </button>
        <button
          type="button"
          aria-pressed={showStateMarks}
          onClick={() => setShowStateMarks((shown) => !shown)}
        >
          {showStateMarks ? "Hide" : "Show"} last move and check
        </button>
        <button
          type="button"
          onClick={() => {
            setPosition(initialPosition());
            setSelected(undefined);
            setLastMove(undefined);
          }}
        >
          Reset position
        </button>
      </div>
      <p className="status" data-testid="last-event">
        Last event: {lastEvent}
      </p>
      <p className="status" data-testid="orientation">
        Orientation: {orientation}
      </p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
