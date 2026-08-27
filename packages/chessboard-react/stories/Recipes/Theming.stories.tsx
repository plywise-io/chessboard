import { boardThemes, Chessboard } from "@plywise/chessboard-react";
import type { Meta } from "@storybook/react-vite";
import { positionFromFen, START_FEN } from "../helpers.js";

/**
 * The renderer is themed through documented CSS custom properties on
 * `.pw-board` and the `theme` prop on the core API. CSS variables are the
 * primary surface — they are cascade-friendly, work with shadow DOM, and
 * survive orientation flips without re-applying.
 */
export default {
  title: "Recipes/Theming",
  tags: ["autodocs"],
} satisfies Meta;

const position = positionFromFen(START_FEN);

export const BuiltInThemes = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 18rem)",
        gap: "1rem",
      }}
    >
      {Object.entries(boardThemes).map(([name, theme]) => (
        <figure key={name} style={{ margin: 0 }}>
          <Chessboard position={position} theme={theme} />
          <figcaption
            style={{
              fontSize: ".75rem",
              textAlign: "center",
              marginTop: ".25rem",
            }}
          >
            {name}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};

export const CssCustomProperties = {
  render: () => (
    <div
      style={
        {
          "--pw-light-square": "#1e3a5f",
          "--pw-dark-square": "#0f1f33",
          "--pw-coordinate-color": "#e8d4a2",
          "--pw-selected-color": "rgba(232, 196, 76, 0.45)",
          "--pw-destination-color": "rgba(232, 196, 76, 0.30)",
          "--pw-capture-color": "rgba(220, 80, 80, 0.45)",
          "--pw-last-move-color": "rgba(232, 196, 76, 0.25)",
          "--pw-check-color": "rgba(220, 60, 60, 0.55)",
          "--pw-annotation-color": "rgba(120, 200, 240, 0.9)",
        } as React.CSSProperties
      }
    >
      <div style={{ width: "24rem" }}>
        <Chessboard
          position={position}
          coordinates="edge"
          presentation={{ lastMove: { from: "e2", to: "e4" } }}
        />
      </div>
    </div>
  ),
};
