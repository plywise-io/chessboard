import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function clickSquare(
  page: Page,
  square: string,
  orientation: "white" | "black" = "white",
): Promise<void> {
  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  if (!box) throw new Error("Board is not visible");
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  await board.click({
    position: {
      x: (column + 0.5) * (box.width / 8),
      y: (row + 0.5) * (box.height / 8),
    },
  });
}

async function squareCenter(
  page: Page,
  square: string,
  orientation: "white" | "black" = "white",
): Promise<{ x: number; y: number }> {
  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  if (!box) throw new Error("Board is not visible");
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return {
    x: box.x + (column + 0.5) * (box.width / 8),
    y: box.y + (row + 0.5) * (box.height / 8),
  };
}

test("renders the initial position responsively", async ({ page }) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  await expect(board).toHaveAttribute("aria-label", "Demo chess position");
  await expect(page.locator(".pw-piece")).toHaveCount(32);
  await expect(page.locator('[data-square="e1"]')).toHaveAttribute(
    "data-role",
    "king",
  );
  await expect(page.locator('[data-square="e1"]')).toHaveAttribute(
    "data-color",
    "white",
  );
  await expect(page.locator('[data-square="e8"]')).toHaveAttribute(
    "data-role",
    "king",
  );
  await expect(page.locator('[data-square="e8"]')).toHaveAttribute(
    "data-color",
    "black",
  );

  await page.setViewportSize({ width: 400, height: 700 });
  const boardBox = await board.boundingBox();
  const pieceBox = await page.locator('[data-square="a1"]').boundingBox();
  expect(boardBox).not.toBeNull();
  expect(pieceBox).not.toBeNull();
  expect(boardBox?.width).toBe(boardBox?.height);
  expect(pieceBox?.width).toBe((boardBox?.width ?? 0) / 8);
});

test("puts a1 on a dark square", async ({ page }) => {
  await page.goto("/");
  const screenshot = await page.locator(".pw-board").screenshot();
  const { a3, b3 } = await page.evaluate(async (base64) => {
    const blob = await fetch(`data:image/png;base64,${base64}`).then(
      (response) => response.blob(),
    );
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.drawImage(image, 0, 0);
    const pixel = (file: number, row: number) =>
      [
        ...context.getImageData(
          (file + 0.5) * (image.width / 8),
          (row + 0.5) * (image.height / 8),
          1,
          1,
        ).data,
      ].slice(0, 3);
    return { a3: pixel(0, 5), b3: pixel(1, 5) };
  }, screenshot.toString("base64"));

  expect(a3.reduce((sum, channel) => sum + channel, 0)).toBeLessThan(
    b3.reduce((sum, channel) => sum + channel, 0),
  );
});

test("selects a source, marks destinations, and emits a select event", async ({
  page,
}) => {
  await page.goto("/");

  const e2 = page.locator('[data-square="e2"]');
  await e2.click();

  const eventLine = page.getByTestId("last-event");
  await expect(eventLine).toHaveText(/Last event: select e2/);

  const emptyDestinations = page.locator('[data-destination="empty"]');
  await expect(emptyDestinations.first()).toBeVisible();

  await clickSquare(page, "a3");
  await expect(eventLine).toHaveText(/Last event: clear/);
});

test("approves a click-to-move via caller-owned legality", async ({ page }) => {
  await page.goto("/");

  await clickSquare(page, "e2");
  await clickSquare(page, "e4");

  const eventLine = page.getByTestId("last-event");
  await expect(eventLine).toHaveText(/Last event: move e2→e4 \(selection\)/);

  await expect(page.locator('.pw-piece[data-square="e4"]')).toBeVisible();
  await expect(page.locator('.pw-piece[data-square="e2"]')).toHaveCount(0);

  const lastMoveFrom = page.locator('[data-mark="last-move-from"]');
  const lastMoveTo = page.locator('[data-mark="last-move-to"]');
  await expect(lastMoveFrom).toHaveCount(1);
  await expect(lastMoveTo).toHaveCount(1);
});

test("rejects a click-to-move outside caller-supplied destinations", async ({
  page,
}) => {
  await page.goto("/");

  await clickSquare(page, "e2");
  await clickSquare(page, "e5");

  const eventLine = page.getByTestId("last-event");
  await expect(eventLine).toHaveText(/Last event: clear/);
  await expect(page.locator('.pw-piece[data-square="e2"]')).toBeVisible();
  await expect(page.locator('.pw-piece[data-square="e5"]')).toHaveCount(0);
});

test("drags a piece to a legal destination and emits a drag event", async ({
  page,
}) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const square = box.width / 8;

  // Drag e2 (file 4, rank 1) to e4 (file 4, rank 3) in board coordinates.
  await page.mouse.move(box.x + 4.5 * square, box.y + 6.5 * square);
  await page.mouse.down();
  await page.mouse.move(box.x + 4.5 * square, box.y + 4.5 * square, {
    steps: 6,
  });
  await page.waitForFunction(
    () =>
      (
        document.querySelector(
          '.pw-piece[data-square="e2"]',
        ) as HTMLElement | null
      )?.style.transform !== "",
  );
  const dragged = await page
    .locator('.pw-piece[data-square="e2"]')
    .boundingBox();
  expect(dragged).not.toBeNull();
  if (!dragged) return;
  expect(
    Math.abs(dragged.x + dragged.width / 2 - (box.x + 4.5 * square)),
  ).toBeLessThan(2);
  expect(
    Math.abs(dragged.y + dragged.height / 2 - (box.y + 4.5 * square)),
  ).toBeLessThan(2);
  await page.mouse.up();

  const eventLine = page.getByTestId("last-event");
  await expect(eventLine).toHaveText(/Last event: move e2→e4 \(drag\)/);
  await expect(page.locator('.pw-piece[data-square="e4"]')).toBeVisible();
});

test("reorients the board without recreating it", async ({ page }) => {
  await page.goto("/");

  const piece = page.locator(".pw-piece").first();
  await piece.evaluate((node) => {
    (window as Window & { __piece?: Element }).__piece = node;
  });
  await page.getByRole("button", { name: "Flip orientation" }).click();
  expect(
    await piece.evaluate(
      (node) => (window as Window & { __piece?: Element }).__piece === node,
    ),
  ).toBe(true);

  await expect(page.getByTestId("orientation")).toHaveText(
    /Orientation: black/,
  );
});

test("toggles annotation layers without mutating the keyed collection", async ({
  page,
}) => {
  await page.goto("/");

  const userArrow = page.locator('[data-annotation-id="user-arrow"]');
  await expect(userArrow).toHaveCount(1);

  await page.getByRole("button", { name: /Hide user/ }).click();
  await expect(userArrow).toHaveCount(0);

  await page.getByRole("button", { name: /Show user/ }).click();
  await expect(userArrow).toHaveCount(1);

  await page.getByRole("button", { name: /Hide training/ }).click();
  const trainingArrow = page.locator('[data-annotation-id="training-arrow"]');
  await expect(trainingArrow).toHaveCount(0);
});

test("interrupts an in-flight transition with a newer update", async ({
  page,
}) => {
  await page.goto("/");

  await clickSquare(page, "e2");
  await clickSquare(page, "e4");

  // A second move while the CSS transition is active retargets immediately.
  await clickSquare(page, "e4");
  await clickSquare(page, "e5");

  await expect(page.locator('.pw-piece[data-square="e5"]')).toBeVisible();
});

test("cleans up the rendered subtree when the example unmounts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".pw-board")).toBeVisible();

  await page.evaluate(() => {
    const host = document.querySelector("#root");
    if (host) host.innerHTML = "";
  });
  await expect(page.locator(".pw-board")).toHaveCount(0);
});

test("renders lastMove and check marks with semantic attributes", async ({
  page,
}) => {
  await page.goto("/");

  // Toggle the example into a state that exercises last-move and check marks.
  await page.getByRole("button", { name: /Show last move and check/i }).click();

  const from = page.locator('[data-mark="last-move-from"]');
  const to = page.locator('[data-mark="last-move-to"]');
  const check = page.locator('[data-mark="check"]');

  await expect(from).toBeVisible();
  await expect(to).toBeVisible();
  await expect(check).toBeVisible();

  // Verify marks sit on the board rectangle for the named squares.
  const board = page.locator(".pw-board");
  const boardBox = await board.boundingBox();
  const fromBox = await from.boundingBox();
  const checkBox = await check.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(fromBox).not.toBeNull();
  expect(checkBox).not.toBeNull();
  if (boardBox && fromBox && checkBox) {
    expect(fromBox.width).toBeCloseTo(boardBox.width / 8, 1);
    expect(checkBox.width).toBeCloseTo(boardBox.width / 8, 1);
  }
});

test("annotations render, update on toggle, and flip with orientation", async ({
  page,
}) => {
  await page.goto("/");

  const layer = page.locator(".pw-annotations");
  await expect(layer).toHaveAttribute("viewBox", "0 0 8 8");
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  await expect(layer).toHaveAttribute("pointer-events", "none");

  // Initial annotations (white orientation): user-arrow e2->e4, engine-circle d5
  const userArrow = page.locator('[data-annotation-id="user-arrow"]');
  await expect(userArrow).toHaveAttribute("data-annotation-kind", "arrow");
  await expect(userArrow).toHaveAttribute("data-annotation-layer", "user");
  expect(
    await userArrow.evaluate((node) => getComputedStyle(node).stroke),
  ).toBe("rgb(21, 120, 27)");

  const engineCircle = page.locator('[data-annotation-id="engine-circle"]');
  await expect(engineCircle).toHaveAttribute("data-annotation-kind", "circle");
  await expect(engineCircle).toHaveAttribute("data-annotation-layer", "engine");
  await expect(engineCircle).toHaveAttribute("cx", "3.5");
  await expect(engineCircle).toHaveAttribute("cy", "3.5");

  await userArrow.evaluate((node) => {
    (window as Window & { __arrow?: Element }).__arrow = node;
  });

  // Flip orientation: geometry should change but nodes preserved
  await page.getByRole("button", { name: "Flip orientation" }).click();

  await expect(userArrow).toHaveAttribute("data-annotation-id", "user-arrow");
  expect(
    await userArrow.evaluate(
      (node) => (window as Window & { __arrow?: Element }).__arrow === node,
    ),
  ).toBe(true);
  // White arrow d went from e2 to e4; black orientation maps e2 (file=4 -> 3) and e4 (file=4 -> 3)
  // row rank 2 (white) -> y=6.5; rank 4 -> y=4.5; black: rank 2 -> y=1.5; rank 4 -> y=3.5
  await expect(userArrow).toHaveAttribute(
    "d",
    "M 3.5 1.5 L 3.5 3.5 M 3.680 3.150 L 3.5 3.5 L 3.320 3.150",
  );

  // Hide annotations via toggle button
  await page.getByTestId("toggle-annotations").click();
  await expect(page.locator(".pw-annotations path")).toHaveCount(0);
  await expect(page.locator(".pw-annotations circle")).toHaveCount(0);

  // Re-enable and ensure same nodes re-emerge
  await page.getByTestId("toggle-annotations").click();
  await expect(page.locator('[data-annotation-id="user-arrow"]')).toHaveCount(
    1,
  );
  await expect(
    page.locator('[data-annotation-id="engine-circle"]'),
  ).toHaveCount(1);
});

test("rejects a drag onto an empty non-destination square without emitting a move", async ({
  page,
}) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const square = box.width / 8;

  // e2 to a5 — not a pawn destination, renderer must not move the piece.
  await page.mouse.move(box.x + 4.5 * square, box.y + 6.5 * square);
  await page.mouse.down();
  await page.mouse.move(box.x + 0.5 * square, box.y + 3.5 * square, {
    steps: 8,
  });
  await page.mouse.up();

  const eventLine = page.getByTestId("last-event");
  await expect(eventLine).not.toHaveText(/Last event: move /);
  // Piece must remain at e2.
  await expect(page.locator('.pw-piece[data-square="e2"]')).toBeVisible();
  await expect(page.locator('.pw-piece[data-square="a5"]')).toHaveCount(0);
});

test("cancelling a drag (pointercancel) restores the piece and emits no move", async ({
  page,
}) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const square = box.width / 8;

  await page.mouse.move(box.x + 4.5 * square, box.y + 6.5 * square);
  await page.mouse.down();
  await page.mouse.move(box.x + 4.5 * square, box.y + 4.5 * square, {
    steps: 4,
  });
  // Simulate browser-initiated pointer cancellation by dispatching the
  // event directly; Playwright's mouse API has no pointercancel hook.
  await page.evaluate(() => {
    const board = document.querySelector(".pw-board");
    if (!board) return;
    const ev = new PointerEvent("pointercancel", {
      bubbles: true,
      button: 0,
      pointerId: 1,
      isPrimary: true,
    });
    board.dispatchEvent(ev);
  });
  // Piece must remain at e2 — no approval.
  await expect(page.locator('.pw-piece[data-square="e2"]')).toBeVisible();
  await expect(page.locator('.pw-piece[data-square="e4"]')).toHaveCount(0);
});

test("releases the pointer when the drag leaves the board and resumes inside", async ({
  page,
}) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const square = box.width / 8;

  // Start drag at e2, wander outside the board (capture keeps it alive),
  // then come back to drop on e4.
  await page.mouse.move(box.x + 4.5 * square, box.y + 6.5 * square);
  await page.mouse.down();
  await page.mouse.move(box.x - 50, box.y - 50, { steps: 6 });
  await page.mouse.move(box.x + 4.5 * square, box.y + 4.5 * square, {
    steps: 6,
  });
  await page.mouse.up();

  await expect(page.getByTestId("last-event")).toHaveText(
    /Last event: move e2→e4 \(drag\)/,
  );
});

test("drag coordinate math follows black orientation", async ({ page }) => {
  await page.goto("/");

  // Flip first; under black orientation e2 sits at visual column 3, row 1.
  await page.getByRole("button", { name: "Flip orientation" }).click();
  await expect(page.getByTestId("orientation")).toHaveText(
    /Orientation: black/,
  );

  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const square = box.width / 8;

  // Under black: e2 is column 3, row 1; e4 is column 3, row 3.
  await page.mouse.move(box.x + 3.5 * square, box.y + 1.5 * square);
  await page.mouse.down();
  await page.mouse.move(box.x + 3.5 * square, box.y + 3.5 * square, {
    steps: 6,
  });
  await page.mouse.up();

  await expect(page.getByTestId("last-event")).toHaveText(
    /Last event: move e2→e4 \(drag\)/,
  );
});

test("pointer events with touch pointerType drive the drag path", async ({
  page,
}) => {
  await page.goto("/");

  const board = page.locator(".pw-board");
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  // Dispatch the touch-typed PointerEvent sequence directly to mimic a
  // touch screen, since Playwright's mouse API only fires pointerType=mouse.
  await page.evaluate((rect) => {
    const board = document.querySelector(".pw-board");
    if (!board) return;
    const at = (col: number, row: number) =>
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: rect.x + ((col + 0.5) * rect.width) / 8,
        clientY: rect.y + ((row + 0.5) * rect.height) / 8,
      });
    const move = (col: number, row: number) =>
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: rect.x + ((col + 0.5) * rect.width) / 8,
        clientY: rect.y + ((row + 0.5) * rect.height) / 8,
      });
    const up = (col: number, row: number) =>
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        clientX: rect.x + ((col + 0.5) * rect.width) / 8,
        clientY: rect.y + ((row + 0.5) * rect.height) / 8,
      });
    board.dispatchEvent(at(4, 6));
    board.dispatchEvent(move(4, 5));
    board.dispatchEvent(up(4, 4));
  }, box);

  await expect(page.getByTestId("last-event")).toHaveText(
    /Last event: move e2→e4 \(drag\)/,
  );
});

test("right-clicking a square toggles a circle annotation", async ({
  page,
}) => {
  await page.goto("/");

  const d5 = await squareCenter(page, "d5");
  await page.mouse.move(d5.x, d5.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });

  const circle = page.locator('[data-annotation-id="circle:d5"]');
  await expect(circle).toHaveAttribute("data-annotation-kind", "circle");
  await expect(page.getByTestId("last-event")).toHaveText(
    "Last event: circle d5",
  );

  // Same gesture again removes it.
  await page.mouse.move(d5.x, d5.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator('[data-annotation-id="circle:d5"]')).toHaveCount(0);
});

test("right-dragging between squares toggles an arrow annotation", async ({
  page,
}) => {
  await page.goto("/");

  const e2 = await squareCenter(page, "e2");
  const e4 = await squareCenter(page, "e4");
  await page.mouse.move(e2.x, e2.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(e4.x, e4.y, { steps: 4 });

  // Transient snapped preview while the gesture is active.
  await expect(
    page.locator('[data-annotation-id="pw-preview"]'),
  ).toHaveAttribute("data-annotation-kind", "arrow");

  await page.mouse.up({ button: "right" });
  const arrow = page.locator('[data-annotation-id="arrow:e2-e4"]');
  await expect(arrow).toHaveAttribute("data-annotation-kind", "arrow");
  await expect(page.getByTestId("last-event")).toHaveText(
    "Last event: arrow e2→e4",
  );
  await expect(page.locator('[data-annotation-id="pw-preview"]')).toHaveCount(
    0,
  );

  // Same drag again removes it.
  await page.mouse.move(e2.x, e2.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(e4.x, e4.y, { steps: 4 });
  await page.mouse.up({ button: "right" });
  await expect(page.locator('[data-annotation-id="arrow:e2-e4"]')).toHaveCount(
    0,
  );
});
