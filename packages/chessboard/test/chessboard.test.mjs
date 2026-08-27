import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { cburnett, createChessboard } from "../dist/index.js";

/**
 * Click a square on the board by client coordinates. JSDOM doesn't lay out,
 * so we synthesize `pointerdown` with a client rect of 800x800 starting at 0.
 */
function clickSquare(host, square, orientation = "white") {
  const board = host.querySelector(".pw-board");
  const rect = board.getBoundingClientRect();
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  const x = rect.left + (col + 0.5) * (rect.width / 8);
  const y = rect.top + (row + 0.5) * (rect.height / 8);
  const event = new host.ownerDocument.defaultView.PointerEvent("pointerdown", {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    isPrimary: true,
  });
  board.dispatchEvent(event);
}

function makeBoard(position, { interaction, presentation, ...config } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="host"></div></body></html>',
    { pretendToBeVisual: true },
  );
  // Force the bounding rect to be deterministic for click math.
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
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, {
    position,
    animationMs: 0,
    ...config,
    interaction,
    presentation,
  });
  return { host, board, dom };
}

test("renders, moves, reorients, and destroys pieces", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const position = new Map([
    ["e2", { color: "white", role: "pawn" }],
    ["e4", { color: "black", role: "pawn" }],
  ]);
  const board = createChessboard(host, { position, animationMs: 0 });
  const movingNode = host.querySelector('[data-square="e2"]');

  assert.equal(host.querySelectorAll(".pw-piece").length, 2);
  board.move("e2", "e4");
  assert.equal(host.querySelectorAll(".pw-piece").length, 1);
  assert.equal(host.querySelector('[data-square="e4"]'), movingNode);

  board.set({ orientation: "black" });
  assert.equal(movingNode.style.getPropertyValue("--pw-file"), "3");
  assert.equal(movingNode.style.getPropertyValue("--pw-rank"), "3");

  board.destroy();
  assert.equal(host.childElementCount, 0);
});

test("rejects invalid JavaScript input", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, { position: new Map() });

  assert.throws(() => board.move("z9", "e4"), /Invalid square/);
});

test("clicking a selectable square emits a select event", () => {
  const events = [];
  const interaction = {
    destinations: new Map([["e2", ["e4"]]]),
    onEvent: (event) => events.push(event),
  };
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { interaction },
  );

  clickSquare(host, "e2");

  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
  ]);
});

test("clicking a destination after selection emits a move event", () => {
  const events = [];
  const interaction = {
    destinations: new Map([["e2", ["e4"]]]),
    onEvent: (event) => events.push(event),
  };
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { interaction, presentation: { selected: "e2" } },
  );

  clickSquare(host, "e4");

  assert.deepEqual(events, [
    { type: "move", from: "e2", to: "e4", origin: "selection" },
  ]);

  // The renderer must not mutate the position; only the caller can move.
  board.destroy();
});

test("clicking the active source emits a clear event", () => {
  const events = [];
  const interaction = {
    destinations: new Map([["e2", ["e4"]]]),
    onEvent: (event) => events.push(event),
  };
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { interaction, presentation: { selected: "e2" } },
  );

  clickSquare(host, "e2");

  assert.deepEqual(events, [{ type: "clear", origin: "pointer" }]);
});

test("clicking another selectable source replaces selection", () => {
  const events = [];
  const interaction = {
    destinations: new Map([
      ["e2", ["e4"]],
      ["d2", ["d4"]],
    ]),
    onEvent: (event) => events.push(event),
  };
  const { host } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["d2", { color: "white", role: "pawn" }],
    ]),
    { interaction, presentation: { selected: "e2" } },
  );

  clickSquare(host, "d2");

  assert.deepEqual(events, [
    { type: "select", square: "d2", origin: "pointer" },
  ]);
});

test("clicking a non-selectable square emits a clear event", () => {
  const events = [];
  const interaction = {
    destinations: new Map([["e2", ["e4"]]]),
    onEvent: (event) => events.push(event),
  };
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { interaction, presentation: { selected: "e2" } },
  );

  clickSquare(host, "a1");
  assert.deepEqual(events, [{ type: "clear", origin: "pointer" }]);
});

test("selected and destination marks are rendered with semantic attributes", () => {
  const { host } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "black", role: "pawn" }],
    ]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4", "d4"]]]),
        onEvent: () => {},
      },
      presentation: { selected: "e2" },
    },
  );

  const selected = host.querySelector('[data-mark="selected"]');
  assert.equal(selected?.dataset.square, "e2");

  const destinations = host.querySelectorAll('[data-mark="destination"]');
  const bySquare = {};
  for (const node of destinations) {
    bySquare[node.getAttribute("data-square")] = node.dataset.destination;
  }
  // e4 is occupied, d4 is empty
  assert.equal(destinations.length, 2);
  assert.equal(bySquare.e4, "occupied");
  assert.equal(bySquare.d4, "empty");
});

test("rendering marks does not recreate piece nodes", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
      presentation: { selected: "e2" },
    },
  );

  const pieceBefore = host.querySelector('[data-square="e2"]');
  board.set({
    presentation: { selected: "e2" },
    interaction: {
      destinations: new Map([["e2", ["e4"]]]),
      onEvent: () => {},
    },
  });
  const pieceAfter = host.querySelector('[data-square="e2"]');
  assert.equal(pieceAfter, pieceBefore);
});

test("removing the selected square removes all marks", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
      presentation: { selected: "e2" },
    },
  );

  assert.equal(host.querySelectorAll(".pw-mark").length, 2);
  board.set({ presentation: {} });
  assert.equal(host.querySelectorAll(".pw-mark").length, 0);
});

test("disabling interaction preserves controlled selection and rejects events", () => {
  const events = [];
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (event) => events.push(event),
      },
      presentation: { selected: "e2" },
    },
  );

  board.set({ interaction: null });
  assert.equal(host.querySelectorAll('[data-mark="selected"]').length, 1);
  assert.equal(host.querySelectorAll('[data-mark="destination"]').length, 0);

  clickSquare(host, "e2");
  assert.deepEqual(events, []);
});

test("invalid interaction inputs throw TypeError", () => {
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: { destinations: "no", onEvent: () => {} },
      }),
    /interaction.destinations must be a Map/,
  );

  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map([["e2", "e4"]]),
          onEvent: () => {},
        },
      }),
    /interaction.destinations\[e2\] must be an array/,
  );

  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map([["z9", ["e4"]]]),
          onEvent: () => {},
        },
      }),
    /Invalid square/,
  );

  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: { destinations: new Map(), onEvent: "no" },
      }),
    /interaction.onEvent must be a function/,
  );

  assert.throws(
    () =>
      makeBoard(new Map(), {
        presentation: { selected: "z9" },
      }),
    /Invalid square/,
  );
});

test("callers can mutate destinations without changing renderer state", () => {
  const destinations = new Map([["e2", ["e4"]]]);
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: { destinations, onEvent: () => {} },
      presentation: { selected: "e2" },
    },
  );

  destinations.clear();
  assert.equal(
    host.querySelector('[data-mark="destination"]')?.dataset.square,
    "e4",
  );
});

test("destroy removes all mark nodes and rejects later set/move calls", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
      presentation: { selected: "e2" },
    },
  );

  board.destroy();
  assert.equal(host.querySelectorAll(".pw-mark").length, 0);
  assert.throws(
    () => board.set({ presentation: { selected: "e2" } }),
    /destroyed/,
  );
  assert.throws(() => board.move("e2", "e4"), /destroyed/);
  board.destroy();
});

test("calls after destruction fail consistently", () => {
  const { board } = makeBoard(new Map());
  board.destroy();
  board.destroy();
  assert.throws(() => board.set({}), /destroyed/);
  assert.throws(() => board.move("e1", "e2"), /destroyed/);
});

test("lastMove and checked render as semantic marks", () => {
  const { host } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "white", role: "pawn" }],
      ["e1", { color: "white", role: "king" }],
    ]),
    {
      presentation: {
        lastMove: { from: "e2", to: "e4" },
        checked: "e1",
      },
    },
  );

  const from = host.querySelector('[data-mark="last-move-from"]');
  const to = host.querySelector('[data-mark="last-move-to"]');
  const check = host.querySelector('[data-mark="check"]');

  assert.ok(from, "last-move-from mark rendered");
  assert.ok(to, "last-move-to mark rendered");
  assert.ok(check, "check mark rendered");

  // Last-move and check marks must not carry data-destination; only destination marks do.
  assert.equal(from.getAttribute("data-destination"), null);
  assert.equal(to.getAttribute("data-destination"), null);
  assert.equal(check.getAttribute("data-destination"), null);
});

test("lastMove marks follow orientation", () => {
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "white", role: "pawn" }],
    ]),
    { presentation: { lastMove: { from: "e2", to: "e4" } } },
  );

  const fromNode = host.querySelector('[data-mark="last-move-from"]');
  const toNode = host.querySelector('[data-mark="last-move-to"]');
  // e2/e4 under white: file 4, rows 6/4.
  assert.equal(fromNode.style.getPropertyValue("--pw-file"), "4");
  assert.equal(fromNode.style.getPropertyValue("--pw-rank"), "6");
  assert.equal(toNode.style.getPropertyValue("--pw-file"), "4");
  assert.equal(toNode.style.getPropertyValue("--pw-rank"), "4");

  board.set({ orientation: "black" });
  // Black mirrors both axes: file 3, rows 1/3.
  assert.equal(fromNode.style.getPropertyValue("--pw-file"), "3");
  assert.equal(fromNode.style.getPropertyValue("--pw-rank"), "1");
  assert.equal(toNode.style.getPropertyValue("--pw-file"), "3");
  assert.equal(toNode.style.getPropertyValue("--pw-rank"), "3");
});

test("updating presentation only affects changed mark nodes", () => {
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "white", role: "pawn" }],
      ["e1", { color: "white", role: "king" }],
    ]),
    {
      presentation: {
        lastMove: { from: "e2", to: "e4" },
        checked: "e1",
      },
    },
  );

  const pieceE2 = host.querySelector('[data-square="e2"]');
  const pieceE4 = host.querySelector('[data-square="e4"]');
  const pieceE1 = host.querySelector('[data-square="e1"]');
  const fromNode = host.querySelector('[data-mark="last-move-from"]');

  board.set({ presentation: { lastMove: { from: "e2", to: "e4" } } });

  assert.equal(host.querySelector('[data-square="e2"]'), pieceE2);
  assert.equal(host.querySelector('[data-square="e4"]'), pieceE4);
  assert.equal(host.querySelector('[data-square="e1"]'), pieceE1);
  // Unrelated mark preserved.
  assert.equal(host.querySelector('[data-mark="last-move-from"]'), fromNode);
  // Check mark removed.
  assert.equal(host.querySelector('[data-mark="check"]'), null);
});

test("clearing presentation removes lastMove and checked marks", () => {
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "white", role: "pawn" }],
      ["e1", { color: "white", role: "king" }],
    ]),
    {
      presentation: {
        lastMove: { from: "e2", to: "e4" },
        checked: "e1",
      },
    },
  );

  assert.equal(host.querySelectorAll('[data-mark="last-move-from"]').length, 1);
  assert.equal(host.querySelectorAll('[data-mark="last-move-to"]').length, 1);
  assert.equal(host.querySelectorAll('[data-mark="check"]').length, 1);

  board.set({ presentation: {} });
  assert.equal(host.querySelectorAll('[data-mark="last-move-from"]').length, 0);
  assert.equal(host.querySelectorAll('[data-mark="last-move-to"]').length, 0);
  assert.equal(host.querySelectorAll('[data-mark="check"]').length, 0);
});

test("invalid presentation values throw TypeError", () => {
  assert.throws(
    () => makeBoard(new Map(), { presentation: { lastMove: "no" } }),
    /presentation.lastMove must be an object/,
  );
  assert.throws(
    () =>
      makeBoard(new Map(), {
        presentation: { lastMove: { from: "z9", to: "e4" } },
      }),
    /Invalid square/,
  );
  assert.throws(
    () =>
      makeBoard(new Map(), {
        presentation: { lastMove: { from: "e2", to: "z9" } },
      }),
    /Invalid square/,
  );
  assert.throws(
    () => makeBoard(new Map(), { presentation: { checked: "z9" } }),
    /Invalid square/,
  );
});

test("lastMove and checked survive an approved move", () => {
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e1", { color: "white", role: "king" }],
    ]),
    {
      presentation: {
        lastMove: { from: "d2", to: "d4" },
        checked: "e1",
      },
    },
  );

  board.move("e2", "e4");
  assert.equal(host.querySelectorAll('[data-mark="last-move-from"]').length, 1);
  assert.equal(host.querySelectorAll('[data-mark="check"]').length, 1);
});

// Slice-04: keyed arrow and circle annotations
test("annotations render one SVG layer with semantic attributes and stable geometry", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const position = new Map([["e2", { color: "white", role: "pawn" }]]);
  const annotations = [
    {
      id: "a",
      kind: "arrow",
      from: "e2",
      to: "e4",
      layer: "user",
      color: "#15781B",
    },
    { id: "c", kind: "circle", square: "d5", layer: "engine" },
  ];
  const board = createChessboard(host, {
    position,
    animationMs: 0,
    annotations,
  });

  const layer = host.querySelector(".pw-annotations");
  assert.ok(layer, "annotation layer must exist");
  assert.equal(layer.tagName.toLowerCase(), "svg");
  assert.equal(layer.getAttribute("viewBox"), "0 0 8 8");
  assert.equal(layer.getAttribute("aria-hidden"), "true");
  assert.equal(layer.getAttribute("pointer-events"), "none");

  const arrow = host.querySelector('[data-annotation-id="a"]');
  assert.ok(arrow);
  assert.equal(arrow.getAttribute("data-annotation-kind"), "arrow");
  assert.equal(arrow.getAttribute("data-annotation-layer"), "user");
  assert.equal(arrow.style.stroke, "rgb(21, 120, 27)");
  // e2 -> e4 with white orientation: e file index 4, rank 2 -> file 4, row 6
  // SVG path centers at square centers (add 0.5)
  assert.equal(
    arrow.getAttribute("d"),
    "M 4.5 6.5 L 4.5 4.5 M 4.320 4.850 L 4.5 4.5 L 4.680 4.850",
  );

  const circle = host.querySelector('[data-annotation-id="c"]');
  assert.ok(circle);
  assert.equal(circle.tagName.toLowerCase(), "circle");
  assert.equal(circle.getAttribute("cx"), "3.5");
  assert.equal(circle.getAttribute("cy"), "3.5");
  // Default color: no inline stroke when caller omits color
  assert.equal(circle.style.stroke, "");

  board.destroy();
});

test("annotations reconcile by id; reorder/update/removal preserve unaffected nodes", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, {
    position: new Map(),
    animationMs: 0,
    annotations: [
      { id: "a", kind: "circle", square: "a1", layer: "user" },
      { id: "b", kind: "circle", square: "b1", layer: "user" },
      { id: "c", kind: "circle", square: "c1", layer: "user" },
    ],
  });

  const aNode = host.querySelector('[data-annotation-id="a"]');
  const bNode = host.querySelector('[data-annotation-id="b"]');
  const cNode = host.querySelector('[data-annotation-id="c"]');
  assert.ok(aNode && bNode && cNode);

  // Update with same ids, reordered and one color changed, one removed
  board.set({
    annotations: [
      { id: "c", kind: "circle", square: "c1", layer: "user", color: "#ff0" },
      { id: "a", kind: "circle", square: "a1", layer: "user" },
    ],
  });

  assert.strictEqual(host.querySelector('[data-annotation-id="a"]'), aNode);
  assert.strictEqual(host.querySelector('[data-annotation-id="b"]'), null);
  assert.strictEqual(host.querySelector('[data-annotation-id="c"]'), cNode);
  assert.equal(cNode.style.stroke, "rgb(255, 255, 0)");

  board.destroy();
});

test("orientation change recalculates annotation geometry without recreating nodes", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, {
    position: new Map(),
    animationMs: 0,
    annotations: [
      { id: "x", kind: "arrow", from: "a1", to: "h8", layer: "user" },
    ],
  });
  const arrow = host.querySelector('[data-annotation-id="x"]');
  // White orientation: a1 (0,7) to h8 (7,0) -> center (0.5, 7.5) to (7.5, 0.5)
  assert.match(arrow.getAttribute("d"), /^M 0\.5 7\.5 L 7\.5 0\.5 M /);

  board.set({ orientation: "black" });
  assert.match(arrow.getAttribute("d"), /^M 7\.5 0\.5 L 0\.5 7\.5 M /);
  assert.strictEqual(host.querySelector('[data-annotation-id="x"]'), arrow);

  board.destroy();
});

test("annotations validate inputs atomically and copy values", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, { position: new Map(), animationMs: 0 });
  const before = host.querySelector(".pw-annotations").childNodes.length;

  assert.throws(
    () =>
      board.set({
        annotations: [
          { id: "x", kind: "arrow", from: "a1", to: "a2", layer: "user" },
          { id: "x", kind: "circle", square: "h8", layer: "engine" },
        ],
      }),
    /Duplicate annotation id/,
  );
  // No partial render: rejected set must not append nodes
  assert.equal(host.querySelector(".pw-annotations").childNodes.length, before);

  assert.throws(
    () =>
      board.set({
        annotations: [{ id: "bad", kind: "quad", square: "e4", layer: "user" }],
      }),
    /kind must be/,
  );

  // Valid update renders
  board.set({
    annotations: [{ id: "ok", kind: "circle", square: "e4", layer: "user" }],
  });
  const node = host.querySelector('[data-annotation-id="ok"]');
  assert.ok(node);

  // Input mutation isolation: mutating the source array after a set must not
  // affect rendered state.
  const arr = [{ id: "iso", kind: "circle", square: "a1", layer: "user" }];
  board.set({ annotations: arr });
  arr.length = 0;
  arr.push({ id: "iso", kind: "circle", square: "h8", layer: "user" });
  const isoNode = host.querySelector('[data-annotation-id="iso"]');
  assert.equal(isoNode.getAttribute("cy"), "7.5"); // a1 center, not h8

  board.destroy();
});

test("annotation rejects invalid squares, kinds, and layers", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  assert.throws(
    () =>
      createChessboard(host, {
        position: new Map(),
        animationMs: 0,
        annotations: [
          { id: "x", kind: "arrow", from: "z9", to: "a1", layer: "user" },
        ],
      }),
    /Invalid square/,
  );
  assert.throws(
    () =>
      createChessboard(host, {
        position: new Map(),
        animationMs: 0,
        annotations: [{ id: "x", kind: "circle", square: "e4", layer: "" }],
      }),
    /layer must be/,
  );
  assert.throws(
    () =>
      createChessboard(host, {
        position: new Map(),
        animationMs: 0,
        annotations: [{ id: "", kind: "circle", square: "e4", layer: "user" }],
      }),
    /id must be/,
  );
  assert.throws(
    () =>
      createChessboard(host, {
        position: new Map(),
        animationMs: 0,
        annotations: "not-an-array",
      }),
    /annotations must be an array/,
  );
});

test("annotation lifecycle and set-after-destroy", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, {
    position: new Map(),
    animationMs: 0,
    annotations: [{ id: "a", kind: "circle", square: "e4", layer: "user" }],
  });
  assert.ok(host.querySelector('[data-annotation-id="a"]'));
  board.destroy();
  assert.equal(host.childElementCount, 0);
  assert.throws(
    () =>
      board.set({
        annotations: [{ id: "b", kind: "circle", square: "e4", layer: "user" }],
      }),
    /destroyed/,
  );
});

function makeMarkedBoard() {
  return makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["d2", { color: "white", role: "pawn" }],
    ]),
    {
      interaction: {
        destinations: new Map([["e2", ["e3", "e4"]]]),
        onEvent() {},
      },
      presentation: { selected: "e2" },
    },
  );
}

function destinationWrites(observer) {
  return observer
    .takeRecords()
    .filter(
      (record) =>
        record.type === "attributes" &&
        record.target.hasAttribute("data-mark") &&
        record.attributeName === "data-destination",
    );
}

test("move with update reconciles marks once", () => {
  const { host, board, dom } = makeMarkedBoard();
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(host, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeOldValue: true,
  });

  board.move("d2", "d4", {
    interaction: {
      destinations: new Map([["e2", ["e3", "e4"]]]),
      onEvent() {},
    },
    presentation: { selected: "e2" },
  });

  assert.equal(destinationWrites(observer).length, 2);
  assert.equal(host.querySelector('[data-square="d4"]')?.dataset.square, "d4");
  assert.equal(host.querySelectorAll(".pw-mark").length, 3);
});

test("set with position, interaction and presentation reconciles marks once", () => {
  const { host, board, dom } = makeMarkedBoard();
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(host, { attributes: true, childList: true, subtree: true });

  board.set({
    position: new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["d4", { color: "white", role: "pawn" }],
    ]),
    interaction: {
      destinations: new Map([["e2", ["e3", "e4"]]]),
      onEvent() {},
    },
    presentation: { selected: "e2" },
  });

  assert.equal(destinationWrites(observer).length, 2);
});

test("two-argument move still renders marks", () => {
  const { host, board, dom } = makeMarkedBoard();
  const observer = new dom.window.MutationObserver(() => {});
  observer.observe(host, { attributes: true, childList: true, subtree: true });

  board.move("d2", "d4");

  assert.equal(destinationWrites(observer).length, 2);
  assert.deepEqual(
    [...host.querySelectorAll('[data-mark="destination"]')].map(
      (node) => node.dataset.destination,
    ),
    ["empty", "empty"],
  );
});

test("move update rejects position and invalid fields atomically", () => {
  const { host, board } = makeMarkedBoard();
  assert.throws(
    () => board.move("d2", "d4", { position: new Map() }),
    /position/,
  );
  assert.throws(
    () => board.move("d2", "d4", { annotations: "nope" }),
    TypeError,
  );
  assert.equal(host.querySelector('[data-square="d2"]')?.dataset.square, "d2");
});

test("move with equal squares applies update only", () => {
  const { host, board } = makeMarkedBoard();
  board.move("e2", "e2", {
    presentation: { lastMove: { from: "d2", to: "d4" } },
  });
  assert.equal(host.querySelectorAll('[data-mark="last-move-from"]').length, 1);
  assert.equal(host.querySelectorAll('[data-mark="last-move-to"]').length, 1);
  assert.equal(host.querySelector('[data-square="d2"]')?.dataset.square, "d2");
});

function countAnnotationWrites(dom, callback) {
  const original = dom.window.Element.prototype.setAttribute;
  const writes = [];
  dom.window.Element.prototype.setAttribute = function (...args) {
    if (this.closest(".pw-annotations")) writes.push(this);
    return original.apply(this, args);
  };
  try {
    callback();
  } finally {
    dom.window.Element.prototype.setAttribute = original;
  }
  return writes;
}

test("structurally equal annotations produce zero SVG writes", () => {
  const annotations = [
    { id: "a", kind: "arrow", from: "e2", to: "e4", layer: "user" },
    { id: "b", kind: "circle", square: "d4", layer: "user", color: "#f00" },
    { id: "c", kind: "circle", square: "c3", layer: "engine" },
  ];
  const { host, board, dom } = makeBoard(new Map(), { annotations });
  const nodes = annotations.map((annotation) =>
    host.querySelector(`[data-annotation-id="${annotation.id}"]`),
  );
  const writes = countAnnotationWrites(dom, () =>
    board.set({
      annotations: annotations.map((annotation) => ({ ...annotation })),
    }),
  );
  assert.equal(writes.length, 0);
  for (const [index, annotation] of annotations.entries()) {
    assert.strictEqual(
      host.querySelector(`[data-annotation-id="${annotation.id}"]`),
      nodes[index],
    );
  }
});

test("annotation metadata-only changes produce zero SVG writes", () => {
  const annotations = [
    {
      id: "engine",
      kind: "arrow",
      from: "e2",
      to: "e4",
      layer: "engine",
      metadata: { score: 1 },
    },
  ];
  const { board, dom } = makeBoard(new Map(), { annotations });
  const writes = countAnnotationWrites(dom, () =>
    board.set({
      annotations: [{ ...annotations[0], metadata: { score: 1.2 } }],
    }),
  );
  assert.equal(writes.length, 0);
});

test("one changed annotation writes only its node", () => {
  const annotations = [
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `user-${index}`,
      kind: "circle",
      square: "a1",
      layer: "user",
    })),
    {
      id: "engine",
      kind: "arrow",
      from: "e2",
      to: "e4",
      layer: "engine",
      color: "#0f0",
    },
  ];
  const { host, board, dom } = makeBoard(new Map(), { annotations });
  const nodes = new Map(
    annotations.map((annotation) => [
      annotation.id,
      host.querySelector(`[data-annotation-id="${annotation.id}"]`),
    ]),
  );
  const writes = countAnnotationWrites(dom, () =>
    board.set({
      annotations: annotations.map((annotation) =>
        annotation.id === "engine"
          ? { ...annotation, color: "#f00" }
          : { ...annotation },
      ),
    }),
  );
  assert.ok(writes.length > 0);
  assert.equal(
    writes.every(
      (node) => node.getAttribute("data-annotation-id") === "engine",
    ),
    true,
  );
  for (const [id, node] of nodes) {
    assert.strictEqual(
      host.querySelector(`[data-annotation-id="${id}"]`),
      node,
    );
  }
});

// Slice-02: pointer drag-to-move
function dispatchPointer(
  host,
  type,
  square,
  {
    orientation = "white",
    pointerId = 1,
    pointerType = "mouse",
    isPrimary = true,
    outside = false,
    button = 0,
    modifiers = {},
  } = {},
) {
  const board = host.querySelector(".pw-board");
  const rect = board.getBoundingClientRect();
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  let x = rect.left + (col + 0.5) * (rect.width / 8);
  let y = rect.top + (row + 0.5) * (rect.height / 8);
  if (outside) {
    x = rect.left - 10;
    y = rect.top - 10;
  }
  const event = new host.ownerDocument.defaultView.PointerEvent(type, {
    bubbles: true,
    button,
    clientX: x,
    clientY: y,
    pointerId,
    pointerType,
    isPrimary,
    ctrlKey: Boolean(modifiers.ctrl),
    shiftKey: Boolean(modifiers.shift),
    altKey: Boolean(modifiers.alt),
    metaKey: Boolean(modifiers.meta),
  });
  board.dispatchEvent(event);
  return event;
}

function flushRaf() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

test("dragging a selectable piece onto an allowed destination emits a drag-origin move intention", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  const piece = host.querySelector('[data-square="e2"]');
  assert.equal(piece.classList.contains("pw-piece-dragging"), true);
  assert.equal(piece.dataset.dragging, "true");
  assert.match(piece.style.transform, /^translate3d\(/);
  dispatchPointer(host, "pointerup", "e4");
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
    { type: "move", from: "e2", to: "e4", origin: "drag" },
  ]);
  // After drop the inline transform/transition must be cleared so the
  // stylesheet's controlled transform takes over.
  assert.equal(piece.style.transform, "");
  assert.equal(piece.style.transition, "");
  assert.equal(piece.classList.contains("pw-piece-dragging"), false);
});

test("dropping on a non-allowed destination emits no move intention and restores the piece", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  dispatchPointer(host, "pointerup", "d4"); // not in destinations
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
  ]);
  const piece = host.querySelector('[data-square="e2"]');
  assert.equal(piece.style.transform, "");
  assert.equal(piece.dataset.dragging, undefined);
});

test("dropping outside the board restores the piece without emitting a move", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  dispatchPointer(host, "pointerup", "e2", { outside: true });
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
  ]);
  const piece = host.querySelector('[data-square="e2"]');
  assert.equal(piece.style.transform, "");
});

test("dropping on the drag source emits no move intention", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  dispatchPointer(host, "pointerup", "e2");
  assert.equal(
    events.some((e) => e.type === "move"),
    false,
  );
});

test("pointercancel clears the drag visual without emitting a move", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  dispatchPointer(host, "pointercancel", "e3");
  assert.equal(
    events.some((e) => e.type === "move"),
    false,
  );
  const piece = host.querySelector('[data-square="e2"]');
  assert.equal(piece.classList.contains("pw-piece-dragging"), false);
  assert.equal(piece.style.transform, "");
});

test("non-primary pointers are ignored", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2", {
    pointerId: 2,
    isPrimary: false,
  });
  assert.deepEqual(events, []);
});

test("drag visual coordinates respect black orientation", async () => {
  const events = [];
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  board.set({ orientation: "black" });
  dispatchPointer(host, "pointerdown", "e2", { orientation: "black" });
  dispatchPointer(host, "pointermove", "e3", { orientation: "black" });
  await flushRaf();
  dispatchPointer(host, "pointerup", "e4", { orientation: "black" });
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
    { type: "move", from: "e2", to: "e4", origin: "drag" },
  ]);
});

test("touch-typed pointer events drive the same drag path", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2", { pointerType: "touch" });
  dispatchPointer(host, "pointermove", "e3", { pointerType: "touch" });
  await flushRaf();
  dispatchPointer(host, "pointerup", "e4", { pointerType: "touch" });
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
    { type: "move", from: "e2", to: "e4", origin: "drag" },
  ]);
});

test("disabling interaction mid-drag clears the drag visual and stops further events", async () => {
  const events = [];
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  board.set({ interaction: null });
  const piece = host.querySelector('[data-square="e2"]');
  assert.equal(piece.classList.contains("pw-piece-dragging"), false);
  assert.equal(piece.style.transform, "");
  dispatchPointer(host, "pointerup", "e4");
  // No move emitted after disablement.
  assert.equal(
    events.some((e) => e.type === "move"),
    false,
  );
});

test("drag continues when the pointer leaves the board bounds", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e2", { outside: true });
  await flushRaf();
  // Return and drop on a valid destination — capture should still be ours.
  dispatchPointer(host, "pointermove", "e4");
  await flushRaf();
  dispatchPointer(host, "pointerup", "e4");
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
    { type: "move", from: "e2", to: "e4", origin: "drag" },
  ]);
});

test("a single pointermove drives coalesced frame updates", async () => {
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  dispatchPointer(host, "pointermove", "e3");
  dispatchPointer(host, "pointermove", "e4");
  await flushRaf();
  const piece = host.querySelector('[data-square="e2"]');
  assert.match(piece.style.transform, /^translate3d\(/);
});

test("caller-approved move clears any in-flight drag visual on the moved piece", async () => {
  const events = [];
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  // Caller approves by calling move() directly (simulating game-state update).
  board.move("e2", "e4");
  const piece = host.querySelector('[data-square="e4"]');
  assert.equal(piece.style.transform, "");
  assert.equal(piece.style.transition, "");
  assert.equal(piece.classList.contains("pw-piece-dragging"), false);
  // Drag should be considered ended.
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
  ]);
});

test("destroy during an active drag clears transient state and removes listeners", async () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();
  board.destroy();
  assert.equal(host.querySelector(".pw-piece-dragging"), null);
  // Subsequent destroy remains idempotent.
  board.destroy();
});

test("annotation layers toggle independently and preserve unaffected nodes", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const visible = new Set(["user"]);
  const board = createChessboard(host, {
    position: new Map([["e2", { color: "white", role: "pawn" }]]),
    annotations: [
      { id: "user", kind: "circle", square: "e4", layer: "user" },
      { id: "engine", kind: "circle", square: "d5", layer: "engine" },
    ],
    visibleLayers: visible,
  });
  const layer = host.querySelector(".pw-annotations");
  const piece = host.querySelector('.pw-piece[data-square="e2"]');
  const user = host.querySelector('[data-annotation-id="user"]');

  visible.add("engine");
  assert.equal(host.querySelector('[data-annotation-id="engine"]'), null);

  board.set({ visibleLayers: new Set(["user", "engine"]) });
  const engine = host.querySelector('[data-annotation-id="engine"]');
  assert.equal(host.querySelector('[data-annotation-id="user"]'), user);

  board.set({ visibleLayers: new Set(["engine"]) });
  assert.equal(host.querySelector('[data-annotation-id="user"]'), null);
  assert.equal(host.querySelector('[data-annotation-id="engine"]'), engine);
  assert.equal(host.querySelector(".pw-annotations"), layer);
  assert.equal(host.querySelector('.pw-piece[data-square="e2"]'), piece);

  board.set({ visibleLayers: null });
  assert.ok(host.querySelector('[data-annotation-id="user"]'));
  assert.equal(host.querySelector('[data-annotation-id="engine"]'), engine);
});

test("annotation metadata accepts only copied JSON-compatible values", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const board = createChessboard(host, {
    position: new Map(),
    annotations: [
      {
        id: "valid",
        kind: "circle",
        square: "e4",
        layer: "engine",
        metadata: { score: 0.4, tags: ["candidate", null] },
      },
    ],
  });
  const valid = host.querySelector('[data-annotation-id="valid"]');
  const cyclic = {};
  cyclic.self = cyclic;

  for (const metadata of [cyclic, { run: () => {} }, { score: Number.NaN }]) {
    assert.throws(
      () =>
        board.set({
          annotations: [
            {
              id: "invalid",
              kind: "circle",
              square: "d5",
              layer: "engine",
              metadata,
            },
          ],
        }),
      TypeError,
    );
    assert.equal(host.querySelector('[data-annotation-id="valid"]'), valid);
  }
  assert.throws(() => board.set({ visibleLayers: ["engine"] }), TypeError);
  assert.equal(host.querySelector('[data-annotation-id="valid"]'), valid);
});

// Right-button annotation gestures
function dispatchContextMenu(host, square) {
  const board = host.querySelector(".pw-board");
  const rect = board.getBoundingClientRect();
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const event = new host.ownerDocument.defaultView.MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + (file + 0.5) * (rect.width / 8),
    clientY: rect.top + (7 - rank + 0.5) * (rect.height / 8),
  });
  board.dispatchEvent(event);
  return event;
}

test("right-clicking a square emits a circle intent and prevents the context menu", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "d5", { button: 2 });
  dispatchPointer(host, "pointerup", "d5", { button: 2 });
  assert.deepEqual(events, [
    { type: "circle", square: "d5", origin: "pointer" },
  ]);
  assert.equal(host.querySelector('[data-annotation-id="pw-preview"]'), null);
  const menu = dispatchContextMenu(host, "d5");
  assert.equal(menu.defaultPrevented, true);
});

test("right-dragging between squares emits an arrow intent with a transient preview", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2", { button: 2 });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.getAttribute("data-annotation-kind"), "circle");
  dispatchPointer(host, "pointermove", "e4", { button: 2 });
  await flushRaf();
  // Circle → arrow swaps the SVG element; re-query for the new node.
  const arrowPreview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.equal(arrowPreview?.getAttribute("data-annotation-kind"), "arrow");
  dispatchPointer(host, "pointerup", "e4", { button: 2 });
  assert.deepEqual(events, [
    { type: "arrow", from: "e2", to: "e4", origin: "pointer" },
  ]);
  assert.equal(host.querySelector('[data-annotation-id="pw-preview"]'), null);
});

test("right-dragging back onto the source square emits a circle intent", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2", { button: 2 });
  dispatchPointer(host, "pointermove", "e4", { button: 2 });
  dispatchPointer(host, "pointermove", "e2", { button: 2 });
  dispatchPointer(host, "pointerup", "e2", { button: 2 });
  assert.deepEqual(events, [
    { type: "circle", square: "e2", origin: "pointer" },
  ]);
});

test("pointercancel during a draw gesture emits nothing and removes the preview", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2", { button: 2 });
  dispatchPointer(host, "pointermove", "e4", { button: 2 });
  dispatchPointer(host, "pointercancel", "e4", { button: 2 });
  assert.deepEqual(events, []);
  assert.equal(host.querySelector('[data-annotation-id="pw-preview"]'), null);
});

test("right-button gestures are inert without interaction and keep the context menu", () => {
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
  );
  dispatchPointer(host, "pointerdown", "d5", { button: 2 });
  dispatchPointer(host, "pointerup", "d5", { button: 2 });
  assert.equal(host.querySelector('[data-annotation-id="pw-preview"]'), null);
  const menu = dispatchContextMenu(host, "d5");
  assert.equal(menu.defaultPrevented, false);
});

test("left-click selection still works after right-button gestures", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "d5", { button: 2 });
  dispatchPointer(host, "pointerup", "d5", { button: 2 });
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointerup", "e2");
  assert.deepEqual(events, [
    { type: "circle", square: "d5", origin: "pointer" },
    { type: "select", square: "e2", origin: "pointer" },
  ]);
});
// Modifier-colored annotation gestures

test("right-click with no annotationGestures keeps the existing event shape", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      onEvent: (e) => events.push(e),
    },
  });
  dispatchPointer(host, "pointerdown", "d5", { button: 2 });
  dispatchPointer(host, "pointerup", "d5", { button: 2 });
  assert.equal(events.length, 1);
  // Event must NOT carry a `color` property at all (not `color: undefined`).
  assert.ok(!("color" in events[0]));
  assert.deepEqual(Object.keys(events[0]).sort(), ["origin", "square", "type"]);
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.equal(preview, null);
});

test("configured plain binding colors the preview and emitted circle", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [{ color: "rgb(255, 0, 0)" }],
      onEvent: (e) => events.push(e),
    },
  });
  dispatchPointer(host, "pointerdown", "d5", { button: 2 });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.style.stroke, "rgb(255, 0, 0)");
  dispatchPointer(host, "pointerup", "d5", { button: 2 });
  assert.deepEqual(events, [
    {
      type: "circle",
      square: "d5",
      origin: "pointer",
      color: "rgb(255, 0, 0)",
    },
  ]);
});

test("configured plain binding only matches gestures with no modifiers", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [{ color: "rgb(255, 0, 0)" }],
      onEvent: (e) => events.push(e),
    },
  });
  // Shift held — plain binding does not match.
  dispatchPointer(host, "pointerdown", "d5", {
    button: 2,
    modifiers: { shift: true },
  });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.style.stroke, "");
  dispatchPointer(host, "pointerup", "d5", {
    button: 2,
    modifiers: { shift: true },
  });
  assert.equal(events.length, 1);
  assert.ok(!("color" in events[0]));
});

test("Shift binding colors preview and event only when Shift is held", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [{ modifiers: ["shift"], color: "rgb(0, 0, 255)" }],
      onEvent: (e) => events.push(e),
    },
  });
  // No modifier — Shift binding does not match.
  dispatchPointer(host, "pointerdown", "d5", { button: 2 });
  dispatchPointer(host, "pointerup", "d5", { button: 2 });
  assert.equal(events.length, 1);
  assert.ok(!("color" in events[0]));

  // Shift held — binding matches.
  dispatchPointer(host, "pointerdown", "e4", {
    button: 2,
    modifiers: { shift: true },
  });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.style.stroke, "rgb(0, 0, 255)");
  dispatchPointer(host, "pointerup", "e4", {
    button: 2,
    modifiers: { shift: true },
  });
  assert.deepEqual(events.slice(1), [
    {
      type: "circle",
      square: "e4",
      origin: "pointer",
      color: "rgb(0, 0, 255)",
    },
  ]);
});

test("Shift binding does not match Ctrl+Shift (exact set)", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [{ modifiers: ["shift"], color: "rgb(0, 0, 255)" }],
      onEvent: (e) => events.push(e),
    },
  });
  dispatchPointer(host, "pointerdown", "d5", {
    button: 2,
    modifiers: { ctrl: true, shift: true },
  });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.style.stroke, "");
  dispatchPointer(host, "pointerup", "d5", {
    button: 2,
    modifiers: { ctrl: true, shift: true },
  });
  assert.equal(events.length, 1);
  assert.ok(!("color" in events[0]));
});

test("Ctrl+Shift binding matches only when both modifiers are held", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [
        { modifiers: ["ctrl", "shift"], color: "rgb(0, 200, 0)" },
      ],
      onEvent: (e) => events.push(e),
    },
  });
  // Shift alone — binding does not match.
  dispatchPointer(host, "pointerdown", "d5", {
    button: 2,
    modifiers: { shift: true },
  });
  dispatchPointer(host, "pointerup", "d5", {
    button: 2,
    modifiers: { shift: true },
  });
  assert.equal(events.length, 1);
  assert.ok(!("color" in events[0]));

  // Ctrl+Shift — binding matches.
  dispatchPointer(host, "pointerdown", "e4", {
    button: 2,
    modifiers: { ctrl: true, shift: true },
  });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.style.stroke, "rgb(0, 200, 0)");
  dispatchPointer(host, "pointerup", "e4", {
    button: 2,
    modifiers: { ctrl: true, shift: true },
  });
  assert.deepEqual(events.slice(1), [
    {
      type: "circle",
      square: "e4",
      origin: "pointer",
      color: "rgb(0, 200, 0)",
    },
  ]);
});

test("arrow gesture also resolves color from the configured binding", async () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [{ modifiers: ["shift"], color: "rgb(0, 0, 255)" }],
      onEvent: (e) => events.push(e),
    },
  });
  dispatchPointer(host, "pointerdown", "e2", {
    button: 2,
    modifiers: { shift: true },
  });
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(preview);
  assert.equal(preview.style.stroke, "rgb(0, 0, 255)");
  dispatchPointer(host, "pointermove", "e4", {
    button: 2,
    modifiers: { shift: true },
  });
  await flushRaf();
  const arrowPreview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.equal(arrowPreview?.getAttribute("data-annotation-kind"), "arrow");
  assert.equal(arrowPreview.style.stroke, "rgb(0, 0, 255)");
  dispatchPointer(host, "pointerup", "e4", {
    button: 2,
    modifiers: { shift: true },
  });
  assert.deepEqual(events, [
    {
      type: "arrow",
      from: "e2",
      to: "e4",
      origin: "pointer",
      color: "rgb(0, 0, 255)",
    },
  ]);
});

test("color is snapshotted on pointerdown and survives modifier changes", async () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      annotationGestures: [{ modifiers: ["shift"], color: "rgb(0, 0, 255)" }],
      onEvent: (e) => events.push(e),
    },
  });
  // pointerdown with Shift — color captured.
  dispatchPointer(host, "pointerdown", "e2", {
    button: 2,
    modifiers: { shift: true },
  });
  const circlePreview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.ok(circlePreview);
  assert.equal(circlePreview.style.stroke, "rgb(0, 0, 255)");
  // pointermove WITHOUT Shift — preview must still show the snapped color.
  dispatchPointer(host, "pointermove", "e4", { button: 2 });
  await flushRaf();
  const arrowPreview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.equal(arrowPreview?.getAttribute("data-annotation-kind"), "arrow");
  assert.equal(arrowPreview.style.stroke, "rgb(0, 0, 255)");
  // pointerup without Shift — event still carries the snapshotted color.
  dispatchPointer(host, "pointerup", "e4", { button: 2 });
  assert.deepEqual(events, [
    {
      type: "arrow",
      from: "e2",
      to: "e4",
      origin: "pointer",
      color: "rgb(0, 0, 255)",
    },
  ]);
});

test("annotationGestures rejects malformed configurations", () => {
  // Top-level must be an array.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: "nope",
          onEvent: () => {},
        },
      }),
    /annotationGestures must be an array/,
  );

  // Entry must be an object.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: [null],
          onEvent: () => {},
        },
      }),
    /annotationGestures\[0\] must be an object/,
  );

  // Modifier must be one of the allowed names.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: [{ modifiers: ["super"], color: "red" }],
          onEvent: () => {},
        },
      }),
    /modifiers\[0\] must be one of/,
  );

  // Inherited Object.prototype keys are not modifier names.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: [{ modifiers: ["toString"], color: "red" }],
          onEvent: () => {},
        },
      }),
    /modifiers\[0\] must be one of/,
  );

  // Repeated modifier inside a single binding is rejected.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: [{ modifiers: ["shift", "shift"], color: "red" }],
          onEvent: () => {},
        },
      }),
    /modifiers must not repeat/,
  );

  // Duplicate normalized binding set across the list is rejected.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: [
            { modifiers: ["shift"], color: "red" },
            { modifiers: ["shift"], color: "blue" },
          ],
          onEvent: () => {},
        },
      }),
    /annotationGestures has duplicate modifier binding/,
  );

  // Color must be a string when provided.
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          annotationGestures: [{ color: 5 }],
          onEvent: () => {},
        },
      }),
    /color must be a string when provided/,
  );
});

function setBoardRect(host, left, top, size) {
  Object.defineProperty(
    host.ownerDocument.defaultView.HTMLElement.prototype,
    "getBoundingClientRect",
    {
      configurable: true,
      value: () => ({
        x: left,
        y: top,
        left,
        top,
        right: left + size,
        bottom: top + size,
        width: size,
        height: size,
      }),
    },
  );
}

test("drag drop resolves against a resized board mid-gesture", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  // The host doubles in size and shifts after the press; only live-rect
  // math keeps the gesture correct.
  setBoardRect(host, 100, 100, 1600);
  dispatchPointer(host, "pointermove", "e4");
  await flushRaf();
  const piece = host.querySelector('[data-square="e2"]');
  // The press grabbed e2's centre and the pointer now sits over e4's
  // centre; the inline transform is absolute, so the piece top-left lands
  // exactly on e4's top-left corner (4 cells from the board origin).
  assert.equal(piece.style.transform, "translate3d(800px, 800px, 0)");
  dispatchPointer(host, "pointerup", "e4");
  assert.deepEqual(events.slice(-1), [
    { type: "move", from: "e2", to: "e4", origin: "drag" },
  ]);
});

test("draw gestures survive a host resize mid-gesture", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2", { button: 2 });
  setBoardRect(host, 100, 100, 1600);
  dispatchPointer(host, "pointermove", "e4", { button: 2 });
  await flushRaf();
  const preview = host.querySelector('[data-annotation-id="pw-preview"]');
  assert.equal(preview?.getAttribute("data-annotation-kind"), "arrow");
  dispatchPointer(host, "pointerup", "e4", { button: 2 });
  assert.deepEqual(events, [
    { type: "arrow", from: "e2", to: "e4", origin: "pointer" },
  ]);
});

test("sub-threshold pointer movement keeps a click a click", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  const boardEl = host.querySelector(".pw-board");
  const rect = boardEl.getBoundingClientRect();
  const jitterTo = (dx, dy) =>
    boardEl.dispatchEvent(
      new host.ownerDocument.defaultView.PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        clientX: rect.left + 4.5 * (rect.width / 8) + dx,
        clientY: rect.top + 6.5 * (rect.height / 8) + dy,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  // 1px of jitter stays a click: no drag visual, no capture.
  jitterTo(1, 1);
  await flushRaf();
  const piece = host.querySelector('[data-square="e2"]');
  assert.equal(piece.classList.contains("pw-piece-dragging"), false);
  assert.equal(piece.style.transform, "");
  assert.equal(boardEl.hasPointerCapture(1), false);
  dispatchPointer(host, "pointerup", "e2");
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
  ]);

  // Crossing the threshold on a fresh press promotes the drag.
  dispatchPointer(host, "pointerdown", "e2");
  jitterTo(5, 0);
  await flushRaf();
  assert.equal(piece.classList.contains("pw-piece-dragging"), true);
  dispatchPointer(host, "pointerup", "e2");
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
    { type: "select", square: "e2", origin: "pointer" },
  ]);
});

test("renders SVG piece sets and square themes with glyph fallback", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const position = new Map([
    ["e2", { color: "white", role: "king" }],
    ["e7", { color: "black", role: "pawn" }],
  ]);
  const base = "https://example.com/pieces/cburnett/";
  const board = createChessboard(host, {
    position,
    animationMs: 0,
    pieceSet: base,
    theme: { light: "#dee3e6", dark: "#8ca2ad" },
  });
  const el = host.querySelector(".pw-board");
  assert.equal(el.style.getPropertyValue("--pw-light-square"), "#dee3e6");
  assert.equal(el.style.getPropertyValue("--pw-dark-square"), "#8ca2ad");

  const king = host.querySelector('[data-square="e2"]');
  const pawn = host.querySelector('[data-square="e7"]');
  // JSDOM serializes url() values lowercased; compare case-insensitively.
  assert.equal(
    king.style.backgroundImage.toLowerCase(),
    `url("${base}wk.svg")`,
  );
  assert.equal(
    pawn.style.backgroundImage.toLowerCase(),
    `url("${base}bp.svg")`,
  );
  assert.equal(king.textContent, "");

  // An explicit null restores Unicode glyphs and repaints existing nodes.
  board.set({ pieceSet: null });
  assert.equal(king.style.backgroundImage, "");
  assert.equal(king.textContent, "♔");
  assert.equal(pawn.textContent, "♟");

  // An explicit null restores the stylesheet's default square colors.
  board.set({ theme: null });
  assert.equal(el.style.getPropertyValue("--pw-light-square"), "");
  assert.equal(el.style.getPropertyValue("--pw-dark-square"), "");
});
test("exports individual vendored piece sets", () => {
  assert.match(cburnett.wK, /^\s*<\?xml/);
});

test("renders the vendored default piece set without a pieceSet option", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const position = new Map([
    ["e2", { color: "white", role: "king" }],
    ["e7", { color: "black", role: "pawn" }],
  ]);
  const board = createChessboard(host, { position, animationMs: 0 });
  const king = host.querySelector('[data-square="e2"]');
  const pawn = host.querySelector('[data-square="e7"]');
  // Omitting pieceSet renders the vendored Cburnett artwork as data URIs.
  // JSDOM serializes url() values lowercased; compare case-insensitively.
  assert.match(
    king.style.backgroundImage.toLowerCase(),
    /^url\("data:image\/svg\+xml,/,
  );
  assert.match(
    pawn.style.backgroundImage.toLowerCase(),
    /^url\("data:image\/svg\+xml,/,
  );
  // The embedded artwork must stay decodable: the XML declaration has to be
  // the very first thing (leading whitespace makes the document invalid) and
  // the decoded source must parse as SVG.
  const uri = king.style.backgroundImage
    .toLowerCase()
    .match(/^url\("(.*)"\)$/)[1];
  assert.match(uri, /^data:image\/svg\+xml,%3c%3fxml/);
  const svg = decodeURIComponent(uri.slice("data:image/svg+xml,".length));
  const doc = new dom.window.DOMParser().parseFromString(svg, "image/svg+xml");
  assert.equal(doc.querySelector("parsererror"), null);
  assert.equal(king.textContent, "");

  // An explicit URL base overrides the vendored default…
  const base = "https://example.com/pieces/other/";
  board.set({ pieceSet: base });
  assert.equal(
    king.style.backgroundImage.toLowerCase(),
    `url("${base}wk.svg")`,
  );

  // …and null restores Unicode glyphs.
  board.set({ pieceSet: null });
  assert.equal(king.style.backgroundImage, "");
  assert.equal(king.textContent, "♔");
});

test("renders embedded PieceSources objects and validates them atomically", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
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
  const sources = Object.fromEntries(
    codes.map((code) => [
      code,
      `<svg xmlns="http://www.w3.org/2000/svg"><g id="${code}"/></svg>`,
    ]),
  );
  const position = new Map([
    ["a1", { color: "white", role: "king" }],
    ["e7", { color: "black", role: "pawn" }],
  ]);
  const board = createChessboard(host, {
    position,
    animationMs: 0,
    pieceSet: sources,
  });
  const king = host.querySelector('[data-square="a1"]');
  const pawn = host.querySelector('[data-square="e7"]');
  const kingUri = king.style.backgroundImage
    .toLowerCase()
    .match(/^url\("data:image\/svg\+xml,(.*)"\)$/)[1];
  assert.match(decodeURIComponent(kingUri).toLowerCase(), /id="wk"/);
  assert.match(
    decodeURIComponent(pawn.style.backgroundImage.toLowerCase()).toLowerCase(),
    /id="bp"/,
  );

  // Validation rejects incomplete, unknown, and mistyped sources atomically.
  const { bB: _dropped, ...incomplete } = sources;
  assert.throws(
    () => createChessboard(host, { position, pieceSet: incomplete }),
    /pieceSet\.bB must be a non-empty SVG source string/,
  );
  assert.throws(
    () =>
      createChessboard(host, {
        position,
        pieceSet: { ...sources, wZ: "<svg/>" },
      }),
    /pieceSet has unknown piece code: wZ/,
  );
  assert.throws(
    () => createChessboard(host, { position, pieceSet: { ...sources, wK: 5 } }),
    /pieceSet\.wK must be a non-empty SVG source string/,
  );

  // Glyphs remain reachable through null on update.
  board.set({ pieceSet: null });
  assert.equal(king.style.backgroundImage, "");
  assert.equal(king.textContent, "♔");
});

test("rejects invalid pieceSet and theme values", () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector("#host");
  const position = new Map([["a1", { color: "white", role: "rook" }]]);
  assert.throws(
    () => createChessboard(host, { position, pieceSet: "" }),
    TypeError,
  );
  assert.throws(
    () => createChessboard(host, { position, theme: { light: 5 } }),
    TypeError,
  );
  const board = createChessboard(host, { position });
  assert.throws(() => board.set({ pieceSet: 42 }), TypeError);
});

// Position reconciliation: node identity across set({position})
test("set({position}) reuses the DOM node of a piece that moved squares", () => {
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["d2", { color: "white", role: "pawn" }],
    ]),
  );
  const movingNode = host.querySelector('[data-square="e2"]');
  board.set({
    position: new Map([
      ["d2", { color: "white", role: "pawn" }],
      ["e4", { color: "white", role: "pawn" }],
    ]),
  });
  assert.equal(host.querySelector('[data-square="e4"]'), movingNode);
  assert.equal(host.querySelectorAll(".pw-piece").length, 2);
  assert.equal(movingNode.style.getPropertyValue("--pw-file"), "4");
  assert.equal(movingNode.style.getPropertyValue("--pw-rank"), "4");
});

test("set({position}) capture keeps the mover's node and removes the captured node", () => {
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "black", role: "pawn" }],
    ]),
  );
  const mover = host.querySelector('[data-square="e2"]');
  const captured = host.querySelector('[data-square="e4"]');
  board.set({ position: new Map([["e4", { color: "white", role: "pawn" }]]) });
  assert.equal(host.querySelector('[data-square="e4"]'), mover);
  assert.equal(captured.isConnected, false);
  assert.equal(host.querySelectorAll(".pw-piece").length, 1);
});

test("a newer set({position}) retargets the same node without queueing", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
  );
  const node = host.querySelector('[data-square="e2"]');
  board.set({ position: new Map([["e3", { color: "white", role: "pawn" }]]) });
  board.set({ position: new Map([["e5", { color: "white", role: "pawn" }]]) });
  assert.equal(host.querySelector('[data-square="e5"]'), node);
  assert.equal(node.style.getPropertyValue("--pw-file"), "4");
  assert.equal(node.style.getPropertyValue("--pw-rank"), "3");
  assert.equal(host.querySelectorAll(".pw-piece").length, 1);
});

// Edge coordinates
test("coordinates render edge labels that flip with orientation and toggle at runtime", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { coordinates: true },
  );
  const layer = host.querySelector(".pw-coordinates");
  assert.equal(layer.style.pointerEvents, "none");
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 16);
  const fileA = host.querySelector('.pw-coordinate-file[data-file="a"]');
  const rank1 = host.querySelector('.pw-coordinate-rank[data-rank="1"]');
  assert.deepEqual(
    [
      fileA.style.getPropertyValue("--pw-file"),
      fileA.style.getPropertyValue("--pw-rank"),
    ],
    ["0", "7"],
  );
  assert.equal(fileA.dataset.parity, "dark");
  assert.equal(rank1.dataset.parity, "dark");

  board.set({ orientation: "black" });
  // Labels are rebuilt on flip; query the fresh nodes.
  const flippedFileA = host.querySelector('.pw-coordinate-file[data-file="a"]');
  const flippedRank1 = host.querySelector('.pw-coordinate-rank[data-rank="1"]');
  assert.deepEqual(
    [
      flippedFileA.style.getPropertyValue("--pw-file"),
      flippedFileA.style.getPropertyValue("--pw-rank"),
    ],
    ["7", "7"],
  );
  assert.equal(flippedFileA.dataset.parity, "light");
  assert.deepEqual(
    [
      flippedRank1.style.getPropertyValue("--pw-file"),
      flippedRank1.style.getPropertyValue("--pw-rank"),
    ],
    ["0", "0"],
  );

  board.set({ coordinates: false });
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 0);
  assert.throws(() => board.set({ coordinates: "yes" }), TypeError);
});

test("coordinates default to off", () => {
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
  );
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 0);
});

// Drag affordances: origin ghost and live drop-target highlight
test("dragging shows an origin ghost and a live drop-target highlight", async () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e3", "e4"]]]),
        onEvent: (e) => events.push(e),
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e3");
  await flushRaf();

  const piece = host.querySelector('[data-square="e2"]');
  const ghost = host.querySelector(".pw-piece-ghost");
  assert.notEqual(ghost, null);
  assert.notEqual(ghost, piece);
  assert.equal(ghost.dataset.square, undefined);
  assert.equal(ghost.dataset.color, "white");
  assert.equal(ghost.dataset.role, "pawn");

  // Hovering a legal destination highlights it; hovering nothing legal
  // hides it again.
  const mark = host.querySelector(".pw-mark-drag-target");
  assert.equal(mark.dataset.square, "e3");
  assert.equal(mark.dataset.destination, "empty");
  dispatchPointer(host, "pointermove", "d3");
  await flushRaf();
  assert.equal(host.querySelector(".pw-mark-drag-target"), null);
  dispatchPointer(host, "pointermove", "e4");
  await flushRaf();
  assert.equal(host.querySelector(".pw-mark-drag-target").dataset.square, "e4");

  dispatchPointer(host, "pointerup", "e4");
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "pointer" },
    { type: "move", from: "e2", to: "e4", origin: "drag" },
  ]);
  assert.equal(host.querySelector(".pw-piece-ghost"), null);
  assert.equal(host.querySelector(".pw-mark-drag-target"), null);
  // Without caller approval the piece stays on its origin square.
  assert.equal(host.querySelector('[data-square="e2"]'), piece);
});

test("drop-target highlight marks an occupied destination as a capture", async () => {
  const { host } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "black", role: "pawn" }],
    ]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e4");
  await flushRaf();
  const mark = host.querySelector(".pw-mark-drag-target");
  assert.equal(mark.dataset.square, "e4");
  assert.equal(mark.dataset.destination, "occupied");
});

test("pointercancel removes the drag ghost and drop-target highlight", async () => {
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        onEvent: () => {},
      },
    },
  );
  dispatchPointer(host, "pointerdown", "e2");
  dispatchPointer(host, "pointermove", "e4");
  await flushRaf();
  assert.notEqual(host.querySelector(".pw-piece-ghost"), null);
  assert.notEqual(host.querySelector(".pw-mark-drag-target"), null);
  dispatchPointer(host, "pointercancel", "e4");
  assert.equal(host.querySelector(".pw-piece-ghost"), null);
  assert.equal(host.querySelector(".pw-mark-drag-target"), null);
});

test("move applies companion presentation atomically", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
  );
  const movingNode = host.querySelector('[data-square="e2"]');

  board.move("e2", "e4", {
    presentation: { lastMove: { from: "e2", to: "e4" } },
  });

  assert.equal(host.querySelector('[data-square="e4"]'), movingNode);
  assert.equal(
    host.querySelector('[data-mark="last-move-from"]').dataset.square,
    "e2",
  );
  assert.equal(
    host.querySelector('[data-mark="last-move-to"]').dataset.square,
    "e4",
  );
  assert.throws(
    () =>
      board.move("e4", "e5", {
        position: new Map(),
      }),
    /cannot include position/,
  );
});

test("unchanged annotations do not rewrite their SVG node", () => {
  const annotation = {
    id: "engine",
    kind: "arrow",
    from: "e2",
    to: "e4",
    layer: "engine",
  };
  const { host, board } = makeBoard(new Map(), {
    annotations: [annotation],
  });
  const node = host.querySelector('[data-annotation-id="engine"]');
  let writes = 0;
  const setAttribute = node.setAttribute.bind(node);
  node.setAttribute = (...args) => {
    writes += 1;
    return setAttribute(...args);
  };

  board.set({ annotations: [{ ...annotation }] });

  assert.equal(writes, 0);
});

// Inside coordinates
test("coordinates accept boolean, edge, and inside modes", () => {
  for (const [value, expected] of [
    [true, "edge"],
    ["edge", "edge"],
    ["inside", "inside"],
    [false, "none"],
  ]) {
    const { host } = makeBoard(
      new Map([["e2", { color: "white", role: "pawn" }]]),
      { coordinates: value },
    );
    assert.equal(host.querySelector(".pw-board").dataset.coordinates, expected);
  }

  const { host: omittedHost } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
  );
  assert.equal(
    omittedHost.querySelector(".pw-board").dataset.coordinates,
    "none",
  );
});

test("coordinates reject invalid values with TypeError", () => {
  for (const value of ["top", 1]) {
    const { board } = makeBoard(
      new Map([["e2", { color: "white", role: "pawn" }]]),
    );
    assert.throws(() => board.set({ coordinates: value }), TypeError);
  }
});

test("coordinates: inside renders 64 labels with full square names", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { coordinates: "inside" },
  );
  const inside = host.querySelectorAll(".pw-coordinate-inside");
  assert.equal(inside.length, 64);

  const e4 = host.querySelector('.pw-coordinate-inside[data-square="e4"]');
  assert.equal(e4?.textContent, "e4");
  // e4 is a light square; its label must carry the light parity.
  assert.equal(e4.dataset.parity, "light");

  board.set({ orientation: "black" });
  const flipped = host.querySelectorAll(".pw-coordinate-inside");
  assert.equal(flipped.length, 64);
  const flippedE4 = host.querySelector(
    '.pw-coordinate-inside[data-square="e4"]',
  );
  assert.equal(flippedE4?.textContent, "e4");
});

test("coordinates update path switches between edge, inside, and off", () => {
  const { host, board } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { coordinates: true },
  );
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 16);

  board.set({ coordinates: "inside" });
  const board1 = host.querySelector(".pw-board");
  assert.equal(board1.dataset.coordinates, "inside");
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 64);

  board.set({ coordinates: false });
  const board2 = host.querySelector(".pw-board");
  assert.equal(board2.dataset.coordinates, "none");
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 0);
});

test("coordinates: edge mode keeps 16 edge labels", () => {
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    { coordinates: true },
  );
  assert.equal(host.querySelectorAll(".pw-coordinate").length, 16);
  assert.equal(host.querySelectorAll(".pw-coordinate-inside").length, 0);
});

// Slice-08: opt-in keyboard input

/**
 * Dispatch a keydown against the .pw-board element. JSDOM delivers
 * KeyboardEvent normally; no layout is involved.
 */
function dispatchKey(host, key) {
  const board = host.querySelector(".pw-board");
  return board.dispatchEvent(
    new host.ownerDocument.defaultView.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key,
    }),
  );
}

function keyboardBoard(position, { presentation, ...config } = {}) {
  return makeBoard(position, {
    ...config,
    interaction: {
      destinations: new Map([["e2", ["e4"]]]),
      keyboard: true,
      onEvent: () => {},
      ...(config.interaction ?? {}),
    },
    presentation,
  });
}

test("keyboard: opting in switches role to application and exposes tabindex", () => {
  const { host } = keyboardBoard(new Map());
  const board = host.querySelector(".pw-board");
  assert.equal(board.getAttribute("role"), "application");
  assert.equal(board.getAttribute("tabindex"), "0");
});

test("keyboard: default role stays img without tabindex when not opted in", () => {
  const { host } = makeBoard(new Map(), {
    interaction: { destinations: new Map(), onEvent: () => {} },
  });
  const board = host.querySelector(".pw-board");
  assert.equal(board.getAttribute("role"), "img");
  assert.equal(board.getAttribute("tabindex"), null);
});

test("keyboard: omitting interaction leaves the default img role", () => {
  const { host } = makeBoard(new Map());
  const board = host.querySelector(".pw-board");
  assert.equal(board.getAttribute("role"), "img");
  assert.equal(board.getAttribute("tabindex"), null);
});

test("keyboard: arrow keys move the cursor square by square and emit nothing", () => {
  const events = [];
  const { host } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: (event) => events.push(event),
    },
  });

  dispatchKey(host, "ArrowRight");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "b1");
  dispatchKey(host, "ArrowUp");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "b2");
  assert.deepEqual(events, []);
});

test("keyboard: cursor starts at the visually bottom-left square", () => {
  const white = keyboardBoard(new Map());
  dispatchKey(white.host, "ArrowDown");
  assert.equal(
    white.host.querySelector(".pw-mark-cursor")?.dataset.square,
    "a1",
  );

  const black = makeBoard(new Map(), {
    orientation: "black",
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: () => {},
    },
  });
  // Screen-relative arrows: under black, h1 is bottom-left, so Right moves
  // visually right toward g1.
  dispatchKey(black.host, "ArrowRight");
  assert.equal(
    black.host.querySelector(".pw-mark-cursor")?.dataset.square,
    "g1",
  );
});

test("keyboard: arrows are screen-relative under black orientation", () => {
  const { host, board } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: () => {},
    },
  });
  board.set({ orientation: "black" });
  dispatchKey(host, "ArrowRight");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "g1");
  // Under black, rank 1 renders at the visual top, so Down moves to g2.
  dispatchKey(host, "ArrowDown");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "g2");
});

test("keyboard: cursor clamps at the board edges instead of wrapping", () => {
  const { host } = keyboardBoard(new Map());

  for (let i = 0; i < 5; i += 1) dispatchKey(host, "ArrowLeft");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "a1");

  dispatchKey(host, "ArrowRight");
  for (let i = 0; i < 5; i += 1) dispatchKey(host, "ArrowDown");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "b1");

  for (let i = 0; i < 12; i += 1) dispatchKey(host, "ArrowUp");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "b8");
});

test("keyboard: Enter on a selectable square emits select with keyboard origin", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        keyboard: true,
        onEvent: (event) => events.push(event),
      },
    },
  );

  // a1 -> e2: four rights, one up.
  for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]) {
    dispatchKey(host, key);
  }
  dispatchKey(host, "ArrowUp");
  dispatchKey(host, "Enter");

  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "keyboard" },
  ]);
});

test("keyboard: Space presses like Enter", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        keyboard: true,
        onEvent: (event) => events.push(event),
      },
    },
  );

  for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]) {
    dispatchKey(host, key);
  }
  dispatchKey(host, "ArrowUp");
  dispatchKey(host, " ");

  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "keyboard" },
  ]);
});

test("keyboard: Enter on a destination after select emits move with keyboard origin", () => {
  const events = [];
  const { host, board } = makeBoard(
    new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "black", role: "pawn" }],
    ]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        keyboard: true,
        onEvent: (event) => events.push(event),
      },
    },
  );

  for (const key of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"]) {
    dispatchKey(host, key);
  }
  dispatchKey(host, "ArrowUp");
  dispatchKey(host, "Enter"); // select e2
  // Keyboard selection survives the event callback so a second press can
  // resolve the configured destination without a render round-trip.
  dispatchKey(host, "ArrowUp");
  dispatchKey(host, "ArrowUp");
  dispatchKey(host, "Enter"); // move to e4
  assert.deepEqual(events, [
    { type: "select", square: "e2", origin: "keyboard" },
    { type: "move", from: "e2", to: "e4", origin: "keyboard" },
  ]);
});

test("keyboard: Escape clears the selection intent and drops the cursor", () => {
  const events = [];
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        keyboard: true,
        onEvent: (event) => events.push(event),
      },
      presentation: { selected: "e2" },
    },
  );

  dispatchKey(host, "ArrowRight"); // place the cursor on b1
  dispatchKey(host, "Escape");
  assert.equal(host.querySelector(".pw-mark-cursor"), null);
  assert.deepEqual(events, [{ type: "clear", origin: "keyboard" }]);
});

test("keyboard: blur clears the cursor and emits nothing", () => {
  const events = [];
  const { host, dom } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: (event) => events.push(event),
    },
  });

  dispatchKey(host, "ArrowUp");
  assert.equal(host.querySelector(".pw-mark-cursor")?.dataset.square, "a2");

  host.querySelector(".pw-board").dispatchEvent(new dom.window.Event("blur"));
  assert.equal(host.querySelector(".pw-mark-cursor"), null);
  assert.deepEqual(events, []);
});

test("keyboard: live region announces cursor squares and move intents", () => {
  const { host } = makeBoard(
    new Map([["e2", { color: "white", role: "pawn" }]]),
    {
      interaction: {
        destinations: new Map([["e2", ["e4"]]]),
        keyboard: true,
        onEvent: () => {},
      },
      presentation: { selected: "e2" },
    },
  );
  const live = host.querySelector(".pw-live");
  assert.ok(live, "live region rendered");
  assert.equal(live.getAttribute("aria-live"), "polite");

  dispatchKey(host, "ArrowRight");
  assert.equal(live.textContent, "b1");

  dispatchKey(host, "ArrowRight");
  dispatchKey(host, "ArrowRight");
  dispatchKey(host, "ArrowRight");
  dispatchKey(host, "ArrowUp");
  assert.equal(live.textContent, "e2, white pawn");

  dispatchKey(host, "ArrowUp");
  dispatchKey(host, "ArrowUp");
  dispatchKey(host, "Enter");
  assert.equal(live.textContent, "e2 to e4");
});

test("keyboard: setting interaction to null disables semantics and drops state", () => {
  const events = [];
  const { host, board } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: (event) => events.push(event),
    },
  });

  dispatchKey(host, "ArrowUp");
  assert.notEqual(host.querySelector(".pw-mark-cursor"), null);

  board.set({ interaction: null });
  const boardEl = host.querySelector(".pw-board");
  assert.equal(boardEl.getAttribute("role"), "img");
  assert.equal(boardEl.getAttribute("tabindex"), null);
  assert.equal(host.querySelector(".pw-mark-cursor"), null);

  dispatchKey(host, "Enter");
  assert.deepEqual(events, []);
});

test("keyboard: re-enabling keyboard restores application role", () => {
  const { host, board } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: () => {},
    },
  });
  const boardEl = host.querySelector(".pw-board");
  assert.equal(boardEl.getAttribute("role"), "application");

  board.set({ interaction: { destinations: new Map(), onEvent: () => {} } });
  assert.equal(boardEl.getAttribute("role"), "img");
  assert.equal(boardEl.getAttribute("tabindex"), null);

  board.set({
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: () => {},
    },
  });
  assert.equal(boardEl.getAttribute("role"), "application");
  assert.equal(boardEl.getAttribute("tabindex"), "0");
});

test("keyboard: validateInteraction rejects non-boolean keyboard values", () => {
  assert.throws(
    () =>
      makeBoard(new Map(), {
        interaction: {
          destinations: new Map(),
          keyboard: "yes",
          onEvent: () => {},
        },
      }),
    /interaction.keyboard must be a boolean/,
  );
});

test("keyboard: destroy removes listeners and clears transient cursor", () => {
  const { host, board } = makeBoard(new Map(), {
    interaction: {
      destinations: new Map(),
      keyboard: true,
      onEvent: () => {},
    },
  });

  dispatchKey(host, "ArrowUp");
  assert.notEqual(host.querySelector(".pw-mark-cursor"), null);

  board.destroy();
  assert.equal(host.querySelector(".pw-mark-cursor"), null);
  board.destroy();
  assert.equal(host.querySelector(".pw-board"), null);
});
