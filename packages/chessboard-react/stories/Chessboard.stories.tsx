import type { Annotation, InteractionEvent, Square } from "@plywise/chessboard";
import {
  boardThemes,
  Chessboard,
  type PieceSetName,
  pieceSets,
} from "@plywise/chessboard-react";
import { useMemo, useState } from "react";
import {
  ANNOTATION_EXAMPLES,
  demoDestinations,
  positionFromFen,
  START_FEN,
} from "./helpers";

export default {
  title: "Chessboard",
  component: Chessboard,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "radio", options: ["white", "black"] },
    themeName: { control: "radio", options: Object.keys(boardThemes) },
    pieceSetName: {
      control: "radio",
      options: [...Object.keys(pieceSets), "glyphs"],
    },
  },
} satisfies Meta;

/** A spectator board: no `interaction` means pointer-inert rendering. */
export const Default = {
  args: {
    position: positionFromFen(START_FEN),
    orientation: "white",
    ariaLabel: "Starting position",
  },
  render: (args) => (
    <div style={{ width: "24rem" }}>
      <Chessboard {...args} />
    </div>
  ),
};

/** Click a piece, then click a highlighted square — or drag the piece. */
export const InteractiveMove = {
  render: () => {
    const [position, setPosition] = useState(() => positionFromFen(START_FEN));
    const [log, setLog] = useState<string[]>([]);
    const destinations = useMemo(() => demoDestinations(position), [position]);
    const onEvent = (event: InteractionEvent) => {
      if (event.type === "move") {
        setPosition((current) => {
          const next = new Map(current);
          const piece = next.get(event.from);
          if (!piece || !destinations.get(event.from)?.includes(event.to)) {
            return current;
          }
          next.delete(event.from);
          next.set(event.to, piece);
          return next;
        });
      }
      setLog((prev) => [
        `${event.type}${"from" in event ? ` ${event.from}→${event.to}` : ""}`,
        ...prev.slice(0, 4),
      ]);
    };
    return (
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div style={{ width: "24rem" }}>
          <Chessboard
            position={position}
            interaction={{ destinations, onEvent }}
          />
        </div>
        <pre style={{ fontSize: ".75rem", minHeight: "5rem" }}>
          {log.join("\n") || "(events appear here)"}
        </pre>
      </div>
    );
  },
};

/** Caller-controlled marks for last move and check. */
export const PresentationMarks = {
  args: {
    position: positionFromFen(
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    ),
    presentation: { lastMove: { from: "f1", to: "c4" }, checked: "e8" },
  },
  render: (args) => (
    <div style={{ width: "24rem" }}>
      <Chessboard {...args} />
    </div>
  ),
};

/**
 * Annotations live per layer; callers toggle visibility through
 * `visibleLayers` without losing state.
 */
export const AnnotationLayers = {
  render: () => {
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const toggle = (layer: string) =>
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(layer)) next.delete(layer);
        else next.add(layer);
        return next;
      });
    const allLayers = ["engine", "ideas", "tactics"];
    return (
      <div style={{ width: "24rem" }}>
        <Chessboard
          position={positionFromFen(START_FEN)}
          annotations={ANNOTATION_EXAMPLES.filter(
            (a: Annotation) => !hidden.has(a.layer),
          )}
        />
        <div style={{ marginTop: ".5rem", display: "flex", gap: ".5rem" }}>
          {allLayers.map((layer) => (
            <button key={layer} type="button" onClick={() => toggle(layer)}>
              {hidden.has(layer) ? "Show" : "Hide"} {layer}
            </button>
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Right-button gestures draw arrows (drag) and circles (click).
 * Hold Ctrl or Alt while drawing for other colours.
 */
export const GestureColours = {
  render: () => {
    const [drawn, setDrawn] = useState<readonly Annotation[]>([]);
    const onEvent = (event: InteractionEvent) => {
      if (event.type !== "circle" && event.type !== "arrow") return;
      const color = event.color ?? "#15781B";
      const id =
        event.type === "circle"
          ? `circle:${event.square}:${color}`
          : `arrow:${event.from}-${event.to}:${color}`;
      setDrawn((prev) =>
        prev.some((a) => a.id === id)
          ? prev.filter((a) => a.id !== id)
          : [
              ...prev,
              event.type === "circle"
                ? {
                    id,
                    kind: "circle",
                    square: event.square,
                    layer: "user",
                    color,
                  }
                : {
                    id,
                    kind: "arrow",
                    from: event.from,
                    to: event.to,
                    layer: "user",
                    color,
                  },
            ],
      );
    };
    return (
      <div style={{ width: "24rem" }}>
        <Chessboard
          position={positionFromFen(START_FEN)}
          interaction={{
            destinations: new Map<Square, readonly Square[]>(),
            onEvent,
            annotationGestures: [
              { modifiers: [], color: "#15781B" },
              { modifiers: ["ctrl"], color: "#268bd2" },
              { modifiers: ["alt"], color: "#c0392b" },
            ],
          }}
          annotations={drawn}
        />
      </div>
    );
  },
};

/** Theme, piece set and orientation are plain props — flip them via controls. */
export const Playground = {
  args: {
    orientation: "white" as const,
    themeName: Object.keys(boardThemes)[0],
    pieceSetName: Object.keys(pieceSets)[0],
  },
  render: ({ orientation, themeName, pieceSetName }) => (
    <div style={{ width: "24rem" }}>
      <Chessboard
        position={positionFromFen(START_FEN)}
        orientation={orientation}
        theme={boardThemes[themeName as keyof typeof boardThemes]}
        {...(pieceSetName === "glyphs"
          ? { pieceSet: null as null }
          : { pieceSet: pieceSets[pieceSetName as PieceSetName] })}
      />
    </div>
  ),
};
