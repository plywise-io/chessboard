import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

test("mounts, updates, and removes the imperative board", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const [{ act, createElement }, { createRoot }, { Chessboard }] =
    await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("../dist/index.js"),
    ]);
  const host = document.querySelector("#root");
  const root = createRoot(host);
  const position = new Map([["a1", { color: "white", role: "rook" }]]);

  await act(() =>
    root.render(createElement(Chessboard, { position, orientation: "white" })),
  );
  const piece = host.querySelector('[data-square="a1"]');
  assert.ok(piece);
  assert.equal(piece.style.getPropertyValue("--pw-file"), "0");

  await act(() =>
    root.render(createElement(Chessboard, { position, orientation: "black" })),
  );
  assert.equal(piece.style.getPropertyValue("--pw-file"), "7");

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});
