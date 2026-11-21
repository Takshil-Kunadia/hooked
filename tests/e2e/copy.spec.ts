import { expect, test, type Page } from "@playwright/test";
import { expectBeat, onlyDesktop, openAct, stepTo, visit, withoutStage } from "./helpers";

/** Longer than any hover card's grace period (hover-intent.ts caps it at 900 ms). */
const PAST_GRACE_MS = 1200;
/** Tab stops between the top of the page and the first word of the init act, with room to spare. */
const MAX_TABS = 60;

/** Whether the focused element is on screen: inside the viewport, under no clip, in a shown pin. */
const focusedIsVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return false;
    for (let node: Element | null = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.clipPath !== "none" || style.visibility === "hidden" || style.display === "none") return false;
    }
    const pin = el.closest<HTMLElement>("[data-pin]");
    const vis = Number(pin?.style.getPropertyValue("--vis") ?? "1");
    const r = el.getBoundingClientRect();
    return vis > 0 && r.width > 2 && r.top >= 0 && r.bottom <= window.innerHeight;
  });

test.describe("the copy", () => {
  test("every act's copy is in the accessibility tree", async ({ page }) => {
    await withoutStage(page);
    await page.goto("/");
    await expect(page.locator("#before [data-pin]")).toHaveAttribute("data-off", "");
    const snapshot = await page.locator("main").ariaSnapshot();
    /* each act's title, and the plainest stretch of text in each of its beats */
    const expected = await page.evaluate(() =>
      [...document.querySelectorAll("section.story-act")].map((act) => ({
        act: act.id,
        texts: [
          act.querySelector("h2")?.textContent ?? "",
          ...[...act.querySelectorAll(".story-beat-text")].map((text) =>
            [...text.childNodes, ...[...text.querySelectorAll("b")].flatMap((b) => [...b.childNodes])]
              .filter((n) => n.nodeType === Node.TEXT_NODE)
              .map((n) => (n.textContent ?? "").trim())
              .reduce((a, b) => (b.length > a.length ? b : a), ""),
          ),
        ],
      })),
    );
    expect(expected.map((a) => a.act)).toEqual(["before", "boot", "init", "next"]);
    for (const { act, texts } of expected) {
      for (const text of texts) expect(snapshot, `${act}: ${text}`).toContain(text.slice(0, 40));
    }
  });

  test("tabbing into a later act shows the focused word there", async ({ page }) => {
    await withoutStage(page);
    await visit(page, "/");
    await expectBeat(page, "hero/0");
    for (let i = 0; i < MAX_TABS; i += 1) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement?.closest("#init") != null)) break;
    }
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("data-card", "init");
    await expectBeat(page, "init/0");
    await expect.poll(() => focusedIsVisible(page), { timeout: 15_000 }).toBe(true);
  });

  test("a hover card stays open while the pointer is on it, and Esc dismisses it", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await page.setViewportSize({ width: 1440, height: 900 });
    /* a DOM card's timing, so run without the stage: SwiftShader stalls would eat the grace period */
    await withoutStage(page);
    await visit(page, "/#boot");
    await expect(page.locator("#boot [data-pin]")).not.toHaveAttribute("data-off", "");
    const word = page.locator('#boot code[data-card="wp-load.php"]');
    const card = page.locator(".hook-card");
    /* the card is a lazy island: until it has loaded, a hover goes unheard, so hover until it answers */
    await expect(async () => {
      await page.mouse.move(60, 40);
      await word.hover();
      await expect(card).toContainText("wp-load.php", { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(card).not.toHaveAttribute("data-pinned", "");
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    /* across the gap to the card (it sits past the copy column), then rest there */
    await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 40, { steps: 12 });
    await page.waitForTimeout(PAST_GRACE_MS);
    await expect(card).toContainText("wp-load.php");
    /* off both the word and the card: it closes after the grace period */
    await page.mouse.move(60, 40);
    await expect(card).toHaveCount(0, { timeout: 3000 });

    await word.hover();
    await expect(card).toContainText("wp-load.php");
    const focusBefore = await page.evaluate(() => document.activeElement?.tagName);
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(focusBefore);
  });

  test("a card's name lights up in the copy and on the board, both ways", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await withoutStage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAct(page, "boot");
    for (const beat of ["boot/1", "boot/2", "boot/3"] as const) await stepTo(page, beat);
    const row = (name: string) => page.locator(`.board tr[data-card="${name}"]`);
    const word = (name: string) => page.locator(`#boot [data-beats] code[data-card="${name}"]`);
    await expect(row("plugins_loaded")).toBeVisible();

    await word("plugins_loaded").hover();
    await expect(row("plugins_loaded")).toHaveAttribute("data-linked", "");
    await expect(word("plugins_loaded")).toHaveAttribute("data-linked", "");

    await row("setup_theme").hover();
    await expect(word("setup_theme")).toHaveAttribute("data-linked", "");
    await expect(row("setup_theme")).toHaveAttribute("data-linked", "");
    await expect(row("plugins_loaded")).not.toHaveAttribute("data-linked", "");
    await expect(word("plugins_loaded")).not.toHaveAttribute("data-linked", "");
  });
});
