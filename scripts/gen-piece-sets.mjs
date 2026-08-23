// Regenerates packages/chessboard/src/internal/pieceSets.gen.ts from the
// pristine vendored artwork under packages/chessboard/assets/.
// Provenance and licensing: packages/chessboard/assets/SETS.md.
import { readFileSync, writeFileSync } from "node:fs";

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
const sets = [
  ["cburnett", "cburnett"],
  ["rhosgfx", "rhosgfx"],
  ["kiwenSuwi", "kiwen-suwi"],
  ["chessnut", "chessnut"],
  ["spatial", "spatial"],
  ["celtic", "celtic"],
];

let out =
  "// Generated from packages/chessboard/assets/* — DO NOT EDIT.\n" +
  "// Regenerate with: node scripts/gen-piece-sets.mjs\n" +
  "// Licenses and provenance: see packages/chessboard/assets/SETS.md.\n\n";
out +=
  "/**\n * Raw SVG sources for the curated piece sets, keyed by `{w|b}{P,N,B,R,Q,K}`\n * piece codes. The renderer serves them to the DOM as `data:image/svg+xml`\n * URIs; no network access is involved.\n */\nexport const vendoredPieceSets = {\n";

for (const [key, dir] of sets) {
  out += `  ${key}: {\n`;
  for (const code of codes) {
    // Normalize CRLF so the generated module stays formatter-stable; the
    // vendored files themselves remain pristine.
    const svg = readFileSync(
      `packages/chessboard/assets/${dir}/${code}.svg`,
      "utf8",
    )
      .replace(/\r\n/g, "\n")
      .trim();
    if (svg.includes("`") || svg.includes("${")) {
      throw new Error(`unsafe characters in ${dir}/${code}`);
    }
    out += `    ${code}: \`\n${svg}\`,\n`;
  }
  out += "  },\n";
}
out += "};\n";
writeFileSync("packages/chessboard/src/internal/pieceSets.gen.ts", out);
