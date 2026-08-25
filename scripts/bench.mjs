#!/usr/bin/env node
/**
 * Reproducible browser benchmark runner.
 *
 * Drives the existing `@playwright/test` Chromium and Vite toolchain to
 * measure the renderer's representative update, interaction, annotation,
 * and multi-board workloads. Reports deterministic median/p95/p99 JS
 * duration plus board-owned created/removed node counts and environment
 * parameters in a machine- and human-readable JSON document.
 *
 * Timing results are advisory. Correctness failures fail the command.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, version } from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY = resolve(SCRIPT_DIR, "..");
const BENCH_ROOT = resolve(REPOSITORY, "examples/benchmarks");
const REPORT_DIR = resolve(REPOSITORY, "benchmarks");
const REPORT_PATH = resolve(REPORT_DIR, "report.json");
const VITE_PORT = Number(process.env.PW_BENCH_PORT ?? 4174);
const VITE_URL = `http://127.0.0.1:${VITE_PORT}`;

const SAMPLES = Number(process.env.PW_BENCH_SAMPLES ?? 30);
const WARMUP = Number(process.env.PW_BENCH_WARMUP ?? 3);
const ITERATIONS = Number(process.env.PW_BENCH_ITERATIONS ?? 1000);
const DRAG_FRAMES = Number(process.env.PW_BENCH_DRAG_FRAMES ?? 240);
const DRAG_BOARDS = [32, 50];

const SCENARIOS = [
  "ordinaryApprovedMove",
  "bulkNavigation",
  "arbitraryReplacement",
  "annotationReplacement",
  ...DRAG_BOARDS.map((count) => ({ name: "multiBoard", count })),
  { name: "dragInput", rateHz: 60, frames: DRAG_FRAMES },
  { name: "dragInput", rateHz: 120, frames: DRAG_FRAMES },
];

const FILES_INDEX = new Map([
  ["a", 0],
  ["b", 1],
  ["c", 2],
  ["d", 3],
  ["e", 4],
  ["f", 5],
  ["g", 6],
  ["h", 7],
]);

async function readPackageVersion(relativePath) {
  try {
    const raw = await readFile(resolve(REPOSITORY, relativePath), "utf8");
    return JSON.parse(raw).version;
  } catch {
    return "unknown";
  }
}

const envSnapshot = async (browserVersion) => ({
  node: version,
  platform: `${platform()} ${release()} ${arch()}`,
  cpu: cpus()[0]?.model ?? "unknown",
  cpuCount: cpus().length,
  playwright: await readPackageVersion(
    "node_modules/@playwright/test/package.json",
  ),
  vite: await readPackageVersion("node_modules/vite/package.json"),
  chessboard: await readPackageVersion("packages/chessboard/package.json"),
  reactAdapter: await readPackageVersion(
    "packages/chessboard-react/package.json",
  ),
  browser: `chromium ${browserVersion}`,
  samples: SAMPLES,
  warmup: WARMUP,
});

function percentile(samples, ratio) {
  const sorted = [...samples].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const rank = Math.min(
    sorted.length,
    Math.max(1, Math.ceil(ratio * sorted.length)),
  );
  return sorted[rank - 1] ?? 0;
}

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

function summarize(samples) {
  if (!samples || samples.length === 0) {
    return { median: 0, p95: 0, p99: 0, min: 0, max: 0, count: 0 };
  }
  return {
    median: median(samples),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
    min: Math.min(...samples),
    max: Math.max(...samples),
    count: samples.length,
  };
}

function runChild(command, args, options = {}) {
  return new Promise((resolveChild, rejectChild) => {
    const child = spawn(command, args, {
      cwd: REPOSITORY,
      stdio: ["ignore", "pipe", "pipe"],
      signal: options.signal,
      env: { ...process.env, ...(options.env ?? {}) },
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectChild);
    child.on("close", (code) => {
      if (code === 0) resolveChild();
      else
        rejectChild(
          new Error(
            `${command} ${args.join(" ")} exited with status ${code}\n${stderr}`,
          ),
        );
    });
  });
}

async function ensureBuilt() {
  if (process.env.PW_BENCH_SKIP_BUILD === "1") return;
  await runChild("npm", ["run", "build"]);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await Promise.race([exited, delay(1_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, delay(1_000)]);
  }
}
async function startVite() {
  const child = spawn(
    "node",
    [
      resolve(REPOSITORY, "node_modules/vite/bin/vite.js"),
      BENCH_ROOT,
      "--port",
      String(VITE_PORT),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    {
      cwd: REPOSITORY,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const ready = await waitForHttp(VITE_URL, {
    attempts: 60,
    intervalMs: 250,
  });
  if (!ready) {
    await stopChild(child);
    throw new Error(`Vite dev server did not become ready.\n${stderr}`);
  }
  return child;
}

async function waitForHttp(url, { attempts, intervalMs }) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 304) return true;
    } catch {
      // not ready yet
    }
    await delay(intervalMs);
  }
  return false;
}

async function runJsScenario(page, name, params = {}) {
  return page.evaluate(
    async ([scenario, args]) => window.__pw_bench.runScenario(scenario, args),
    [name, { samples: SAMPLES, warmup: WARMUP, ...params }],
  );
}

async function runDragScenario(page, { rateHz, frames }) {
  const setup = await runJsScenario(page, "prepareDragSession");
  await page.waitForSelector(setup.hostSelector);
  const boardBox = setup.boardBox;
  const squareSize = setup.squareSize;
  // White orientation: file=a→left, rank=1→bottom. Source square e2:
  // x = board left + squareSize * fileIndex; y = board top + (board height - squareSize * rank)
  const sourceX = boardBox.x + squareSize * (FILES_INDEX.get("e") + 0.5);
  const sourceY = boardBox.y + boardBox.height - squareSize * 1.5;
  const destX = sourceX + squareSize * 2; // two files right (toward g)
  const destY = sourceY - squareSize * 2; // two ranks up (toward 4)

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  const intervalMs = 1000 / rateHz;
  const start = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = (i + 1) / frames;
    const x = sourceX + (destX - sourceX) * t;
    const y = sourceY + (destY - sourceY) * t;
    await page.mouse.move(x, y, { steps: 1 });
    const elapsed = Date.now() - start;
    const expected = Math.round((i + 1) * intervalMs);
    if (elapsed < expected) {
      await new Promise((resolveSleep) =>
        setTimeout(resolveSleep, expected - elapsed),
      );
    }
  }
  await page.mouse.up();
  const result = await runJsScenario(page, "collectDragSession");
  return {
    rateHz,
    framesRequested: frames,
    pointerEvents: result.pointerEvents ?? 0,
    // Playwright input cadence only; this is not renderer pipeline timing.
    pointerInterval: summarize(result.pointerIntervals ?? []),
    // Aggregate DOM mutations during the whole drag, not per-frame work.
    nodes: result.nodes ?? { created: 0, removed: 0, attributeRecords: 0 },
  };
}

async function main() {
  let vite;
  let browser;
  let context;
  let page;
  let browserVersion = "unknown";
  const scenarios = [];
  const consoleErrors = [];
  let correctnessFailure = null;

  try {
    await ensureBuilt();
    await mkdir(REPORT_DIR, { recursive: true });
    vite = await startVite();
    browser = await chromium.launch({ headless: true });
    browserVersion = browser.version();
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    page.on("pageerror", (error) =>
      consoleErrors.push(`pageerror: ${error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(`console.error: ${message.text()}`);
      }
    });

    await page.goto(VITE_URL, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(window.__pw_bench));

    for (const scenario of SCENARIOS) {
      const scenarioName =
        typeof scenario === "string" ? scenario : scenario.name;
      try {
        if (scenarioName === "dragInput") {
          const result = await runDragScenario(page, scenario);
          if (result.pointerEvents === 0) {
            throw new Error(
              `dragInput@${result.rateHz}Hz delivered no pointer events`,
            );
          }
          scenarios.push({ name: scenarioName, ...result });
          continue;
        }
        if (scenarioName === "multiBoard") {
          const count = scenario.count;
          const viewport = page.viewportSize() ?? { width: 0, height: 0 };
          const raw = await runJsScenario(page, scenarioName, {
            count,
            iterations: Number(process.env.PW_BENCH_MULTI_ITERATIONS ?? 50),
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
          });
          scenarios.push({
            name: `${scenarioName}-${count}`,
            boardCount: count,
            iterations: raw.iterations,
            duration: summarize(raw.durations),
            nodes: raw.nodes,
            correctness: assertMultiBoard(raw, count),
          });
          continue;
        }
        if (scenarioName === "bulkNavigation") {
          const iterationsPerSample = Number(
            process.env.PW_BENCH_PER_SAMPLE ?? 25,
          );
          const raw = await runJsScenario(page, scenarioName, {
            iterations: ITERATIONS,
            perSample: iterationsPerSample,
          });
          scenarios.push({
            name: scenarioName,
            iterations: raw.iterations,
            iterationsPerSample,
            batchDuration: summarize(raw.durations ?? []),
            perIteration: summarize(raw.perIteration ?? []),
            nodes: raw.nodes,
          });
          continue;
        }
        const raw = await runJsScenario(page, scenarioName);
        scenarios.push({
          name: scenarioName,
          duration: summarize(raw.durations),
          nodes: raw.nodes,
          ...assertScenarioCorrectness(scenarioName, raw),
        });
      } catch (error) {
        correctnessFailure = `${scenarioName}: ${error?.message ?? String(error)}`;
        break;
      }
    }
  } finally {
    if (page) {
      try {
        await page.evaluate(() => window.__pw_bench?.teardownAll?.());
      } catch {
        // Page may already be closing.
      }
      await page.close().catch(() => {});
    }
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await stopChild(vite);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: await envSnapshot(browserVersion),
    scenarios,
    consoleErrors,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (correctnessFailure) {
    throw new Error(`Correctness failure: ${correctnessFailure}`);
  }
}

function assertScenarioCorrectness(name, raw) {
  const nodes = raw.nodes ?? { created: 0, removed: 0 };
  if (name === "ordinaryApprovedMove") {
    // Moving e2→e4→e2 should not churn piece nodes: zero created/removed.
    if (nodes.created !== 0 || nodes.removed !== 0) {
      throw new Error(
        `ordinaryApprovedMove churned ${nodes.created} created / ${nodes.removed} removed nodes`,
      );
    }
  }
  if (name === "annotationReplacement") {
    if (nodes.created === 0 && nodes.removed === 0) {
      throw new Error("annotationReplacement produced no DOM changes");
    }
  }
  return {};
}

function assertMultiBoard(raw, count) {
  if (raw.nodes == null)
    throw new Error("multiBoard did not report node deltas");
  const visibility = raw.visibility ?? {};
  if (visibility.requestedViewport) {
    const { width, height } = visibility.requestedViewport;
    if (visibility.lastBoardBottom > height) {
      throw new Error(
        `multiBoard last board bottom (${visibility.lastBoardBottom}) exceeds viewport height (${height}); reduce count or resize arena`,
      );
    }
    if (visibility.lastBoardRight > width) {
      throw new Error(
        `multiBoard last board right (${visibility.lastBoardRight}) exceeds viewport width (${width}); reduce count or resize arena`,
      );
    }
  }
  return {
    boardCount: count,
    visibility,
  };
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  process.exit(1);
});
