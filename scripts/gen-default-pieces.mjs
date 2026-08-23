// Regenerates packages/chessboard/src/internal/defaultPieces.ts from the
// pristine vendored artwork in packages/chessboard/assets/cburnett/.
// Provenance and licensing: packages/chessboard/assets/cburnett/LICENSE.md.
import { readFileSync, writeFileSync } from "node:fs";

const dir = "packages/chessboard/assets/cburnett";
const codes = [
  "wK",
  "wQ",
  "wR",
  "wB",
  "wN",
  "wP",
  "bK",
  "bQ",
  "bR",
  "bB",
  "bN",
  "bP",
];

let out =
  "// Generated from packages/chessboard/assets/cburnett/*.svg — DO NOT EDIT.\n" +
  "// Regenerate with: node scripts/gen-default-pieces.mjs\n" +
  "// License and provenance: see packages/chessboard/assets/cburnett/LICENSE.md.\n" +
  "// Artwork by Colin M.L. Burnett (Cburnett), redistributed under the\n" +
  "// BSD-3-Clause option of its multi-license.\n\n";
out +=
  "/**\n * Default piece artwork keyed by `{w|b}{P,N,B,R,Q,K}` piece codes, matching\n * the `pieceSet` filename contract. Values are raw SVG sources; the renderer\n * serves them to the DOM as `data:image/svg+xml` URIs.\n */\nexport const defaultPieces = {\n";

for (const code of codes) {
  // Normalize CRLF so the generated module stays formatter-stable; the
  // vendored files themselves remain pristine.
  const svg = readFileSync(`${dir}/${code}.svg`, "utf8")
    .replace(/\r\n/g, "\n")
    .trim();
  if (svg.includes("`") || svg.includes("${")) {
    throw new Error(`unsafe characters in ${code}`);
  }
  out += `  ${code}: \`\n${svg}\`,\n`;
}

out += "} as const;\n";
writeFileSync("packages/chessboard/src/internal/defaultPieces.ts", out);
