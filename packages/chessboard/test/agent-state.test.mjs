import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCommand,
  parseSnapshot,
  roundTripSnapshot,
  serializeSnapshot,
  snapshotFromState,
  validateCommand,
} from "../dist/internal/agent-state.js";

function makeState(overrides = {}) {
  const base = {
    position: new Map([
      ["e2", { color: "white", role: "pawn" }],
      ["e4", { color: "black", role: "pawn" }],
    ]),
    orientation: "white",
    selected: "e2",
    lastMove: { from: "d2", to: "d4" },
    checked: "e1",
    destinations: new Map([["e2", ["e4", "d4"]]]),
    annotations: [
      {
        id: "beta",
        kind: "circle",
        square: "e4",
        layer: "user",
        color: "#fff",
        metadata: { note: "ok" },
      },
      {
        id: "alpha",
        kind: "arrow",
        from: "d2",
        to: "d4",
        layer: "engine",
        metadata: [1, 2],
      },
    ],
    visibleLayers: new Set(["engine", "user"]),
  };
  return { ...base, ...overrides };
}

test("snapshotFromState sorts position by square", () => {
  const snapshot = snapshotFromState(makeState());
  const squares = snapshot.position.map(([square]) => square);
  assert.deepEqual(squares, ["e2", "e4"]);
});

test("snapshotFromState sorts annotations by identifier", () => {
  const snapshot = snapshotFromState(makeState());
  assert.deepEqual(
    snapshot.annotations.map((a) => a.id),
    ["alpha", "beta"],
  );
});

test("snapshotFromState sorts visible layers canonically", () => {
  const forward = snapshotFromState(
    makeState({ visibleLayers: new Set(["engine", "user"]) }),
  );
  const reversed = snapshotFromState(
    makeState({ visibleLayers: new Set(["user", "engine"]) }),
  );
  assert.deepEqual(forward.visibleLayers, ["engine", "user"]);
  assert.deepEqual(reversed.visibleLayers, forward.visibleLayers);
});

test("snapshotFromState copies caller collections", () => {
  const destinations = new Map([["e2", ["e4"]]]);
  const layers = new Set(["engine"]);
  const annotations = [
    { id: "a", kind: "circle", square: "e4", layer: "engine" },
  ];
  const snapshot = snapshotFromState(
    makeState({ destinations, annotations, visibleLayers: layers }),
  );
  destinations.clear();
  layers.clear();
  annotations.length = 0;
  assert.equal(snapshot.destinations.length, 1);
  assert.equal(snapshot.annotations.length, 1);
  assert.deepEqual(snapshot.visibleLayers, ["engine"]);
});
test("JSON round trip is stable for equivalent states", () => {
  const stateA = makeState();
  const stateB = makeState({
    position: new Map([
      ["e4", { color: "black", role: "pawn" }],
      ["e2", { color: "white", role: "pawn" }],
    ]),
    annotations: [
      {
        id: "alpha",
        kind: "arrow",
        from: "d2",
        to: "d4",
        layer: "engine",
        metadata: [1, 2],
      },
      {
        id: "beta",
        kind: "circle",
        square: "e4",
        layer: "user",
        color: "#fff",
        metadata: { note: "ok" },
      },
    ],
    destinations: new Map([["e2", ["d4", "e4"]]]),
  });

  const a = serializeSnapshot(snapshotFromState(stateA));
  const b = serializeSnapshot(snapshotFromState(stateB));
  assert.equal(a, b);
});

test("JSON round trip preserves all fields", () => {
  const original = snapshotFromState(makeState());
  const restored = roundTripSnapshot(original);
  assert.deepEqual(restored, original);
});

test("parseSnapshot rejects invalid JSON", () => {
  assert.throws(() => parseSnapshot("not json"), /valid JSON/);
});

test("parseSnapshot rejects duplicate squares", () => {
  const bad = JSON.stringify({
    position: [
      ["e2", { color: "white", role: "pawn" }],
      ["e2", { color: "black", role: "pawn" }],
    ],
    orientation: "white",
    selected: null,
    lastMove: null,
    checked: null,
    destinations: [],
    annotations: [],
    visibleLayers: [],
  });
  assert.throws(() => parseSnapshot(bad), /duplicate square/);
});

test("parseSnapshot accepts well-formed JSON metadata", () => {
  const input = JSON.stringify({
    position: [],
    orientation: "white",
    selected: null,
    lastMove: null,
    checked: null,
    destinations: [],
    annotations: [
      {
        id: "a",
        kind: "circle",
        square: "e4",
        layer: "user",
        metadata: { nested: { tags: ["x", 1, true, null] } },
      },
    ],
    visibleLayers: ["user"],
  });
  const parsed = parseSnapshot(input);
  assert.equal(parsed.annotations[0].metadata.nested.tags.length, 4);
});

test("parseSnapshot rejects unsupported annotation kind", () => {
  const input = JSON.stringify({
    position: [],
    orientation: "white",
    selected: null,
    lastMove: null,
    checked: null,
    destinations: [],
    annotations: [{ id: "a", kind: "highlight", square: "e4", layer: "user" }],
    visibleLayers: [],
  });
  assert.throws(() => parseSnapshot(input), /must be "arrow" or "circle"/);
});

test("parseSnapshot rejects annotation with empty id", () => {
  const input = JSON.stringify({
    position: [],
    orientation: "white",
    selected: null,
    lastMove: null,
    checked: null,
    destinations: [],
    annotations: [{ id: "", kind: "circle", square: "e4", layer: "user" }],
    visibleLayers: [],
  });
  assert.throws(() => parseSnapshot(input), /id must be a non-empty string/);
});

test("validateCommand accepts the constrained union", () => {
  assert.deepEqual(validateCommand({ kind: "move", from: "e2", to: "e4" }), {
    kind: "move",
    from: "e2",
    to: "e4",
  });
  const cmd = validateCommand({
    kind: "setOrientation",
    orientation: "black",
  });
  assert.equal(cmd.kind, "setOrientation");
  const presCmd = validateCommand({
    kind: "setPresentation",
    presentation: { selected: "e2", lastMove: null, checked: null },
  });
  assert.equal(presCmd.kind, "setPresentation");
  const visCmd = validateCommand({
    kind: "setVisibleLayers",
    layers: ["engine"],
  });
  assert.deepEqual(visCmd, {
    kind: "setVisibleLayers",
    layers: ["engine"],
  });
});

test("validateCommand rejects unknown kinds and bad payloads atomically", () => {
  assert.throws(
    () => validateCommand({ kind: "destroyAll" }),
    /unknown command kind/,
  );
  assert.throws(
    () => validateCommand({ kind: "move", from: "z9", to: "e4" }),
    /command.from must be a square/,
  );
  assert.throws(
    () => validateCommand({ kind: "setOrientation", orientation: "green" }),
    /must be "white" or "black"/,
  );
  assert.throws(
    () =>
      validateCommand({
        kind: "replacePosition",
        position: { not: "an array" },
      }),
    /command.position must be an array/,
  );
  assert.throws(
    () =>
      validateCommand({
        kind: "setVisibleLayers",
        layers: ["engine", ""],
      }),
    /non-empty strings/,
  );
  assert.throws(
    () =>
      validateCommand({
        kind: "move",
        from: "e2",
        to: "e4",
        callback: () => {},
      }),
    /unknown field callback/,
  );
});

test("applyCommand replaces position", () => {
  const after = applyCommand(makeState(), {
    kind: "replacePosition",
    position: [["d1", { color: "white", role: "queen" }]],
  });
  assert.deepEqual(
    [...after.position.entries()],
    [["d1", { color: "white", role: "queen" }]],
  );
});

test("applyCommand preserves caller-controlled selection after a move", () => {
  const after = applyCommand(makeState({ selected: "e2" }), {
    kind: "move",
    from: "e2",
    to: "d4",
  });
  assert.equal(after.position.has("e2"), false);
  assert.deepEqual(after.position.get("d4"), {
    color: "white",
    role: "pawn",
  });
  assert.equal(after.selected, "e2");
});

test("applyCommand rejects moving an empty square", () => {
  assert.throws(
    () => applyCommand(makeState(), { kind: "move", from: "h8", to: "h7" }),
    /no piece at h8/,
  );
});

test("applyCommand swaps orientation and presentation independently", () => {
  const oriented = applyCommand(makeState(), {
    kind: "setOrientation",
    orientation: "black",
  });
  assert.equal(oriented.orientation, "black");

  const presented = applyCommand(makeState(), {
    kind: "setPresentation",
    presentation: { checked: "h8" },
  });
  assert.equal(presented.checked, "h8");
  assert.equal(presented.selected, null);
  assert.equal(presented.lastMove, null);
});

test("applyCommand replaces annotations and visible layers", () => {
  const after = applyCommand(makeState(), {
    kind: "replaceAnnotations",
    annotations: [{ id: "z", kind: "circle", square: "a1", layer: "x" }],
  });
  assert.equal(after.annotations.length, 1);
  assert.equal(after.annotations[0].id, "z");

  const cleared = applyCommand(makeState(), {
    kind: "setVisibleLayers",
    layers: null,
  });
  assert.equal(cleared.visibleLayers, null);
});
