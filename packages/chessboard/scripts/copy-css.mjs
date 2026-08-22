import { copyFile } from "node:fs/promises";

await Promise.all([
  copyFile("src/style.css", "dist/style.css"),
  copyFile("src/style.d.ts", "dist/style.d.ts"),
]);
