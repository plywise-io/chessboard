---
"@plywise/chessboard": patch
---

Fix drag selection and jank on WebKitGTK: add `-webkit-user-select: none` (WebKitGTK 2.52 implements only the prefixed property) and drop the decorative `filter: drop-shadow` from the dragging state, which forced software painting of pointer-following transforms.
