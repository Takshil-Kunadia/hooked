import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

/** Every beat of Chapter 1 in order, as the stage's `data-beat` names it. */
export const BEATS = [
  "hero/0",
  "before/0",
  "before/1",
  "before/2",
  "before/3",
  "before/4",
  "boot/0",
  "boot/1",
  "boot/2",
  "boot/3",
  "init/0",
  "init/1",
  "init/2",
  "init/3",
  "next/0",
] as const;

/** The fixed 3D stage wrapper, which carries `data-beat` and `data-train`. */
export const stage = (page: Page): Locator => page.locator("[data-beat]");

/** Collect real page errors; GPU/driver chatter from software rendering is not an app error. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/GL Driver|GPU stall|WebGL/i.test(msg.text())) errors.push(msg.text());
  });
  return errors;
}

/** Story tests that name their own viewports run once, in the desktop project. */
export function onlyDesktop(testInfo: TestInfo): void {
  testInfo.skip(testInfo.project.name !== "desktop", "sets its own viewports; one project is enough");
}

/** Presses ArrowDown once and waits for the beat to change to `expected`. */
export async function stepTo(page: Page, expected: string): Promise<void> {
  await page.keyboard.press("ArrowDown");
  await expect(stage(page)).toHaveAttribute("data-beat", expected, { timeout: 10_000 });
}

/**
 * A full page load of `url`. A hash-only change on the same page is not a load, and the controller
 * applies `#act` only on load, so go through about:blank first.
 */
export async function visit(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}

/** Opens `/#<act>` (snap stays on) and waits until the story reports that act's first beat. */
export async function openAct(page: Page, act: string): Promise<void> {
  await visit(page, `/#${act}`);
  await expect(stage(page)).toHaveAttribute("data-beat", `${act}/0`, { timeout: 15_000 });
}

/** One observed state of the stage wrapper: `at` is performance.now() in the page (ms). */
export interface StageSample {
  readonly at: number;
  readonly beat: string | null;
  readonly train: string | null;
}

/**
 * From every page load on, records each change of the stage wrapper's `data-beat` / `data-train`,
 * plus the time of each ArrowDown keydown, in `window.__stageLog` / `window.__keyLog`. In-page
 * timestamps, so Playwright's round trips don't blur the short windows the story promises.
 */
export async function recordStage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __stageLog: StageSample[]; __keyLog: number[] };
    w.__stageLog = [];
    w.__keyLog = [];
    window.addEventListener("keydown", (e) => e.key === "ArrowDown" && w.__keyLog.push(performance.now()), true);
    const note = (el: Element): void => {
      const beat = el.getAttribute("data-beat");
      const train = el.getAttribute("data-train");
      const last = w.__stageLog[w.__stageLog.length - 1];
      if (last?.beat !== beat || last?.train !== train) w.__stageLog.push({ at: performance.now(), beat, train });
    };
    new MutationObserver(() => {
      const el = document.querySelector("[data-beat]");
      if (el) note(el);
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-beat", "data-train"],
    });
  });
}

export const readStageLog = (page: Page): Promise<StageSample[]> =>
  page.evaluate(() => (window as unknown as { __stageLog: StageSample[] }).__stageLog);

export const readKeyLog = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { __keyLog: number[] }).__keyLog);
