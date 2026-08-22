import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createChessboard } from "../dist/index.js";

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
