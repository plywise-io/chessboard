// Records a sequence of frames of the Vite example and saves them as PNGs.
// Encode with ffmpeg afterward.

import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const OUT_DIR = "/tmp/hero-frames";
const FPS = 12;
const FRAME_INTERVAL_MS = 1000 / FPS;

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.PLAYWRIGHT_CHROMIUM,
});

try {
  const ctx = await browser.newContext({
    viewport: { width: 640, height: 640 },
  });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector(".pw-board");

  const sleep = (ms) => page.waitForTimeout(ms);

  // Returns the (x, y) center of the named square in client coords.
  // White orientation: file a is left, rank 8 is top.
  const square = async (name) => {
    const rect = await page
      .locator(".pw-board")
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
    const file = "abcdefgh".indexOf(name[0]);
    const rank = Number(name[1]) - 1;
    // Layout: top-left is a8 under white orientation, 8 ranks × 8 files.
    const cellW = rect.w / 8;
    const cellH = rect.h / 8;
    return {
      x: rect.x + cellW * (file + 0.5),
      y: rect.y + cellH * (8 - rank - 1 + 0.5),
    };
  };

  const shot = async (n) => {
    await page.screenshot({
      path: `${OUT_DIR}/frame-${String(n).padStart(3, "0")}.png`,
    });
  };

  // 1. Idle initial position
  for (let i = 0; i < 4; i++) {
    await shot(i);
    await sleep(FRAME_INTERVAL_MS);
  }

  // 2. Click e2 → highlight destinations
  {
    const p = await square("e2");
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await sleep(80);
    await page.mouse.up();
    for (let i = 0; i < 3; i++) {
      await shot(4 + i);
      await sleep(FRAME_INTERVAL_MS);
    }
  }

  // 3. Click e4 (legal destination)
  {
    const p = await square("e4");
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await sleep(60);
    await page.mouse.up();
    for (let i = 0; i < 4; i++) {
      await shot(7 + i);
      await sleep(FRAME_INTERVAL_MS);
    }
  }

  // 4. Drag g1 -> f3
  {
    const from = await square("g1");
    const to = await square("f3");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await sleep(40);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      await page.mouse.move(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t,
      );
      await sleep(FRAME_INTERVAL_MS * 0.6);
      await shot(11 + i);
    }
    await page.mouse.up();
    for (let i = 0; i < 3; i++) {
      await shot(20 + i);
      await sleep(FRAME_INTERVAL_MS);
    }
  }

  // 5. Right-drag arrow from d5 to e7
  {
    const from = await square("d5");
    const to = await square("e7");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button: "right" });
    await sleep(40);
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      await page.mouse.move(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t,
      );
      await sleep(FRAME_INTERVAL_MS * 0.7);
      await shot(23 + i);
    }
    await page.mouse.up({ button: "right" });
    for (let i = 0; i < 4; i++) {
      await shot(29 + i);
      await sleep(FRAME_INTERVAL_MS);
    }
  }

  console.log("done");
} finally {
  await browser.close();
}
