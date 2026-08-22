import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
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
      `import type { Piece, Square } from "@plywise/chessboard";
import "@plywise/chessboard/style.css";
import { Chessboard } from "@plywise/chessboard-react";
import { createRoot } from "react-dom/client";

const position = new Map<Square, Piece>([
  ["e1", { color: "white", role: "king" }],
  ["e8", { color: "black", role: "king" }],
]);
const host = document.getElementById("root");
if (!host) throw new Error("Missing #root element");
createRoot(host).render(<Chessboard position={position} />);
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
