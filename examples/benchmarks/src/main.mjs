import "@plywise/chessboard/style.css";
import { createChessboard } from "@plywise/chessboard";

/**
 * In-page driver for reproducible interaction benchmarks.
 *
 * The Node runner (`scripts/bench.mjs`) drives this through `page.evaluate`.
 * All measurements happen here so we capture real V8/Blink timing in the
 * same JS as a packed consumer. The Node side only drives real Pointer
 * Events for the drag scenarios, collects deterministic statistics, and
 * writes JSON output.
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const BACK_RANK = [
  "rook",
  "knight",
  "bishop",
  "queen",
  "king",
  "bishop",
  "knight",
  "rook",
];

const arena = document.getElementById("arena");
const status = document.getElementById("status");

if (!(arena instanceof HTMLElement)) throw new Error("Missing benchmark arena");
if (!(status instanceof HTMLElement)) throw new Error("Missing status node");

const boards = new Map();
let dragSession = null;

function logStatus(message) {
  status.textContent = message;
}

/** Build a deterministic starting position. Caller may mutate the result. */
function startingPosition() {
  const position = new Map();
  for (const [index, file] of FILES.entries()) {
    const role = BACK_RANK[index];
    if (!role) continue;
    position.set(`${file}1`, { color: "white", role });
    position.set(`${file}2`, { color: "white", role: "pawn" });
    position.set(`${file}7`, { color: "black", role: "pawn" });
    position.set(`${file}8`, { color: "black", role });
  }
  return position;
}

/** Promote a pawn at row 8 to a queen for one extra piece, used by replacement scenarios. */
function alternatingPosition(toggle) {
  const position = startingPosition();
  if (toggle % 2 === 0) {
    position.delete("a2");
    position.set("a8", { color: "white", role: "queen" });
  } else {
    position.set("a2", { color: "white", role: "pawn" });
    position.delete("a8");
  }
  return position;
}

function annotationSet(seed) {
  return [
    {
      id: `arrow-${seed}`,
      kind: "arrow",
      from: "e2",
      to: "e4",
      layer: "user",
      color: "#157a3c",
    },
    {
      id: `circle-${seed}`,
      kind: "circle",
      square: "d5",
      layer: "user",
      color: "#157a3c",
    },
    {
      id: `arrow-engine-${seed}`,
      kind: "arrow",
      from: "g1",
      to: "f3",
      layer: "engine",
      color: "#7a4b15",
    },
  ];
}

/**
 * Tracks created/removed DOM nodes inside a board-owned subtree. The
 * MutationObserver is attached after `createChessboard` has rendered,
 * so we measure scenario deltas, not the initial render.
 */
function trackNodes(host) {
  let created = 0;
  let removed = 0;
  let attributeRecords = 0;
  function record(records) {
    for (const mutation of records) {
      created += mutation.addedNodes.length;
      removed += mutation.removedNodes.length;
      if (mutation.type === "attributes") attributeRecords++;
    }
  }
  const observer = new MutationObserver(record);
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "style",
      "class",
      "data-square",
      "data-color",
      "data-role",
    ],
  });
  return {
    snapshot() {
      record(observer.takeRecords());
      const value = { created, removed, attributeRecords };
      created = 0;
      removed = 0;
      attributeRecords = 0;
      return value;
    },
    reset() {
      observer.takeRecords();
      created = 0;
      removed = 0;
      attributeRecords = 0;
    },
    disconnect() {
      observer.disconnect();
    },
  };
}

function makeBoard({ id, withInteraction = false } = {}) {
  const host = document.createElement("div");
  host.className = "pw-bench-board";
  if (id) host.dataset.benchBoard = id;
  arena.appendChild(host);

  const position = startingPosition();
  const interaction = withInteraction
    ? {
        destinations: new Map([["e2", ["e3", "e4"]]]),
        onEvent: () => {},
      }
    : undefined;

  const board = createChessboard(host, {
    position,
    orientation: "white",
    ariaLabel: `Benchmark board ${id ?? ""}`.trim(),
    animationMs: 0,
    ...(interaction ? { interaction } : {}),
  });

  const nodes = trackNodes(host);
  boards.set(host, { board, nodes });
  return { board, host };
}

function teardownAll() {
  for (const { board, nodes } of boards.values()) {
    nodes.disconnect();
    try {
      board.destroy();
    } catch {
      // destroy is documented idempotent; ignore double-destroy from the harness.
    }
  }
  boards.clear();
  arena.replaceChildren();
}

function runSamples(measure, { warmup = 3, samples = 30, tracker } = {}) {
  for (let i = 0; i < warmup; i++) measure(i);
  // Reset the tracker so node deltas cover only the timed samples,
  // matching the timing window.
  tracker?.reset();
  const durations = new Array(samples);
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    measure(i);
    durations[i] = performance.now() - start;
  }
  const deltas = tracker?.snapshot() ?? {
    created: 0,
    removed: 0,
    attributeRecords: 0,
  };
  return { durations, deltas };
}

/**
 * Counts pointer events delivered to the board host. This describes the
 * Playwright input cadence; renderer frame work is intentionally not inferred
 * from it.
 */
function attachPointerTiming(host) {
  const timing = {
    pointerEvents: 0,
    perEvent: [],
    lastPointerAt: 0,
  };
  const onPointerMove = () => {
    const now = performance.now();
    if (timing.lastPointerAt !== 0) {
      timing.perEvent.push(now - timing.lastPointerAt);
    }
    timing.lastPointerAt = now;
    timing.pointerEvents++;
  };
  host.addEventListener("pointermove", onPointerMove, { passive: true });

  return {
    snapshot() {
      return {
        pointerEvents: timing.pointerEvents,
        perEvent: [...timing.perEvent],
      };
    },
    detach() {
      host.removeEventListener("pointermove", onPointerMove);
    },
  };
}

/** Run one scenario; returns deterministic samples and node deltas. */
function runScenario(name, params = {}) {
  const samples = Number(params.samples ?? 30);
  const warmup = Number(params.warmup ?? 3);

  switch (name) {
    case "ordinaryApprovedMove": {
      teardownAll();
      const { board } = makeBoard({ id: "ordinary" });
      const nodes = boards.values().next().value.nodes;
      const { durations, deltas } = runSamples(
        () => {
          // Move the pawn back and forth so the workload is identical
          // between iterations; piece-node reuse is part of the contract.
          board.move("e2", "e4");
          board.move("e4", "e2");
        },
        { warmup, samples, tracker: nodes },
      );
      teardownAll();
      return { durations, nodes: deltas };
    }
    case "bulkNavigation": {
      teardownAll();
      const { board } = makeBoard({ id: "bulk" });
      const nodes = boards.values().next().value.nodes;
      const iterations = Number(params.iterations ?? 1000);
      const perSample = Number(params.perSample ?? 25);
      const sampleCount = Math.ceil(iterations / perSample);
      const durations = new Array(sampleCount);
      const perIteration = new Array(iterations);
      let i = 0;
      for (let s = 0; s < sampleCount; s++) {
        const start = performance.now();
        const end = Math.min(iterations, i + perSample);
        for (; i < end; i++) {
          const opStart = performance.now();
          board.set({ position: alternatingPosition(i) });
          perIteration[i] = performance.now() - opStart;
        }
        durations[s] = performance.now() - start;
      }
      const deltas = nodes.snapshot();
      teardownAll();
      return {
        durations,
        perIteration,
        iterationsPerSample: perSample,
        nodes: deltas,
        iterations,
      };
    }
    case "arbitraryReplacement": {
      teardownAll();
      const { board } = makeBoard({ id: "replace" });
      const nodes = boards.values().next().value.nodes;
      const { durations, deltas } = runSamples(
        (i) => {
          board.set({
            position: alternatingPosition(i),
            orientation: i % 2 === 0 ? "white" : "black",
          });
        },
        { warmup, samples, tracker: nodes },
      );
      teardownAll();
      return { durations, nodes: deltas };
    }
    case "annotationReplacement": {
      teardownAll();
      const { board } = makeBoard({ id: "annot" });
      const nodes = boards.values().next().value.nodes;
      const { durations, deltas } = runSamples(
        (i) => {
          board.set({ annotations: annotationSet(i) });
        },
        { warmup, samples, tracker: nodes },
      );
      teardownAll();
      return { durations, nodes: deltas };
    }
    case "multiBoard": {
      const count = Number(params.count ?? 32);
      teardownAll();
      const managed = [];
      for (let i = 0; i < count; i++) {
        managed.push(makeBoard({ id: `multi-${i}`, withInteraction: true }));
      }
      // Capture board positions before any timing so the harness can
      // verify every requested board actually fits inside the requested
      // viewport — multi-board throughput is only meaningful when all
      // boards are rendered and visible.
      const lastHost = managed.at(-1)?.host;
      const lastBox = lastHost ? lastHost.getBoundingClientRect() : null;
      const requestedViewport = {
        width: Number(params.viewportWidth ?? 0),
        height: Number(params.viewportHeight ?? 0),
      };
      const visibility = {
        requestedViewport,
        boardCount: count,
        lastBoardBottom: lastBox ? lastBox.bottom : 0,
        lastBoardRight: lastBox ? lastBox.right : 0,
        firstBoardTop: managed[0]?.host?.getBoundingClientRect().top ?? 0,
        firstBoardLeft: managed[0]?.host?.getBoundingClientRect().left ?? 0,
      };
      const iterations = Number(params.iterations ?? 50);
      const sampleCount = Math.min(samples, 20);
      const totals = { created: 0, removed: 0, attributeRecords: 0 };
      // Warmup
      const measure = (i) => {
        for (const { board } of managed) {
          board.set({
            position: alternatingPosition(i),
            presentation: {
              selected: "e2",
              lastMove: { from: "e2", to: "e4" },
              checked: "e8",
            },
          });
        }
      };
      for (let i = 0; i < warmup; i++) measure(i);
      // Reset trackers so the timed samples capture only that activity.
      for (const entry of boards.values()) entry.nodes.reset();
      const durations = new Array(sampleCount);
      for (let s = 0; s < sampleCount; s++) {
        const start = performance.now();
        measure(s);
        durations[s] = performance.now() - start;
      }
      for (const entry of boards.values()) {
        const snap = entry.nodes.snapshot();
        totals.created += snap.created;
        totals.removed += snap.removed;
        totals.attributeRecords += snap.attributeRecords;
      }
      teardownAll();
      return {
        durations,
        nodes: totals,
        count,
        iterations,
        visibility,
      };
    }
    case "prepareDragSession": {
      teardownAll();
      const { host } = makeBoard({ id: "drag", withInteraction: true });
      const entry = boards.values().next().value;
      if (!entry) throw new Error("prepareDragSession could not create board");
      const nodes = entry.nodes;
      const boardBox = host.getBoundingClientRect();
      const squareSize = boardBox.width / 8;
      const timing = attachPointerTiming(host);
      dragSession = {
        host,
        nodes,
        timing,
        source: "e2",
        destination: "e4",
        boardBox: {
          x: boardBox.x,
          y: boardBox.y,
          width: boardBox.width,
          height: boardBox.height,
        },
        squareSize,
        pointerCount: 0,
        finished: false,
      };
      return {
        hostSelector: ".pw-bench-board[data-bench-board='drag']",
        source: "e2",
        destination: "e4",
        boardBox: dragSession.boardBox,
        squareSize,
      };
    }
    case "collectDragSession": {
      const session = dragSession;
      if (!session) throw new Error("No drag session in progress");
      const timingSnapshot = session.timing.snapshot();
      const lastNodes = session.nodes.snapshot();
      session.timing.detach();
      teardownAll();
      dragSession = null;
      return {
        pointerIntervals: timingSnapshot.perEvent,
        pointerEvents: timingSnapshot.pointerEvents,
        nodes: lastNodes,
      };
    }
    default:
      throw new Error(`Unknown scenario: ${name}`);
  }
}

window.__pw_bench = {
  version: 1,
  scenarios: [
    "ordinaryApprovedMove",
    "bulkNavigation",
    "arbitraryReplacement",
    "annotationReplacement",
    "multiBoard",
    "prepareDragSession",
    "collectDragSession",
  ],
  runScenario,
  teardownAll,
  setStatus: logStatus,
  dragHostSelector: () => ".pw-bench-board[data-bench-board='drag']",
};

logStatus("ready");
