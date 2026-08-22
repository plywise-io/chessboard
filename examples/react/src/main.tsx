import type { Piece, Role, Square } from "@plywise/chessboard";
import "@plywise/chessboard/style.css";
import { Chessboard } from "@plywise/chessboard-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const backRank: readonly Role[] = [
  "rook",
  "knight",
  "bishop",
  "queen",
  "king",
  "bishop",
  "knight",
  "rook",
];
const position = new Map<Square, Piece>();

for (const [index, file] of files.entries()) {
  const role = backRank[index];
  if (!role) continue;
  position.set(`${file}1`, { color: "white", role });
  position.set(`${file}2`, { color: "white", role: "pawn" });
  position.set(`${file}7`, { color: "black", role: "pawn" });
  position.set(`${file}8`, { color: "black", role });
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Plywise Chessboard</h1>
      <Chessboard position={position} boardLabel="Initial chess position" />
    </main>
  </StrictMode>,
);
