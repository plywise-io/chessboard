import { Chessboard, pieceSets } from "@plywise/chessboard-react";
import type { Meta } from "@storybook/react-vite";
import { positionFromFen, START_FEN } from "../helpers.js";

/**
 * `pieceSet` accepts:
 * - Omission → vendored Cburnett default (BSD-3-Clause).
 * - `PieceSources` object → bundled or caller-supplied raw SVG sources,
 *   served as data URIs so they never reach the network.
 * - Base URL string → self-hosted `{w|b}{P,N,B,R,Q,K}.svg` directory.
 * - `null` → Unicode glyphs; no asset license involved.
 */
export default {
  title: "Recipes/PieceSets",
  tags: ["autodocs"],
} satisfies Meta;

const position = positionFromFen(START_FEN);

export const CuratedSets = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 18rem)",
        gap: "1rem",
      }}
    >
      {Object.entries(pieceSets).map(([name, set]) => (
        <figure key={name} style={{ margin: 0 }}>
          <Chessboard position={position} pieceSet={set} />
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

export const UnicodeGlyphs = {
  render: () => (
    <div style={{ width: "24rem" }}>
      <Chessboard position={position} pieceSet={null} />
      <p style={{ fontSize: ".75rem", marginTop: ".25rem" }}>
        <code>pieceSet={"{null}"}</code> — no asset license, no network fetch.
      </p>
    </div>
  ),
};
