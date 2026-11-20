import { describe, expect, it } from "vitest";
import {
  activeBeatOf,
  copyVisibility,
  focusTarget,
  globalIndexOf,
  hashTarget,
  keyTarget,
  measureActs,
  settleTarget,
  type ActShape,
} from "./pins";
import { beatScrollY, type MeasuredAct, type StoryPosition } from "./scroll";

const VH = 1000;
/** hero (page hero, 1 beat), boot (2 beats), init (4 beats); 40% breathers after the hero and boot. */
const HERO: MeasuredAct = { id: "hero", top: 0, height: 1000, beats: 1 };
const BOOT: MeasuredAct = { id: "boot", top: 1400, height: 2400, beats: 2 };
const INIT: MeasuredAct = { id: "init", top: 4200, height: 3800, beats: 4 };
const ACTS = [HERO, BOOT, INIT];
const SHAPE: ReadonlyArray<ActShape> = ACTS.map(({ id, beats }) => ({ id, beats }));

describe("measureActs", () => {
  it("measures each act's element, keeping its beat count", () => {
    const boxes: Record<string, { top: number; height: number }> = {
      hero: { top: 0, height: 1000 },
      boot: { top: 1400, height: 2400 },
      init: { top: 4200, height: 3800 },
    };
    expect(measureActs(SHAPE, (id) => boxes[id] ?? null)).toEqual(ACTS);
  });

  it("treats a missing element as an empty act where the previous one ended", () => {
    const boxes: Record<string, { top: number; height: number }> = { boot: { top: 1400, height: 2400 } };
    expect(measureActs(SHAPE, (id) => boxes[id] ?? null)).toEqual([
      { id: "hero", top: 0, height: 0, beats: 1 },
      BOOT,
      { id: "init", top: 3800, height: 0, beats: 4 },
    ]);
  });
});

describe("copyVisibility", () => {
  /* boot pins from 1400 to 2800 (height − viewport); the fade is 10% of the viewport */
  it("is hidden before the act pins, while it unpins and in the breather after it", () => {
    expect(copyVisibility(BOOT, 1399, VH)).toBe(0);
    expect(copyVisibility(BOOT, 2801, VH)).toBe(0);
    expect(copyVisibility(BOOT, 3900, VH)).toBe(0);
  });

  it("fades in over the first tenth of a viewport and out over the last", () => {
    expect(copyVisibility(BOOT, 1400, VH)).toBe(0);
    expect(copyVisibility(BOOT, 1450, VH)).toBeCloseTo(0.5);
    expect(copyVisibility(BOOT, 1500, VH)).toBe(1);
    expect(copyVisibility(BOOT, 2750, VH)).toBeCloseTo(0.5);
    expect(copyVisibility(BOOT, 2800, VH)).toBe(0);
  });

  it("is fully visible at every beat's resting point", () => {
    for (const beat of [0, 1]) expect(copyVisibility(BOOT, beatScrollY(BOOT, beat, VH), VH)).toBe(1);
  });

  it("reads a non-finite scroll position as hidden", () => {
    expect(copyVisibility(BOOT, Number.NaN, VH)).toBe(0);
  });
});

describe("activeBeatOf", () => {
  const at = { actIndex: 1, beat: 1, inBreather: false };
  it("is the current beat in the current act", () => {
    expect(activeBeatOf(1, 2, at)).toBe(1);
  });

  it("is the last beat in acts already passed and the first in acts ahead", () => {
    expect(activeBeatOf(0, 1, at)).toBe(0);
    expect(activeBeatOf(2, 4, at)).toBe(0);
    expect(activeBeatOf(1, 2, { actIndex: 2, beat: 3, inBreather: false })).toBe(1);
  });
});

describe("globalIndexOf", () => {
  it("counts the beats of every earlier act", () => {
    expect(globalIndexOf(SHAPE, 0, 0)).toBe(0);
    expect(globalIndexOf(SHAPE, 1, 1)).toBe(2);
    expect(globalIndexOf(SHAPE, 2, 3)).toBe(6);
  });
});

describe("settleTarget", () => {
  const bootBeat0 = beatScrollY(BOOT, 0, VH); // 1750

  it("settles on the centre of the beat the scroll position is in", () => {
    expect(settleTarget(ACTS, 1500, VH)).toBe(bootBeat0);
    expect(settleTarget(ACTS, 2000, VH)).toBe(bootBeat0);
  });

  it("does nothing when already there", () => {
    expect(settleTarget(ACTS, bootBeat0 + 2, VH)).toBeNull();
  });

  it("does nothing when the beat's centre is more than 60% of a viewport away", () => {
    /* unpinning the end of boot, far below its last beat's centre (2450) */
    expect(settleTarget(ACTS, 3100, VH)).toBeNull();
  });
});

describe("keyTarget", () => {
  it("steps to the next or previous beat's centre", () => {
    expect(keyTarget(ACTS, beatScrollY(BOOT, 0, VH), VH, 1)).toBe(beatScrollY(BOOT, 1, VH));
    expect(keyTarget(ACTS, beatScrollY(BOOT, 1, VH), VH, -1)).toBe(beatScrollY(BOOT, 0, VH));
    expect(keyTarget(ACTS, 0, VH, 1)).toBe(beatScrollY(BOOT, 0, VH));
  });

  it("returns null when the step wouldn't move: the first beat going up, the last going down", () => {
    expect(keyTarget(ACTS, 0, VH, -1)).toBeNull();
    expect(keyTarget(ACTS, beatScrollY(INIT, 3, VH), VH, 1)).toBeNull();
  });

  it("returns null when the step would go the wrong way, so the page can scroll on past the story", () => {
    /* below the last beat's centre, "down" would jump back up to it */
    expect(keyTarget(ACTS, 7500, VH, 1)).toBeNull();
  });
});

describe("hashTarget", () => {
  it("goes to the named act's first beat", () => {
    expect(hashTarget(ACTS, "#init", 0, VH)).toBe(beatScrollY(INIT, 0, VH));
  });

  it("moves on from the act's top, where the browser's own jump lands and the copy is still faded", () => {
    expect(hashTarget(ACTS, "#init", INIT.top, VH)).toBe(beatScrollY(INIT, 0, VH));
  });

  it("stays put at the first beat, or further into that act", () => {
    expect(hashTarget(ACTS, "#init", beatScrollY(INIT, 0, VH), VH)).toBeNull();
    expect(hashTarget(ACTS, "#init", beatScrollY(INIT, 2, VH), VH)).toBeNull();
  });

  it("ignores an empty or unknown hash", () => {
    expect(hashTarget(ACTS, "", 0, VH)).toBeNull();
    expect(hashTarget(ACTS, "#", 0, VH)).toBeNull();
    expect(hashTarget(ACTS, "#nope", 0, VH)).toBeNull();
  });
});

describe("focusTarget", () => {
  const at = (actIndex: number, beat: number, inBreather = false): StoryPosition => ({ actIndex, beat, inBreather });

  it("takes the page to the beat holding focus in another act, whatever moved the focus", () => {
    for (const keyboard of [true, false]) {
      expect(focusTarget(SHAPE, at(0, 0), { actIndex: 2, beat: 2 }, keyboard)).toEqual({ actIndex: 2, beat: 2 });
      expect(focusTarget(SHAPE, at(2, 3), { actIndex: 1, beat: 0 }, keyboard)).toEqual({ actIndex: 1, beat: 0 });
    }
  });

  it("treats a breather as off every act, its own included", () => {
    expect(focusTarget(SHAPE, at(2, 0, true), { actIndex: 2, beat: 1 }, false)).toEqual({ actIndex: 2, beat: 1 });
  });

  it("goes to an act's last beat for focus after its beats (Under the hood), which reading order puts last", () => {
    expect(focusTarget(SHAPE, at(0, 0), { actIndex: 2, beat: null }, true)).toEqual({ actIndex: 2, beat: 3 });
  });

  it("follows keyboard focus to another beat of the act on screen", () => {
    expect(focusTarget(SHAPE, at(2, 0), { actIndex: 2, beat: 3 }, true)).toEqual({ actIndex: 2, beat: 3 });
  });

  it("leaves pointer focus in the act on screen alone: clicking a word in a muted beat opens its card", () => {
    expect(focusTarget(SHAPE, at(2, 0), { actIndex: 2, beat: 3 }, false)).toBeNull();
  });

  it("stays when focus is in the beat on screen, or after the beats of the act on screen", () => {
    expect(focusTarget(SHAPE, at(2, 1), { actIndex: 2, beat: 1 }, true)).toBeNull();
    expect(focusTarget(SHAPE, at(2, 1), { actIndex: 2, beat: null }, true)).toBeNull();
  });

  it("clamps a beat past the act's end, and ignores an act it doesn't know", () => {
    expect(focusTarget(SHAPE, at(0, 0), { actIndex: 1, beat: 9 }, true)).toEqual({ actIndex: 1, beat: 1 });
    expect(focusTarget(SHAPE, at(0, 0), { actIndex: 7, beat: 0 }, true)).toBeNull();
  });
});
