---
"@plywise/chessboard": minor
---

Opt-in keyboard input: `interaction.keyboard: true` switches the board's
role to `application` and exposes `tabindex="0"`. Arrow keys move a cursor
mark (`.pw-mark-cursor`, controlled by `--pw-cursor-color`), Enter / Space
emit `select` / `move` / `clear`, and Escape emits `clear` — all with
`origin: "keyboard"`. A screen-reader live region (`.pw-live`,
`aria-live="polite"`) announces the focused square and the piece on it.
