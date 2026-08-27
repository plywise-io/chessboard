import type { InteractionEvent } from "@plywise/chessboard";
import { Chessboard } from "@plywise/chessboard-react";
import type { Meta } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { demoDestinations, positionFromFen, START_FEN } from "../helpers.js";

/**
 * Opt into keyboard interaction with `interaction.keyboard: true`. The board
 * becomes a focusable `role="application"`; arrow keys move a cursor, Enter
 * and Space activate it, Escape clears. The polite live region announces the
 * focused square and the piece on it.
 */
export default {
  title: "Recipes/Accessibility",
  tags: ["autodocs"],
} satisfies Meta;

export const KeyboardNavigation = {
  render: () => {
    const [position, setPosition] = useState(() => positionFromFen(START_FEN));
    const [log, setLog] = useState<string[]>([]);

    const onEvent = useCallback((event: InteractionEvent) => {
      setLog((prev) => [
        `${event.type}${event.type === "move" ? ` ${event.from}→${event.to}` : ""}${event.type === "select" ? ` ${event.square}` : ""}`,
        ...prev.slice(0, 4),
      ]);
      if (event.type !== "move") return;
      setPosition((current) => {
        const next = new Map(current);
        const piece = next.get(event.from);
        if (!piece) return current;
        next.delete(event.from);
        next.set(event.to, piece);
        return next;
      });
    }, []);

    return (
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div style={{ width: "24rem" }}>
          <Chessboard
            position={position}
            interaction={{
              destinations: demoDestinations(position),
              onEvent,
              keyboard: true,
            }}
            boardLabel="Starting position. Arrow keys move; Enter selects."
          />
        </div>
        <div style={{ minWidth: "14rem" }}>
          <p style={{ fontSize: ".875rem", margin: 0 }}>
            Click the board, then use the arrow keys, Enter, and Escape.
          </p>
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
