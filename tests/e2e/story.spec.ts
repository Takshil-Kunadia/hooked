import AxeBuilder from "@axe-core/playwright";
import { expect, test, type TestInfo } from "@playwright/test";
import {
  BEATS,
  expectBeat,
  onlyDesktop,
  openAct,
  railButtons,
  readKeyLog,
  readStageLog,
  recordStage,
  settleAnimations,
  stage,
  stageStepTo,
  stepTo,
  trackErrors,
  visit,
  withoutStage,
} from "./helpers";

const SAMPLES = 50;
/* The 3D chunk, a WebGL context and the scene, under SwiftShader: the stage can take seconds to report. */
const STAGE_READY_MS = 20_000;
/*
 * Navigation start -> the real train's first report at its stop (the 3D chunk, a WebGL context, the
 * scene). Measured under SwiftShader, 2 workers: reload 3.5-4.5 s desktop, 1.1-1.2 s phone; deep link
 * 0.7-2.9 s. On a GPU (M1, production build) a reload takes about 0.54 s. Twice the worst, rounded.
 */
const TRAIN_ARRIVAL_MS = 8000;
const onCI = Boolean(process.env.CI);
/* a CI runner renders the scene on 2 slow cores: the first arrival took 32 s there, so allow far more */
const SCENE_TEST_MS = onCI ? 150_000 : 60_000;
const SCENE_READY_MS = onCI ? 100_000 : STAGE_READY_MS;

/**
 * Records how long the train took to first arrive. Locally that is bounded (it catches a slow
 * load); on CI it is only recorded, since it measures SwiftShader on a shared runner, not the app.
 */
function noteArrival(testInfo: TestInfo, type: string, ms: number): void {
  testInfo.annotations.push({ type, description: String(Math.round(ms)) });
  if (!onCI) expect(ms, `${type} (ms)`).toBeLessThanOrEqual(TRAIN_ARRIVAL_MS);
}
/** How long the reduced-motion test lets the train take a new stop before reading its states. */
const TRAIN_TAKES_STOP_MS = 1000;

test.describe("the story", () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`one copy block at a time at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      onlyDesktop(testInfo);
      await page.setViewportSize(viewport);
      /* a layout property of the copy, so run without the stage: SwiftShader frames would starve the sampler */
      await withoutStage(page);
      await page.goto("/?snap=off");
      await expect(page.locator("#boot [data-pin]")).toHaveAttribute("style", /--vis/);
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let i = 0; i <= SAMPLES; i += 1) {
        const y = Math.round(((total - viewport.height) * i) / SAMPLES);
        const visible = await page.evaluate(async (top) => {
          window.scrollTo(0, top);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          /* off-screen copy is clipped out of sight (sr-only), not hidden, so judge by the clip and --vis */
          return [...document.querySelectorAll<HTMLElement>("[data-copy]")].filter((el) => {
            const rect = el.getBoundingClientRect();
            const clipped = getComputedStyle(el).clipPath !== "none";
            const pinVis = Number(el.closest<HTMLElement>("[data-pin]")?.style.getPropertyValue("--vis") ?? "1");
            return !clipped && pinVis > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
          }).length;
        }, y);
        expect(visible, `visible copy blocks at scrollY ${y}`).toBeLessThanOrEqual(1);
      }
    });
  }

  test("keys reach the last beat", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await withoutStage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, "/");
    await expectBeat(page, "hero/0");
    for (const beat of BEATS.slice(1)) await stepTo(page, beat);
    const items = railButtons(page);
    await expect(items).toHaveCount(BEATS.length);
    await expect(items.last()).toHaveAttribute("aria-current", "step");
    await page.keyboard.press("ArrowDown");
    await expectBeat(page, "next/0");
  });

  test("space on a focused summary toggles it", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await withoutStage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAct(page, "boot");
    const summary = page.locator("#boot summary");
    const details = page.locator("#boot details");
    await summary.focus();
    await expect(details).not.toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(details).toHaveAttribute("open", "");
    await expectBeat(page, "boot/0");
    await expect(summary).toBeFocused();
    await page.keyboard.press("Space");
    await expect(details).not.toHaveAttribute("open", "");
    await expectBeat(page, "boot/0");
  });

  test("arrow keys step after a click on a rail button", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await withoutStage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAct(page, "boot");
    const tick = railButtons(page).nth(BEATS.indexOf("boot/1"));
    await tick.click();
    await expectBeat(page, "boot/1");
    /* Chrome focuses a clicked button; the arrows must still step, not scroll a little and snap back */
    await expect(tick).toBeFocused();
    await stepTo(page, "boot/2");
    await page.keyboard.press("ArrowUp");
    await expectBeat(page, "boot/1");
  });

  test("keeps the beat across a resize", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await withoutStage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openAct(page, "init");
    await stepTo(page, "init/1");
    await stepTo(page, "init/2");
    await page.setViewportSize({ width: 844, height: 390 });
    await expectBeat(page, "init/2");
    await page.waitForTimeout(1500);
    await expectBeat(page, "init/2");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);
    await expectBeat(page, "init/2");
  });

  test("restores the beat after reload", async ({ page }, testInfo) => {
    test.setTimeout(SCENE_TEST_MS);
    await recordStage(page);
    await openAct(page, "boot");
    await stageStepTo(page, "boot/1");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: SCENE_READY_MS });
    await page.reload();
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: SCENE_READY_MS });
    await expect(page.locator("canvas")).toBeVisible();
    const log = await readStageLog(page);
    /* the stage reports only once the 3D train is on the map: this is the real train's first state */
    expect(log[0], "the train's first state").toMatchObject({ beat: "boot/1", train: "arrived" });
    expect(
      log.map((s) => s.train),
      "no ride from the start of the line",
    ).not.toContain("travelling");
    expect(new Set(log.map((s) => s.beat)), "no earlier beat").toEqual(new Set(["boot/1"]));
    /* the log's clock starts at navigation start, so this is reload -> the train at its stop */
    const ms = log[0]?.at ?? Number.POSITIVE_INFINITY;
    noteArrival(testInfo, "reload-arrival-ms", ms);
  });

  test("deep link starts at the act", async ({ page }, testInfo) => {
    test.setTimeout(SCENE_TEST_MS);
    await recordStage(page);
    await visit(page, "/#init");
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: SCENE_READY_MS });
    await expect(page.locator("canvas")).toBeVisible();
    const log = await readStageLog(page);
    /* no ride from hero: the real train's first state is already at the act */
    expect(log[0], "the train's first state").toMatchObject({ beat: "init/0", train: "arrived" });
    expect(
      log.map((s) => s.train),
      "no ride from the start of the line",
    ).not.toContain("travelling");
    expect(new Set(log.map((s) => s.beat)), "no earlier beat").toEqual(new Set(["init/0"]));
    const ms = log[0]?.at ?? Number.POSITIVE_INFINITY;
    noteArrival(testInfo, "deep-link-arrival-ms", ms);
  });

  test("reduced motion jumps", async ({ page }, testInfo) => {
    test.setTimeout(SCENE_TEST_MS);
    await recordStage(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await visit(page, "/");
    /* data-train exists only once the 3D train is on the map, so the key below reaches the real train */
    await expect(stage(page)).toHaveAttribute("data-train", "arrived", { timeout: SCENE_READY_MS });
    await expect(page.locator("canvas")).toBeVisible();
    const before = (await readStageLog(page)).length;
    await page.keyboard.press("ArrowDown");
    await expect(stage(page)).toHaveAttribute("data-beat", "before/0", { timeout: SCENE_READY_MS });
    /* give the train time to take the new stop: a tween would show travelling for at least 0.9 s */
    await page.waitForTimeout(TRAIN_TAKES_STOP_MS);
    const [keyAt] = (await readKeyLog(page)).slice(-1);
    const after = (await readStageLog(page)).slice(before);
    const moved = after.find((s) => s.beat === "before/0");
    /* a jump: the train is at its stop the moment the beat changes, with no travelling in between */
    expect(after.map((s) => s.train)).not.toContain("travelling");
    expect(moved?.train).toBe("arrived");
    await expect(stage(page)).toHaveAttribute("data-beat", "before/0");
    testInfo.annotations.push({
      type: "reduced-motion-key-to-beat-ms",
      description: String(Math.round((moved?.at ?? 0) - (keyAt ?? 0))),
    });
  });

  test("has no accessibility violations at the top or at init/2", async ({ page }, testInfo) => {
    onlyDesktop(testInfo);
    await withoutStage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = trackErrors(page, { strict: true });
    await visit(page, "/");
    await expectBeat(page, "hero/0");
    await settleAnimations(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await openAct(page, "init");
    await stepTo(page, "init/1");
    await stepTo(page, "init/2");
    await expect(page.locator(".board tbody tr").first()).toBeVisible();
    await settleAnimations(page);
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
    await withoutStage(page);
    await page.setViewportSize(viewport);
    for (const act of ACTS) {
      await openAct(page, act);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `test-results/screenshots/${act}-${viewport.width}x${viewport.height}.png` });
    }
  });
}
