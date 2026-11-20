import { chromium, expect, test as base, type Page } from "@playwright/test";
import { openAct, stage, trackErrors, visit } from "./helpers";

/** The init board's three states, read from its rows. */
const doneTickets = (page: Page) => page.locator('.board tr[data-phase="done"]');
const allTickets = (page: Page) => page.locator(".board tbody tr");

async function stepToTickets(page: Page): Promise<void> {
  await visit(page, "/#init");
  await expect(page.locator("#init [data-beats] > li").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
}

/**
 * A page from a browser with WebGL switched off. The project's own browser has SwiftShader flags
 * (and `launchOptions` can't differ per describe block), so this launches its own.
 */
const test = base.extend<{ plainPage: Page }>({
  plainPage: async ({ viewport }, provide) => {
    const browser = await chromium.launch({
      ...(process.env.CI ? {} : { channel: "chrome" }),
      args: ["--disable-webgl", "--disable-3d-apis"],
    });
    const context = await browser.newContext({ viewport: viewport ?? { width: 1440, height: 900 } });
    await provide(await context.newPage());
    await context.close();
    await browser.close();
  },
});

test.describe("without WebGL", () => {
  test("shows readable copy, no canvas and no console errors", async ({ plainPage: page }) => {
    const errors = trackErrors(page, { strict: true });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await visit(page, "/#boot");
    const copy = page.locator("#boot [data-beats] > li[data-active]");
    await expect(copy).toBeVisible();
    expect((await copy.innerText()).trim().length).toBeGreaterThan(20);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the init board plays its cascade without a train", async ({ plainPage: page }) => {
    const errors = trackErrors(page, { strict: true });
    await stepToTickets(page);
    await expect(allTickets(page).first()).toBeVisible();
    const total = await allTickets(page).count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator(".board-title")).not.toContainText(/approaching/i);
    await expect(doneTickets(page)).toHaveCount(total, { timeout: 10_000 });
    expect(errors).toEqual([]);
  });
});

test("a lost WebGL context falls back to the copy", async ({ page }) => {
  const errors = trackErrors(page, { strict: true });
  await openAct(page, "init");
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(() => {
    const gl = document.querySelector("canvas")?.getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(stage(page)).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(allTickets(page).first()).toBeVisible();
  const total = await allTickets(page).count();
  await expect(doneTickets(page)).toHaveCount(total, { timeout: 10_000 });
  await expect(page.locator("#init [data-beats] > li[data-active]")).toBeVisible();
  expect(errors).toEqual([]);
});
