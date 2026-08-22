import { expect, test } from "@playwright/test";

test("renders the initial position responsively", async ({ page }) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  await expect(board).toHaveAttribute("aria-label", "Initial chess position");
  await expect(page.locator(".pw-piece")).toHaveCount(32);
  await expect(page.locator('[data-square="e1"]')).toHaveText("♔");
  await expect(page.locator('[data-square="e8"]')).toHaveText("♚");

  await page.setViewportSize({ width: 400, height: 700 });
  const boardBox = await board.boundingBox();
  const pieceBox = await page.locator('[data-square="a1"]').boundingBox();
  expect(boardBox).not.toBeNull();
  expect(pieceBox).not.toBeNull();
  expect(boardBox?.width).toBe(boardBox?.height);
  expect(pieceBox?.width).toBe((boardBox?.width ?? 0) / 8);
});
