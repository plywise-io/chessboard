// Loads each recipe story iframe and asserts the board mounts.

import { chromium } from "playwright-core";

const STORIES = [
  { id: "chessboard--docs", expect: ".sbdocs-content, .sbdocs, .docblock" },
  { id: "chessboard--default", expect: ".pw-board" },
  { id: "recipes-theming--built-in-themes", expect: ".pw-board" },
  { id: "recipes-theming--css-custom-properties", expect: ".pw-board" },
  { id: "recipes-accessibility--keyboard-navigation", expect: ".pw-board" },
  { id: "recipes-annotationlayers--toggleable-layers", expect: ".pw-board" },
  { id: "recipes-piecesets--curated-sets", expect: ".pw-board" },
  { id: "recipes-piecesets--unicode-glyphs", expect: ".pw-board" },
  { id: "recipes-chessjsintegration--chess-engine", expect: ".pw-board" },
];

const BASE = "http://localhost:6006";
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.PLAYWRIGHT_CHROMIUM,
});

let failed = 0;
const consoleErrors = [];

try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await ctx.newPage();
  page.on("pageerror", (err) =>
    consoleErrors.push(`pageerror: ${err.message}`),
  );
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`console.error: ${msg.text()}`);
    }
  });

  for (const { id, expect } of STORIES) {
    const url = `${BASE}/iframe.html?id=${id}&viewMode=story`;
    process.stdout.write(`loading ${id}… `);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    try {
      await page.waitForSelector(expect, { timeout: 15000 });
      console.log("OK");
    } catch (err) {
      failed++;
      console.log("FAIL — selector missing");
      console.error(`  ${err.message.split("\n")[0]}`);
    }
  }
} finally {
  await browser.close();
}

if (consoleErrors.length) {
  console.error(`\nconsole/page errors:`);
  for (const e of consoleErrors) console.error(`  ${e}`);
}

console.log(
  `\n${failed === 0 ? "all recipes load" : `${failed} recipe(s) failed`}`,
);
process.exit(failed === 0 && consoleErrors.length === 0 ? 0 : 1);
