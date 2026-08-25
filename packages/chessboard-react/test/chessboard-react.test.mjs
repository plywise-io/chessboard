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

test("forwards lastMove and checked presentation into the imperative board", async () => {
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
  const position = new Map([
    ["e2", { color: "white", role: "pawn" }],
    ["e4", { color: "white", role: "pawn" }],
    ["e1", { color: "white", role: "king" }],
  ]);

  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        presentation: {
          lastMove: { from: "e2", to: "e4" },
          checked: "e1",
        },
      }),
    ),
  );

  assert.ok(host.querySelector('[data-mark="last-move-from"]'));
  assert.ok(host.querySelector('[data-mark="last-move-to"]'));
  assert.ok(host.querySelector('[data-mark="check"]'));

  const piece = host.querySelector('[data-square="e2"]');

  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        presentation: { lastMove: { from: "e2", to: "e4" } },
      }),
    ),
  );

  // Unrelated piece survived
  assert.equal(host.querySelector('[data-square="e2"]'), piece);
  // Check removed, lastMove preserved
  assert.equal(host.querySelector('[data-mark="check"]'), null);
  assert.ok(host.querySelector('[data-mark="last-move-from"]'));

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("forwards interaction prop and emits structured events through the latest callback", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // JSDOM has no layout; the renderer math relies on getBoundingClientRect.
  Object.defineProperty(
    dom.window.HTMLElement.prototype,
    "getBoundingClientRect",
    {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 800,
        width: 800,
        height: 800,
      }),
    },
  );

  // Standard pointer-capture surface that stock JSDOM lacks; the renderer
  // calls it on every gesture teardown.
  const capturedPointers = new WeakMap();
  dom.window.Element.prototype.setPointerCapture = function (pointerId) {
    capturedPointers.set(this, pointerId);
  };
  dom.window.Element.prototype.hasPointerCapture = function (pointerId) {
    return capturedPointers.get(this) === pointerId;
  };
  dom.window.Element.prototype.releasePointerCapture = function (pointerId) {
    if (capturedPointers.get(this) === pointerId) capturedPointers.delete(this);
  };

  const [{ act, createElement }, { createRoot }, { Chessboard }] =
    await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("../dist/index.js"),
    ]);
  const host = document.querySelector("#root");
  const root = createRoot(host);
  const position = new Map([["e2", { color: "white", role: "pawn" }]]);

  const calls = [];
  function App({ interaction }) {
    return createElement(Chessboard, { position, interaction });
  }

  function clickSquare(host, square) {
    const board = host.querySelector(".pw-board");
    const rect = board.getBoundingClientRect();
    const file = square.charCodeAt(0) - "a".charCodeAt(0);
    const rank = Number(square[1]) - 1;
    const col = file;
    const row = 7 - rank;
    const event = new dom.window.PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: rect.left + (col + 0.5) * (rect.width / 8),
      clientY: rect.top + (row + 0.5) * (rect.height / 8),
      pointerId: 1,
      isPrimary: true,
    });
    board.dispatchEvent(event);
  }

  await act(() =>
    root.render(
      createElement(App, {
        interaction: {
          destinations: new Map([["e2", ["e4"]]]),
          onEvent: (event) => calls.push(event),
        },
      }),
    ),
  );

  clickSquare(host, "e2");
  assert.deepEqual(calls, [
    { type: "select", square: "e2", origin: "pointer" },
  ]);
  const boardNode = host.querySelector(".pw-board");

  // Updating the interaction prop swaps destinations without recreating the board.
  const newCalls = [];
  await act(() =>
    root.render(
      createElement(App, {
        interaction: {
          destinations: new Map([["a2", ["a4"]]]),
          onEvent: (event) => newCalls.push(event),
        },
      }),
    ),
  );

  // The board instance is the same and the new callback owns the event.
  clickSquare(host, "a2");
  assert.deepEqual(newCalls, [
    { type: "select", square: "a2", origin: "pointer" },
  ]);
  assert.equal(host.querySelector(".pw-board"), boardNode);
  assert.equal(host.querySelector('[data-mark="selected"]'), null);

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("keeps one imperative board instance across prop updates and forwards presentation", async () => {
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
  const position = new Map([["e2", { color: "white", role: "pawn" }]]);

  await act(() => root.render(createElement(Chessboard, { position })));
  const firstBoard = host.querySelector(".pw-board");
  const firstPiece = host.querySelector('[data-square="e2"]');

  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        presentation: { selected: "e2" },
      }),
    ),
  );

  // Same DOM node, same piece node — no recreation.
  assert.equal(host.querySelector(".pw-board"), firstBoard);
  assert.equal(host.querySelector('[data-square="e2"]'), firstPiece);
  assert.ok(host.querySelector('[data-mark="selected"]'));

  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        presentation: { selected: "e2" },
        interaction: {
          destinations: new Map([["e2", ["e4"]]]),
          onEvent: () => {},
        },
      }),
    ),
  );
  assert.ok(host.querySelector('[data-mark="destination"]'));

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("forwards annotations through React and reconciles by id", async () => {
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
  const position = new Map();
  const initial = [
    { id: "a", kind: "circle", square: "e4", layer: "user" },
    { id: "b", kind: "circle", square: "d5", layer: "engine" },
  ];

  await act(() =>
    root.render(createElement(Chessboard, { position, annotations: initial })),
  );

  const layer = host.querySelector(".pw-annotations");
  assert.ok(layer, "annotation SVG layer must render");
  assert.equal(layer.tagName.toLowerCase(), "svg");
  assert.equal(layer.getAttribute("viewBox"), "0 0 8 8");
  assert.equal(layer.getAttribute("aria-hidden"), "true");
  assert.equal(layer.getAttribute("pointer-events"), "none");

  const aNode = host.querySelector('[data-annotation-id="a"]');
  const bNode = host.querySelector('[data-annotation-id="b"]');
  assert.ok(aNode && bNode);

  // Update annotations: remove a, keep b, add c with id-color update.
  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        annotations: [
          {
            id: "b",
            kind: "circle",
            square: "d5",
            layer: "engine",
            color: "#0f0",
          },
          { id: "c", kind: "arrow", from: "e2", to: "e4", layer: "user" },
        ],
      }),
    ),
  );

  assert.equal(host.querySelector('[data-annotation-id="a"]'), null);
  assert.strictEqual(host.querySelector('[data-annotation-id="b"]'), bNode);
  assert.equal(bNode.style.stroke, "rgb(0, 255, 0)");
  assert.ok(host.querySelector('[data-annotation-id="c"]'));

  const updated = [
    { id: "b", kind: "circle", square: "d5", layer: "engine", color: "#0f0" },
    { id: "c", kind: "arrow", from: "e2", to: "e4", layer: "user" },
  ];
  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        annotations: updated,
        visibleLayers: new Set(["engine"]),
      }),
    ),
  );
  assert.strictEqual(host.querySelector('[data-annotation-id="b"]'), bNode);
  assert.equal(host.querySelector('[data-annotation-id="c"]'), null);
  assert.equal(host.querySelector(".pw-annotations"), layer);

  await act(() =>
    root.render(createElement(Chessboard, { position, annotations: updated })),
  );
  assert.strictEqual(host.querySelector('[data-annotation-id="b"]'), bNode);
  assert.ok(host.querySelector('[data-annotation-id="c"]'));

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("interaction-disabled prop tears down pointer listeners without recreating the board", async () => {
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
  const position = new Map([["e2", { color: "white", role: "pawn" }]]);

  const interaction = {
    destinations: new Map([["e2", ["e4"]]]),
    onEvent: () => {},
  };

  await act(() =>
    root.render(createElement(Chessboard, { position, interaction })),
  );
  const pieceBefore = host.querySelector('[data-square="e2"]');
  assert.ok(pieceBefore);

  await act(() =>
    root.render(createElement(Chessboard, { position, interaction: null })),
  );

  // Same DOM node preserved across interaction disable.
  const pieceAfter = host.querySelector('[data-square="e2"]');
  assert.equal(pieceAfter, pieceBefore);
  assert.equal(pieceAfter.dataset.dragging, undefined);
  assert.equal(pieceAfter.style.transform, "");

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("a single-piece position change reuses the moving piece node", async () => {
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
  const pawn = { color: "white", role: "pawn" };
  const position = new Map([["e2", pawn]]);

  await act(() =>
    root.render(createElement(Chessboard, { position, orientation: "white" })),
  );
  const piece = host.querySelector('[data-square="e2"]');
  assert.ok(piece);

  // e2 -> e4 with the same piece object: one approved move, not a full
  // position replacement, so the DOM node survives the update.
  await act(() =>
    root.render(
      createElement(Chessboard, {
        position: new Map([["e4", pawn]]),
        orientation: "white",
      }),
    ),
  );
  assert.equal(host.querySelector('[data-square="e4"]'), piece);
  assert.equal(piece.style.getPropertyValue("--pw-file"), "4");
  assert.equal(piece.style.getPropertyValue("--pw-rank"), "4");

  // A two-piece replacement is arbitrary: fresh nodes, no move inference.
  const rebuilt = new Map([
    ["e4", pawn],
    ["d4", { color: "white", role: "pawn" }],
  ]);
  await act(() =>
    root.render(createElement(Chessboard, { position: rebuilt })),
  );
  assert.equal(host.querySelector('[data-square="e4"]'), piece);
  assert.notEqual(host.querySelector('[data-square="d4"]'), piece);

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("forwards pieceSet and theme props into the imperative board", async () => {
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
  const position = new Map([["e2", { color: "white", role: "king" }]]);
  const base = "https://example.com/pieces/merida/";

  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        pieceSet: base,
        theme: { light: "#ffffdd", dark: "#86a666" },
      }),
    ),
  );
  const el = host.querySelector(".pw-board");
  const king = host.querySelector('[data-square="e2"]');
  // JSDOM serializes url() values lowercased; compare case-insensitively.
  assert.equal(
    king.style.backgroundImage.toLowerCase(),
    `url("${base}wk.svg")`,
  );
  assert.equal(el.style.getPropertyValue("--pw-light-square"), "#ffffdd");
  assert.equal(el.style.getPropertyValue("--pw-dark-square"), "#86a666");

  // Switching back to glyphs keeps the same node but restores the symbol.
  await act(() =>
    root.render(createElement(Chessboard, { position, pieceSet: null })),
  );
  assert.equal(host.querySelector('[data-square="e2"]'), king);
  assert.equal(king.style.backgroundImage, "");
  assert.equal(king.textContent, "♔");

  await act(() => root.unmount());
  assert.equal(host.childElementCount, 0);
});

test("single-piece move with state updates reconciles marks once", async () => {
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
  const interaction = {
    destinations: new Map([["e2", ["e3", "e4"]]]),
    onEvent() {},
  };
  const position = new Map([
    ["e2", { color: "white", role: "pawn" }],
    ["d2", { color: "white", role: "pawn" }],
  ]);
  await act(() =>
    root.render(
      createElement(Chessboard, {
        position,
        interaction,
        presentation: { selected: "e2" },
      }),
    ),
  );
  const piece = host.querySelector('[data-square="d2"]');
  const records = [];
  const observer = new dom.window.MutationObserver((entries) =>
    records.push(...entries),
  );
  observer.observe(host, { attributes: true, childList: true, subtree: true });

  await act(() =>
    root.render(
      createElement(Chessboard, {
        position: new Map([
          ["e2", { color: "white", role: "pawn" }],
          ["d4", { color: "white", role: "pawn" }],
        ]),
        interaction: {
          destinations: new Map([["e2", ["e3", "e4"]]]),
          onEvent() {},
        },
        presentation: { selected: "e2" },
      }),
    ),
  );

  const destinationWrites = records.filter(
    (record) =>
      record.type === "attributes" &&
      record.target.hasAttribute("data-mark") &&
      record.attributeName === "data-destination",
  );
  assert.equal(destinationWrites.length, 2);
  assert.strictEqual(host.querySelector('[data-square="d4"]'), piece);
  await act(() => root.unmount());
});

test("stable-props parent re-render causes no board work", async () => {
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
  const props = {
    position: new Map([["e2", { color: "white", role: "pawn" }]]),
    interaction: {
      destinations: new Map([["e2", ["e3"]]]),
      onEvent() {},
    },
    presentation: { selected: "e2" },
  };
  await act(() => root.render(createElement(Chessboard, props)));
  const records = [];
  const observer = new dom.window.MutationObserver((entries) =>
    records.push(...entries),
  );
  observer.observe(host, { attributes: true, childList: true, subtree: true });
  await act(() => root.render(createElement(Chessboard, props)));
  assert.equal(records.length, 0);
  await act(() => root.unmount());
});

test('forwards coordinates="inside" into the imperative board', async () => {
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
  const position = new Map([["e2", { color: "white", role: "pawn" }]]);

  await act(() =>
    root.render(createElement(Chessboard, { position, coordinates: "inside" })),
  );
  assert.equal(host.querySelector(".pw-board").dataset.coordinates, "inside");
  assert.equal(host.querySelectorAll(".pw-coordinate-inside").length, 64);
  const e4 = host.querySelector('.pw-coordinate-inside[data-square="e4"]');
  assert.equal(e4?.textContent, "e4");

  await act(() => root.unmount());
});
