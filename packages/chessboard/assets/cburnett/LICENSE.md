# Vendored piece artwork: Cburnett

The default piece set of `@plywise/chessboard` — the twelve standard SVG
chess pieces drawn by **Colin M.L. Burnett** ("Cburnett"), vendored from
Wikimedia Commons on **2026-08-23**.

- Source category: <https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard>
  (transparent variants, e.g. <https://commons.wikimedia.org/wiki/File:Chess_klt45.svg>)
- Author: Colin M.L. Burnett — <https://commons.wikimedia.org/wiki/User:Cburnett>

## License

Every file is multi-licensed by the author with "You may select the license of
your choice" (`{{self|GFDL|migration=relicense|BSD|GPL}}` plus the GFDL
relicensing update's CC BY-SA 3.0):

- GNU Free Documentation License 1.2 or later
- Creative Commons Attribution-Share Alike 3.0 Unported
- BSD 3-Clause (verified in each file's structured data)
- GNU General Public License, version 2 or later

**This package redistributes the artwork under the BSD-3-Clause option**, so no
copyleft obligation applies. Distributing this package or its artifacts requires
retaining this notice and the copyright statement below.

```
Copyright © Colin M.L. Burnett

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

## Provenance (SHA-1 as reported by the Commons API at vendoring time)

| File     | Commons title      | SHA-1                                      |
| -------- | ------------------ | ------------------------------------------ |
| `wK.svg` | `Chess klt45.svg`  | `2c7569b837971207e40f7148e2b2086aaf8e4bbd` |
| `wQ.svg` | `Chess qlt45.svg`  | `e638eb28ec25007b9f8fac8476bdf6ae1fc5a0ee` |
| `wR.svg` | `Chess rlt45.svg`  | `126b7779885b87e87acc713474587732711bc8d3` |
| `wB.svg` | `Chess blt45.svg`  | `35dd477dc22636bfcc559a01f75b00369205ffda` |
| `wN.svg` | `Chess nlt45.svg`  | `3a2253429c0e39863b3f5ecf447209dccecdc337` |
| `wP.svg` | `Chess plt45.svg`  | `09d59e2770fcee23722ac53b26e875f76d2c1eb1` |
| `bK.svg` | `Chess kdt45.svg`  | `b1165ef85a3df6f1af2549ab0af78ab21b540e8a` |
| `bQ.svg` | `Chess qdt45.svg`  | `ed72e75b7bdbf880a3c9bee053c8786cfab8bdb9` |
| `bR.svg` | `Chess rdt45.svg`  | `bd0e866f1e6da8e3d6f9c0b356b60fc58391aff6` |
| `bB.svg` | `Chess bdt45.svg`  | `da6dd1b5ef629bacebbd2ce26c7d81ba8a205587` |
| `bN.svg` | `Chess ndt45.svg`  | `3c79cbbda76bcf1d4e4062cef6dd3b58a250a562` |
| `bP.svg` | `Chess pdt45.svg`  | `0a6d2f3dc6327a02ca591bc489d701fbff228138` |

These `.svg` files are the pristine vendored copies; they are not compiled or
served directly. The renderer embeds them via the generated module
`src/internal/defaultPieces.ts`.

## Regenerating the embedded module

From the repository root:

```sh
node scripts/gen-default-pieces.mjs
```
