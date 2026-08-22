import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "..");
const temporary = await mkdtemp(join(tmpdir(), "plywise-chessboard-"));
const consumer = join(temporary, "consumer");

try {
  run("npm", [
    "pack",
    "--silent",
    "--pack-destination",
    temporary,
    join(repository, "packages/chessboard"),
  ]);
  run("npm", [
    "pack",
    "--silent",
    "--pack-destination",
    temporary,
    join(repository, "packages/chessboard-react"),
  ]);

  const archives = (await readdir(temporary))
    .filter((name) => name.endsWith(".tgz"))
    .map((name) => join(temporary, name));
  if (archives.length !== 2) throw new Error("Expected two package archives");

  await mkdir(join(consumer, "src"), { recursive: true });
  await Promise.all([
    writeFile(
      join(consumer, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    ),
    writeFile(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
    ),
    writeFile(
      join(consumer, "index.html"),
      '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
    ),
    writeFile(
      join(consumer, "src/main.tsx"),
      `import "@plywise/chessboard/style.css";
import type {
  Annotation,
  Interaction,
  InteractionEvent,
  Position,
  Presentation,
  Square,
} from "@plywise/chessboard";
import { createChessboard } from "@plywise/chessboard";
import { Chessboard } from "@plywise/chessboard-react";
import { createRoot } from "react-dom/client";

const position = new Map<Square, { color: "white" | "black"; role: "pawn" }>([
  ["e2", { color: "white", role: "pawn" }],
  ["e4", { color: "black", role: "pawn" }],
]) satisfies Position;

const annotations: readonly Annotation[] = [
  { id: "best", kind: "arrow", from: "e2", to: "e4", layer: "engine" },
  { id: "weak", kind: "circle", square: "d5", layer: "user" },
];

const presentation: Presentation = {
  selected: "e2",
  lastMove: { from: "e2", to: "e4" },
};

const destinations = new Map<Square, readonly Square[]>([
  ["e2", ["e3", "e4"]],
]);

const host = document.getElementById("root");
if (!host) throw new Error("Missing #root element");

const board = createChessboard(host, { position, presentation, annotations });

const onEvent = (event: InteractionEvent) => {
  if (event.type === "move") board.move(event.from, event.to);
};

const interaction: Interaction = { destinations, onEvent };

board.set({ interaction, visibleLayers: new Set(["user", "engine"]) });
board.destroy();

createRoot(host).render(
  <Chessboard
    position={position}
    interaction={interaction}
    annotations={annotations}
    visibleLayers={new Set(["user", "engine"])}
  />,
);
`,
    ),
  ]);

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...archives,
      "react@19",
      "react-dom@19",
      "@types/react@19",
      "@types/react-dom@19",
    ],
    consumer,
  );
  await Promise.all(
    ["agent-state.js", "agent-state.d.ts"].map((name) =>
      assertMissing(
        join(consumer, "node_modules/@plywise/chessboard/dist/internal", name),
      ),
    ),
  );
  run(join(repository, "node_modules/.bin/tsc"), ["--noEmit"], consumer);
  run(join(repository, "node_modules/.bin/vite"), ["build"], consumer);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function run(command, args, cwd = repository) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, CI: "1" },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

async function assertMissing(path) {
  try {
    await access(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Unexpected internal package file: ${path}`);
}
