import { describe, expect, it } from "vitest";
import { findBeat, flattenBeats, validateChapter, type BeatSpec, type ChapterSpec } from "./chapter";

const beat = (over: Partial<BeatSpec> & Pick<BeatSpec, "id">): BeatSpec => ({
  rail: "Rail",
  station: "index",
  shot: "station",
  focus: ["index"],
  hooks: [],
  ...over,
});

const valid: ChapterSpec = {
  id: "ch1",
  acts: [
    {
      id: "boot",
      kicker: "Act 1",
      title: "Boot",
      beats: [
        beat({ id: "start", station: "browser", pill: "request" }),
        beat({ id: "load", station: "index", board: "init" }),
      ],
    },
    {
      id: "init",
      kicker: "Act 2",
      title: "Init",
      beats: [
        beat({ id: "announce", station: "init", hooks: ["init"], cue: "announce" }),
        beat({ id: "tickets", station: "init", hooks: ["init"], cue: "cascade" }),
      ],
    },
  ],
};

const known = (name: string): boolean => name === "init";

describe("validateChapter", () => {
  it("returns no issues for a valid spec", () => {
    expect(validateChapter(valid, known)).toEqual([]);
  });

  it("reports duplicate acts", () => {
    const spec: ChapterSpec = { ...valid, acts: [valid.acts[0]!, valid.acts[0]!] };
    expect(validateChapter(spec, known)).toContainEqual({ code: "duplicate-act", where: "boot" });
  });

  it("reports duplicate beats within an act", () => {
    const act = valid.acts[1]!;
    const spec: ChapterSpec = {
      ...valid,
      acts: [valid.acts[0]!, { ...act, beats: [act.beats[0]!, act.beats[0]!] }],
    };
    expect(validateChapter(spec, known)).toContainEqual({
      code: "duplicate-beat",
      where: "init/announce",
    });
  });

  it("reports empty acts", () => {
    const spec: ChapterSpec = { ...valid, acts: [{ ...valid.acts[0]!, beats: [] }] };
    expect(validateChapter(spec, known)).toContainEqual({ code: "empty-act", where: "boot" });
  });

  it("reports unknown hooks", () => {
    const spec: ChapterSpec = {
      ...valid,
      acts: [{ ...valid.acts[1]!, beats: [beat({ id: "announce", hooks: ["nope"] })] }],
    };
    expect(validateChapter(spec, known)).toContainEqual({
      code: "unknown-hook",
      where: "init/announce",
    });
  });

  it("reports a train that reverses, across acts too", () => {
    const spec: ChapterSpec = {
      ...valid,
      acts: [valid.acts[0]!, { ...valid.acts[1]!, beats: [beat({ id: "back", station: "browser" })] }],
    };
    expect(validateChapter(spec, known)).toEqual([{ code: "train-reverses", where: "init/back" }]);
  });
});

describe("train-reverses compares with the previous beat only", () => {
  it("flags one reversal, not every later beat", () => {
    const spec: ChapterSpec = {
      id: "c",
      acts: [
        {
          id: "a",
          kicker: "k",
          title: "t",
          beats: [
            beat({ id: "one", station: "init" }),
            beat({ id: "back", station: "index" }),
            beat({ id: "again", station: "config" }),
          ],
        },
      ],
    };
    expect(validateChapter(spec, known)).toEqual([{ code: "train-reverses", where: "a/back" }]);
  });
});

describe("flattenBeats", () => {
  it("numbers beats globally, in order", () => {
    const flat = flattenBeats(valid);
    expect(flat.map((b) => [b.actId, b.actIndex, b.beat, b.globalIndex, b.spec.id])).toEqual([
      ["boot", 0, 0, 0, "start"],
      ["boot", 0, 1, 1, "load"],
      ["init", 1, 0, 2, "announce"],
      ["init", 1, 1, 3, "tickets"],
    ]);
  });
});

describe("findBeat", () => {
  const flat = flattenBeats(valid);

  it("finds a beat by act and position in the act", () => {
    expect(findBeat(flat, "init", 1)?.spec.id).toBe("tickets");
    expect(findBeat(flat, "boot", 0)?.globalIndex).toBe(0);
  });

  it("returns undefined for an unknown act or beat", () => {
    expect(findBeat(flat, "hero", 0)).toBeUndefined();
    expect(findBeat(flat, "init", 2)).toBeUndefined();
  });
});
