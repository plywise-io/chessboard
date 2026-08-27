import type { Annotation, InteractionEvent } from "@plywise/chessboard";
import { Chessboard } from "@plywise/chessboard-react";
import type { Meta } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { ANNOTATION_EXAMPLES, positionFromFen, START_FEN } from "../helpers.js";

/**
 * Annotations are a keyed collection of arrows and circles. Each annotation
 * carries a stable `id`, a caller-defined `layer`, and optional `metadata`.
 * `visibleLayers` controls which layers are drawn; hidden layers stay in
 * caller state.
 *
 * The example keeps two layers (`engine`, `user`) plus the renderer's
 * right-button gestures to add or remove user annotations.
 */
export default {
  title: "Recipes/AnnotationLayers",
  tags: ["autodocs"],
} satisfies Meta;

const LAYERS = ["engine", "user"] as const;

export const ToggleableLayers = {
  render: () => {
    const [visible, setVisible] = useState<ReadonlySet<string>>(
      () => new Set(LAYERS),
    );
    const [userAnnotations, setUserAnnotations] = useState<
      readonly Annotation[]
    >([]);

    const onEvent = useCallback((event: InteractionEvent) => {
      if (event.type !== "circle" && event.type !== "arrow") return;
      const color = event.color ?? "#15781B";
      const id =
        event.type === "circle"
          ? `circle:${event.square}:${color}`
          : `arrow:${event.from}-${event.to}:${color}`;
      setUserAnnotations((prev) =>
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
    }, []);

    const toggle = (layer: string) =>
      setVisible((prev) => {
        const next = new Set(prev);
        if (next.has(layer)) next.delete(layer);
        else next.add(layer);
        return next;
      });

    return (
      <div style={{ width: "24rem" }}>
        <Chessboard
          position={positionFromFen(START_FEN)}
          annotations={[...ANNOTATION_EXAMPLES, ...userAnnotations].filter(
            (a) => visible.has(a.layer),
          )}
          visibleLayers={visible}
          interaction={{
            destinations: new Map(),
            onEvent,
            annotationGestures: [
              { modifiers: [], color: "#15781B" },
              { modifiers: ["ctrl"], color: "#268bd2" },
            ],
          }}
        />
        <div style={{ marginTop: ".5rem", display: "flex", gap: ".5rem" }}>
          {LAYERS.map((layer) => (
            <button key={layer} type="button" onClick={() => toggle(layer)}>
              {visible.has(layer) ? "Hide" : "Show"} {layer}
            </button>
          ))}
        </div>
        <p style={{ fontSize: ".75rem", marginTop: ".5rem" }}>
          Right-click and drag on the board to draw an arrow. Right-click on a
          square to draw a circle. Hold Ctrl for the alt colour.
        </p>
      </div>
    );
  },
};
