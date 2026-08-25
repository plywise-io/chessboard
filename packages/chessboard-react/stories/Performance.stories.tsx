import {
  type Annotation,
  type Chessboard,
  createChessboard,
  type Interaction,
  type InteractionEvent,
  type Presentation,
  type Square,
} from "@plywise/chessboard";
import type { Meta } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState } from "react";
import { demoDestinations, positionFromFen, START_FEN } from "./helpers.js";

type ScenarioId =
  | "engineScoreDrift"
  | "fiftyMoves"
  | "rightButtonDrag"
  | "pieceDrag";

type ScenarioResult = {
  readonly id: ScenarioId;
  readonly label: string;
  readonly setCalls: number;
  readonly moveCalls: number;
  readonly svgAttributeWrites: number;
  readonly svgWritesByAnnotationId: Readonly<Record<string, number>>;
  readonly markAttributeRewrites: number;
  readonly childListMutations: number;
  readonly longTasks: number;
  readonly frameGapsOver50ms: number;
  readonly elapsedMs: number;
};

type ScenarioSpec = {
  readonly id: ScenarioId;
  readonly label: string;
  readonly expected: Partial<
    Pick<
      ScenarioResult,
      | "setCalls"
      | "moveCalls"
      | "svgAttributeWrites"
      | "markAttributeRewrites"
      | "longTasks"
    >
  >;
  readonly note: string;
};

const EXPECTED: readonly ScenarioSpec[] = [
  {
    id: "engineScoreDrift",
    label: "engineScoreDrift — 5s @ 50Hz, metadata-only",
    expected: {
      setCalls: 250,
      moveCalls: 0,
      svgAttributeWrites: 0,
      markAttributeRewrites: 0,
      longTasks: 0,
    },
    note: "Each tick rewrites engine-arrow metadata only; reconciliation must skip SVG writes and mark rewrites.",
  },
  {
    id: "fiftyMoves",
    label: "fiftyMoves — 50 rapid move() calls with presentation",
    expected: {
      setCalls: 0,
      moveCalls: 50,
      svgAttributeWrites: 0,
      markAttributeRewrites: 0,
      longTasks: 0,
    },
    note: "Move + presentation lands in one flush; only add/remove churn is expected on .pw-mark nodes.",
  },
  {
    id: "rightButtonDrag",
    label: "rightButtonDrag — 2s preview sweep at 60Hz",
    expected: { setCalls: 0, moveCalls: 0, longTasks: 0 },
    note: "Live preview path paints per RAF; no set()/move() invocations, no long tasks.",
  },
  {
    id: "pieceDrag",
    label: "pieceDrag — 2s drag-and-drop at 60Hz",
    expected: { setCalls: 0, moveCalls: 0, longTasks: 0 },
    note: "Pointer-driven; no core mutations, no long tasks.",
  },
];

/** Convert a board-relative (0..1) point to absolute client coords on the board element. */
function relativePoint(
  board: HTMLElement,
  x: number,
  y: number,
): { x: number; y: number } {
  const rect = board.getBoundingClientRect();
  return { x: rect.left + x * rect.width, y: rect.top + y * rect.height };
}

function makePointer(type: string, init: PointerEventInit): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    isPrimary: true,
    pointerId: 1,
    ...init,
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type CountersSnapshot = Pick<
  ScenarioResult,
  | "setCalls"
  | "moveCalls"
  | "svgAttributeWrites"
  | "svgWritesByAnnotationId"
  | "markAttributeRewrites"
  | "childListMutations"
  | "longTasks"
  | "frameGapsOver50ms"
>;

/**
 * Build 30 stable user annotations (mix of arrows + circles) plus one engine
 * arrow that receives metadata-only updates during the drift scenario. Every
 * user annotation has a structurally unique id so we can detect per-node
 * write tallies.
 */
function buildAnnotations(): readonly Annotation[] {
  const out: Annotation[] = [];
  const arrows: ReadonlyArray<readonly [Square, Square]> = [
    ["a1", "a4"],
    ["a1", "a5"],
    ["a1", "a6"],
    ["b1", "b4"],
    ["b1", "c3"],
    ["c1", "c4"],
    ["c1", "d3"],
    ["d1", "d4"],
    ["d1", "d5"],
    ["e1", "e4"],
    ["e1", "e5"],
    ["f1", "f4"],
    ["f1", "g5"],
    ["g1", "g4"],
    ["g1", "h3"],
    ["a3", "a6"],
    ["b3", "b6"],
    ["c3", "c6"],
    ["d3", "d6"],
    ["e3", "e6"],
    ["g3", "g6"],
    ["h3", "h6"],
    ["a4", "a7"],
    ["b4", "b7"],
    ["c4", "c7"],
  ];
  arrows.forEach(([from, to], i) => {
    out.push({
      id: `user:arrow:${i}`,
      kind: "arrow",
      from,
      to,
      layer: "user",
      color: "#15781B",
    });
  });
  const circles: ReadonlyArray<Square> = ["d4", "d5", "e5", "f4", "c5"];
  circles.forEach((square, i) => {
    out.push({
      id: `user:circle:${i}`,
      kind: "circle",
      square,
      layer: "user",
      color: "#15781B",
    });
  });
  out.push({
    id: "engine-pv",
    kind: "arrow",
    from: "e2",
    to: "e4",
    layer: "engine",
    color: "#268bd2",
    metadata: { score: 0 },
  });
  return out;
}

class ScenarioCounters {
  setCalls = 0;
  moveCalls = 0;
  svgAttributeWrites = 0;
  markAttributeRewrites = 0;
  childListMutations = 0;
  longTasks = 0;
  frameGapsOver50ms = 0;
  svgWritesByAnnotationId = new Map<string, number>();
  private lastRaf = 0;
  private rafId = 0;
  private longTaskObserver: PerformanceObserver | null = null;
  private observer: MutationObserver | null = null;
  private originalSetAttr: typeof Element.prototype.setAttribute | null = null;
  private originalMove: Chessboard["move"] | null = null;
  private originalSet: Chessboard["set"] | null = null;
  private originalRAF: typeof window.requestAnimationFrame | null = null;
  constructor(
    private readonly board: HTMLElement,
    private readonly instance: Chessboard,
  ) {}

  install(): void {
    // 1. Wrap core set/move to count user-driven calls (not internal renders).
    this.originalSet = this.instance.set.bind(this.instance);
    this.originalMove = this.instance.move.bind(this.instance);
    const countedSet: Chessboard["set"] = (update) => {
      this.setCalls++;
      this.originalSet?.(update);
    };
    const countedMove: Chessboard["move"] = (from, to, update) => {
      this.moveCalls++;
      this.originalMove?.(from, to, update);
    };
    this.instance.set = countedSet;
    this.instance.move = countedMove;

    // 2. Patch SVGElement.setAttribute to count annotation writes only.
    const proto = SVGElement.prototype as {
      setAttribute: Element["setAttribute"];
    };
    this.originalSetAttr = proto.setAttribute;
    const self = this;
    proto.setAttribute = function patched(
      this: SVGElement,
      name: string,
      value: string,
    ) {
      const el = this as Element;
      if (!el.closest?.(".pw-annotations"))
        return (self.originalSetAttr as Element["setAttribute"]).call(
          this,
          name,
          value,
        );
      self.svgAttributeWrites++;
      // Per-id tally: walk to the annotation node whose id the renderer
      // keys reconciliation on; per-id writes = real reconciliation work.
      const id = el
        .closest?.("[data-annotation-id]")
        ?.getAttribute("data-annotation-id");
      if (id) {
        const current = self.svgWritesByAnnotationId.get(id) ?? 0;
        self.svgWritesByAnnotationId.set(id, current + 1);
      }
      return (self.originalSetAttr as Element["setAttribute"]).call(
        this,
        name,
        value,
      );
    };

    // 3. MutationObserver: mark attribute rewrites + add/remove churn.
    this.observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") {
          const target = r.target as Element | null;
          if (
            target?.hasAttribute?.("data-mark") &&
            (r.attributeName === "data-destination" ||
              r.attributeName === "data-square" ||
              r.attributeName === "data-mark")
          ) {
            this.markAttributeRewrites++;
          }
        } else if (r.type === "childList") {
          for (const node of r.addedNodes) {
            if ((node as Element).classList?.contains("pw-mark"))
              this.childListMutations++;
          }
          for (const node of r.removedNodes) {
            if ((node as Element).classList?.contains("pw-mark"))
              this.childListMutations++;
          }
        }
      }
    });
    this.observer.observe(this.board, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeOldValue: true,
    });

    // 4. Long-task observer (where supported).
    if (
      typeof PerformanceObserver !== "undefined" &&
      "longtask" in PerformanceObserver.supportedEntryTypes
    ) {
      this.longTaskObserver = new PerformanceObserver((list) => {
        this.longTasks += list.getEntries().length;
      });
      this.longTaskObserver.observe({ entryTypes: ["longtask"] });
    }

    // 5. rAF gap monitor for long-frame detection.
    this.originalRAF = window.requestAnimationFrame.bind(window);
    const raf = this.originalRAF;
    const tick = (now: number) => {
      if (this.lastRaf > 0 && now - this.lastRaf > 50) this.frameGapsOver50ms++;
      this.lastRaf = now;
      this.rafId = raf(tick);
    };
    this.rafId = raf(tick);
  }

  reset(): void {
    this.setCalls = 0;
    this.moveCalls = 0;
    this.svgAttributeWrites = 0;
    this.svgWritesByAnnotationId.clear();
    this.markAttributeRewrites = 0;
    this.childListMutations = 0;
    this.longTasks = 0;
    this.frameGapsOver50ms = 0;
  }

  snapshot(): CountersSnapshot {
    return {
      setCalls: this.setCalls,
      moveCalls: this.moveCalls,
      svgAttributeWrites: this.svgAttributeWrites,
      svgWritesByAnnotationId: Object.fromEntries(this.svgWritesByAnnotationId),
      markAttributeRewrites: this.markAttributeRewrites,
      childListMutations: this.childListMutations,
      longTasks: this.longTasks,
      frameGapsOver50ms: this.frameGapsOver50ms,
    };
  }

  restore(): void {
    if (this.originalSetAttr) {
      (
        SVGElement.prototype as { setAttribute: Element["setAttribute"] }
      ).setAttribute = this.originalSetAttr;
      this.originalSetAttr = null;
    }
    if (this.originalSet) {
      this.instance.set = this.originalSet;
      this.originalSet = null;
    }
    if (this.originalMove) {
      this.instance.move = this.originalMove;
      this.originalMove = null;
    }
    this.observer?.disconnect();
    this.observer = null;
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }
}

/**
 * Returns the center of `square` on the board element in client coords.
 * White orientation: file a is left, rank 8 is top.
 */
function squareCenter(
  board: HTMLElement,
  square: Square,
): { x: number; y: number } {
  const fileIndex = "abcdefgh".indexOf(square[0] ?? "");
  const rank = Number(square[1]);
  return relativePoint(board, (fileIndex + 0.5) / 8, (8 - rank + 0.5) / 8);
}

type DragSpec = {
  from: Square;
  to: Square;
  button: number;
  moveButtons: number;
};

/**
 * Sweep a pointer drag across the board for `DRAG_DURATION_MS` at 60Hz.
 * Shared between rightButtonDrag and pieceDrag so they exercise the same
 * dispatch path; only the originating button and active buttons differ.
 */
async function dispatchDrag(
  board: HTMLElement,
  start: number,
  spec: DragSpec,
): Promise<void> {
  const startPt = squareCenter(board, spec.from);
  const endPt = squareCenter(board, spec.to);
  board.dispatchEvent(
    makePointer("pointerdown", {
      bubbles: true,
      button: spec.button,
      buttons: spec.button,
      clientX: startPt.x,
      clientY: startPt.y,
      pointerType: "mouse",
    }),
  );
  let now = performance.now();
  while (now < start + DRAG_DURATION_MS) {
    const t = (now - start) / DRAG_DURATION_MS;
    board.dispatchEvent(
      makePointer("pointermove", {
        bubbles: true,
        buttons: spec.moveButtons,
        clientX: startPt.x + (endPt.x - startPt.x) * t,
        clientY: startPt.y + (endPt.y - startPt.y) * t,
        pointerType: "mouse",
      }),
    );
    await sleep(DRAG_TICK_MS);
    now = performance.now();
  }
  board.dispatchEvent(
    makePointer("pointerup", {
      bubbles: true,
      button: spec.button,
      buttons: 0,
      clientX: endPt.x,
      clientY: endPt.y,
      pointerType: "mouse",
    }),
  );
}

const DRAG_DURATION_MS = 2000;
const DRAG_TICK_MS = 1000 / 60;

async function runScenario(
  scenario: ScenarioId,
  board: HTMLElement,
  instance: Chessboard,
  counters: ScenarioCounters,
): Promise<ScenarioResult> {
  counters.reset();
  const start = performance.now();

  if (scenario === "engineScoreDrift") {
    const baseline = buildAnnotations();
    for (let i = 0; i < 250; i++) {
      const next = baseline.map((a) =>
        a.id === "engine-pv"
          ? { ...a, metadata: { score: Math.sin(i / 10) } }
          : { ...a },
      );
      instance.set({ annotations: next });
      await sleep(20);
    }
  } else if (scenario === "fiftyMoves") {
    for (let i = 0; i < 50; i++) {
      const from: Square = i % 2 === 0 ? "b1" : "c3";
      const to: Square = i % 2 === 0 ? "c3" : "b1";
      instance.move(from, to, { presentation: { lastMove: { from, to } } });
      await sleep(0);
    }
  } else if (scenario === "rightButtonDrag") {
    await dispatchDrag(board, start, {
      from: "e2",
      to: "h5",
      button: 2,
      moveButtons: 2,
    });
  } else {
    await dispatchDrag(board, start, {
      from: "b1",
      to: "c3",
      button: 0,
      moveButtons: 1,
    });
  }

  const elapsed = performance.now() - start;
  const snapshot = counters.snapshot();
  const spec = EXPECTED.find((s) => s.id === scenario);
  return {
    id: scenario,
    label: spec?.label ?? scenario,
    ...snapshot,
    elapsedMs: Math.round(elapsed),
  };
}

function expectCell(
  result: ScenarioResult | undefined,
  spec: ScenarioSpec,
): "ok" | "fail" {
  if (!result) return "fail";
  const checks = Object.entries(spec.expected) as Array<
    [keyof CountersSnapshot, number]
  >;
  for (const [key, want] of checks) if (result[key] !== want) return "fail";
  return "ok";
}

function PerformanceFixture(): React.ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Chessboard | null>(null);
  const [results, setResults] = useState<
    Partial<Record<ScenarioId, ScenarioResult>>
  >({});
  const [running, setRunning] = useState(false);

  const basePosition = useMemo(() => positionFromFen(START_FEN), []);
  const baseInteraction = useMemo<Interaction>(
    () => ({
      destinations: demoDestinations(basePosition),
      onEvent: (_e: InteractionEvent) => {},
    }),
    [basePosition],
  );
  const basePresentation = useMemo<Presentation>(() => ({}), []);
  const baseAnnotations = useMemo<readonly Annotation[]>(
    () => buildAnnotations(),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const instance = createChessboard(host, {
      position: basePosition,
      orientation: "white",
      interaction: baseInteraction,
      presentation: basePresentation,
      annotations: baseAnnotations,
      ariaLabel: "Performance fixture",
    });
    instanceRef.current = instance;
    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [basePosition, baseInteraction, basePresentation, baseAnnotations]);

  const runAll = async () => {
    const host = hostRef.current;
    const instance = instanceRef.current;
    if (!host || !instance) return;
    // The renderer mounts a `.pw-board` div inside the host; pointer events
    // target that element directly.
    const board = host.querySelector(".pw-board") as HTMLElement | null;
    if (!board) return;
    setRunning(true);
    // Install instrumentation at run start, restore after the last scenario.
    const counters = new ScenarioCounters(board, instance);
    counters.install();
    const collected: ScenarioResult[] = [];
    try {
      for (const spec of EXPECTED) {
        // Reset to baseline so each scenario starts from the same DOM state.
        instance.set({
          position: basePosition,
          orientation: "white",
          interaction: baseInteraction,
          presentation: basePresentation,
          annotations: baseAnnotations,
        });
        await sleep(20);
        const result = await runScenario(spec.id, board, instance, counters);
        collected.push(result);
        setResults((prev) => ({ ...prev, [spec.id]: result }));
        await sleep(50);
      }
      // Use the freshly-collected snapshot, not the React state which lags.
      console.table(
        EXPECTED.map((spec) => {
          const result = collected.find((r) => r.id === spec.id);
          return {
            id: spec.id,
            expected: spec.expected,
            result,
            pass: expectCell(result, spec),
          };
        }),
      );
    } finally {
      counters.restore();
      setRunning(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        alignItems: "flex-start",
      }}
    >
      <div style={{ width: "24rem" }}>
        <div
          ref={hostRef}
          style={{ width: "100%" }}
          data-testid="performance-host"
        />
      </div>
      <button type="button" onClick={runAll} disabled={running}>
        {running ? "Running…" : "Run measurements"}
      </button>
      <table style={{ borderCollapse: "collapse", fontSize: ".75rem" }}>
        <thead>
          <tr>
            <th style={cellHead}>scenario</th>
            <th style={cellHead}>set()</th>
            <th style={cellHead}>move()</th>
            <th style={cellHead}>svg writes</th>
            <th style={cellHead}>mark rewrites</th>
            <th style={cellHead}>childList</th>
            <th style={cellHead}>longTasks</th>
            <th style={cellHead}>frameGaps&gt;50ms</th>
            <th style={cellHead}>elapsed</th>
            <th style={cellHead}>check</th>
          </tr>
        </thead>
        <tbody>
          {EXPECTED.map((spec) => {
            const r = results[spec.id];
            const status = expectCell(r, spec);
            const colour =
              status === "ok" ? "#dff0d8" : r ? "#f2dede" : "#f0f0f0";
            return (
              <tr key={spec.id} style={{ background: colour }}>
                <td style={cellBody}>
                  <div>{spec.id}</div>
                  <div style={{ opacity: 0.7 }}>{spec.note}</div>
                </td>
                <td style={cellNum}>{r?.setCalls ?? "—"}</td>
                <td style={cellNum}>{r?.moveCalls ?? "—"}</td>
                <td style={cellNum}>{r?.svgAttributeWrites ?? "—"}</td>
                <td style={cellNum}>{r?.markAttributeRewrites ?? "—"}</td>
                <td style={cellNum}>{r?.childListMutations ?? "—"}</td>
                <td style={cellNum}>{r?.longTasks ?? "—"}</td>
                <td style={cellNum}>{r?.frameGapsOver50ms ?? "—"}</td>
                <td style={cellNum}>{r ? `${r.elapsedMs}ms` : "—"}</td>
                <td style={cellNum}>{r ? status : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <details style={{ fontSize: ".75rem", maxWidth: "32rem" }}>
        <summary>Per-annotation SVG attribute writes</summary>
        <p>
          Tallies keyed by <code>data-annotation-id</code> for the most recent
          run; a row shows only when an annotation was written at least once.
        </p>
        <ul>
          {EXPECTED.map((spec) => {
            const r = results[spec.id];
            const tally = r?.svgWritesByAnnotationId ?? {};
            const ids = Object.keys(tally);
            return (
              <li key={spec.id}>
                <strong>{spec.id}</strong>
                {ids.length === 0 ? (
                  <>: none</>
                ) : (
                  <ul>
                    {ids
                      .sort((a, b) => (tally[b] ?? 0) - (tally[a] ?? 0))
                      .map((id) => (
                        <li key={id}>
                          <code>{id}</code>: {tally[id]}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      <details style={{ fontSize: ".75rem", maxWidth: "32rem" }}>
        <summary>Expected post-patch values</summary>
        <ul>
          {EXPECTED.map((spec) => (
            <li key={spec.id}>
              <strong>{spec.id}</strong>: {JSON.stringify(spec.expected)}
            </li>
          ))}
        </ul>
        <p>
          Scenario 1 must show 250 <code>set()</code> calls with{" "}
          <strong>0 SVG writes</strong> and <strong>0 mark rewrites</strong>
          {"; scenario 2 must show 50 "}
          <code>move()</code> calls with{" "}
          <strong>0 mark attribute rewrites</strong> (only add/remove churn on{" "}
          <code>.pw-mark</code>); scenarios 3–4 must complete with no long
          tasks.
        </p>
      </details>
    </div>
  );
}

const cellHead: React.CSSProperties = {
  borderBottom: "1px solid #ccc",
  padding: ".25rem .5rem",
  textAlign: "left",
};
const cellBody: React.CSSProperties = {
  padding: ".25rem .5rem",
  verticalAlign: "top",
};
const cellNum: React.CSSProperties = {
  padding: ".25rem .5rem",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

export default {
  title: "Chessboard/Performance",
  tags: ["autodocs"],
} satisfies Meta;

export const Performance = {
  render: () => <PerformanceFixture />,
};
