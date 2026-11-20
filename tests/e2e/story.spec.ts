import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  BEATS,
  onlyDesktop,
  openAct,
  readKeyLog,
  readStageLog,
  recordStage,
  stage,
  stepTo,
  trackErrors,
  visit,
} from "./helpers";

const SAMPLES = 50;

test.describe("the story", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`one copy block at a time at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      onlyDesktop(testInfo);
      await page.setViewportSize(viewport);
      /* a layout property of the copy, so run without the stage: SwiftShader frames would starve the sampler */
      await page.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = () => null;
      });
      await page.goto("/?snap=off");
      await expect(page.locator("#boot [data-pin]")).toHaveAttribute("style", /--vis/);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let i = 0; i <= SAMPLES; i += 1) {
        const y = Math.round(((total - viewport.height) * i) / SAMPLES);
        const visible = await page.evaluate(async (top) => {
          window.scrollTo(0, top);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return [...document.querySelectorAll<HTMLElement>("[data-copy]")].filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const pinVis = Number(el.closest<HTMLElement>("[data-pin]")?.style.getPropertyValue("--vis") ?? "1");
            return style.visibility !== "hidden" && pinVis > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
          }).length;
        }, y);
        expect(visible, `visible copy blocks at scrollY ${y}`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("keys reach the last beat", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(stage(page)).toHaveAttribute("data-beat", "hero/0");
    for (const beat of BEATS.slice(1)) await stepTo(page, beat);
    await expect(stage(page)).toHaveAttribute("data-beat", "next/0");
    const items = page.getByRole("navigation", { name: "Story steps" }).getByRole("button");
    await expect(items).toHaveCount(BEATS.length);
    await expect(items.last()).toHaveAttribute("aria-current", "step");
    await page.keyboard.press("ArrowDown");
    await expect(stage(page)).toHaveAttribute("data-beat", "next/0");
  });

  test("space on a focused summary toggles it", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAct(page, "boot");
    const summary = page.locator("#boot summary");
    const details = page.locator("#boot details");
    await summary.focus();
    await expect(details).not.toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(details).toHaveAttribute("open", "");
    await expect(stage(page)).toHaveAttribute("data-beat", "boot/0");
    await expect(summary).toBeFocused();
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open", "");
    await expect(stage(page)).toHaveAttribute("data-beat", "boot/0");
  });

  test("keeps the beat across a resize", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });
    await openAct(page, "init");
    await stepTo(page, "init/1");
    await stepTo(page, "init/2");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(stage(page)).toHaveAttribute("data-beat", "init/2");
    await page.waitForTimeout(1500);
    await expect(stage(page)).toHaveAttribute("data-beat", "init/2");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);
    await expect(stage(page)).toHaveAttribute("data-beat", "init/2");
  });

  test("restores the beat after reload", async ({ page }, testInfo) => {
    await recordStage(page);
    await openAct(page, "boot");
    await stepTo(page, "boot/1");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: 15_000 });
    await page.reload();
    await expect(stage(page)).toHaveAttribute("data-beat", "boot/1");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: 15_000 });
    const log = await readStageLog(page);
    const first = log[0];
    const arrived = log.find((s) => s.train === "arrived");
    expect(first, "the stage wrapper appeared").toBeDefined();
    expect(arrived, "the train arrived").toBeDefined();
    /* first paint is already at the beat: no ride from the start */
    expect(new Set(log.map((s) => s.beat))).toEqual(new Set(["boot/1"]));
    const ms = (arrived?.at ?? 0) - (first?.at ?? 0);
    testInfo.annotations.push({ type: "reload-arrival-ms", description: String(Math.round(ms)) });
    expect(ms).toBeLessThanOrEqual(500);
  });

  test("deep link starts at the act", async ({ page }) => {
    await recordStage(page);
    await visit(page, "/#init");
    await expect(stage(page)).toHaveAttribute("data-beat", "init/0");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: 15_000 });
    /* no ride from hero: the beat was never anything else once the stage existed */
    expect(new Set((await readStageLog(page)).map((s) => s.beat))).toEqual(new Set(["init/0"]));
  });

  test("reduced motion jumps", async ({ page }, testInfo) => {
    await recordStage(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await visit(page, "/");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: 15_000 });
    const before = (await readStageLog(page)).length;
    await page.keyboard.press("ArrowDown");
    await expect(stage(page)).toHaveAttribute("data-beat", "before/0");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: 100 });
    const [keyAt] = (await readKeyLog(page)).slice(-1);
    const after = (await readStageLog(page)).slice(before);
    const moved = after.find((s) => s.beat === "before/0");
    /* a jump: the train is at its stop the moment the beat changes, with no travelling in between */
    expect(after.map((s) => s.train)).not.toContain("travelling");
    expect(moved?.train).toBe("arrived");
    testInfo.annotations.push({
      type: "reduced-motion-key-to-beat-ms",
      description: String(Math.round((moved?.at ?? 0) - (keyAt ?? 0))),
    });
  });

  test("has no accessibility violations at the top or at init/2", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    test.slow();
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = trackErrors(page);
    await page.goto("/");
    await expect(stage(page)).toHaveAttribute("data-beat", "hero/0");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await openAct(page, "init");
    await stepTo(page, "init/1");
    await stepTo(page, "init/2");
    await expect(page.locator(".board tbody tr").first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
  });
});

const SHOT_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;
const ACTS = ["hero", "before", "boot", "init", "next"] as const;

for (const viewport of SHOT_VIEWPORTS) {
  test(`screenshots of every act at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    test.slow();
    await page.setViewportSize(viewport);
    for (const act of ACTS) {
      await openAct(page, act);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `test-results/screenshots/${act}-${viewport.width}x${viewport.height}.png` });
    }
  });
}
