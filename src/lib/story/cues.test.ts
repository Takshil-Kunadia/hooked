import { describe, expect, it } from "vitest";
import { flattenBeats, type BeatSpec, type ChapterSpec } from "./chapter";
import {
  cueIndices,
  initPhases,
  initSettled,
  initStage,
  sinceArrival,
  stageAnnounced,
  stageSettled,
  stageTicketPhase,
  type CueIndices,
  type InitMoment,
} from "./cues";
import { ANNOUNCE_DELAY_S, TICKET_GAP_S } from "./motion";

const beat = (id: string, cue?: BeatSpec["cue"]): BeatSpec => ({
  id,
  rail: id,
  station: "init",
  shot: "platform",
  focus: ["init"],
  hooks: [],
  ...(cue ? { cue } : {}),
});

/** hero/0, init/arrive (1), init/announce (2), init/tickets (3), init/loaded (4), next/0 (5). */
const CHAPTER: ChapterSpec = {
  id: "test",
  acts: [
    { id: "hero", kicker: "", title: "", beats: [beat("hero")] },
    {
      id: "init",
      kicker: "",
      title: "",
      beats: [beat("arrive"), beat("announce", "announce"), beat("tickets", "cascade"), beat("loaded")],
    },
    { id: "next", kicker: "", title: "", beats: [beat("next")] },
  ],
};
const CUES: CueIndices = { announce: 2, cascade: 3 };
const COUNT = 3;

const moment = (globalIndex: number, sinceArrivalS: number | null, fromLater = false): InitMoment => ({
  cues: CUES,
  globalIndex,
  sinceArrivalS,
  fromLater,
});

describe("cueIndices", () => {
  it("finds the announcement and cascade beats by global index", () => {
    expect(cueIndices(flattenBeats(CHAPTER))).toEqual(CUES);
  });

  it("is null for a cue the chapter doesn't have", () => {
    const plain: ChapterSpec = { id: "plain", acts: [{ id: "a", kicker: "", title: "", beats: [beat("x")] }] };
    expect(cueIndices(flattenBeats(plain))).toEqual({ announce: null, cascade: null });
  });
});

describe("sinceArrival", () => {
  it("is null while the train is travelling", () => {
    expect(sinceArrival(null, 5, 9)).toBeNull();
  });

  it("counts from the later of the arrival and entering the beat", () => {
    expect(sinceArrival(4, 6, 9)).toBe(3);
    expect(sinceArrival(7, 6, 9)).toBe(2);
  });
});

describe("initPhases", () => {
  it("before the announcement beat: not announced, every ticket waiting", () => {
    expect(initPhases(moment(0, 50), COUNT)).toEqual({ announced: false, tickets: ["waiting", "waiting", "waiting"] });
    expect(initPhases(moment(1, 50, true), COUNT)).toEqual({
      announced: false,
      tickets: ["waiting", "waiting", "waiting"],
    });
  });

  it("at the announcement beat: announced after the delay, every ticket still waiting", () => {
    expect(initPhases(moment(2, 0.59), COUNT)).toEqual({
      announced: false,
      tickets: ["waiting", "waiting", "waiting"],
    });
    expect(initPhases(moment(2, 0.6), COUNT)).toEqual({ announced: true, tickets: ["waiting", "waiting", "waiting"] });
    expect(initPhases(moment(2, 30), COUNT).tickets).toEqual(["waiting", "waiting", "waiting"]);
  });

  it("at the announcement beat from a later beat: already announced", () => {
    expect(initPhases(moment(2, 0, true), COUNT).announced).toBe(true);
  });

  it("at the cascade beat: announced, and each ticket takes its turn 0.5s after the previous one", () => {
    expect(ANNOUNCE_DELAY_S).toBe(0.6);
    expect(TICKET_GAP_S).toBe(0.5);
    expect(initPhases(moment(3, 0), COUNT)).toEqual({ announced: true, tickets: ["waiting", "waiting", "waiting"] });
    expect(initPhases(moment(3, 0.6), COUNT).tickets).toEqual(["running", "waiting", "waiting"]);
    expect(initPhases(moment(3, 1.1), COUNT).tickets).toEqual(["done", "running", "waiting"]);
    expect(initPhases(moment(3, 1.6), COUNT).tickets).toEqual(["done", "done", "running"]);
    expect(initPhases(moment(3, 2.1), COUNT).tickets).toEqual(["done", "done", "done"]);
  });

  it("at the cascade beat from a later beat: every ticket already done", () => {
    expect(initPhases(moment(3, 0, true), COUNT)).toEqual({ announced: true, tickets: ["done", "done", "done"] });
  });

  it("after the cascade beat: announced, every ticket done", () => {
    expect(initPhases(moment(4, 0), COUNT)).toEqual({ announced: true, tickets: ["done", "done", "done"] });
    expect(initPhases(moment(5, 99, true), COUNT)).toEqual({ announced: true, tickets: ["done", "done", "done"] });
  });

  it("while the train is travelling, nothing time-driven has happened yet", () => {
    expect(initPhases(moment(2, null), COUNT)).toEqual({
      announced: false,
      tickets: ["waiting", "waiting", "waiting"],
    });
    expect(initPhases(moment(3, null), COUNT)).toEqual({ announced: true, tickets: ["waiting", "waiting", "waiting"] });
    expect(initPhases(moment(4, null), COUNT).tickets).toEqual(["done", "done", "done"]);
  });

  it("returns no tickets for a bad count", () => {
    expect(initPhases(moment(3, 9), 0).tickets).toEqual([]);
    expect(initPhases(moment(3, 9), -2).tickets).toEqual([]);
    expect(initPhases(moment(3, 9), Number.NaN).tickets).toEqual([]);
  });
});

describe("initStage", () => {
  it("places the beat relative to the cues", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => initStage(CUES, i))).toEqual([
      "before",
      "before",
      "announce",
      "cascade",
      "after",
      "after",
    ]);
  });

  it("is announced but waiting between the two cues", () => {
    const apart: CueIndices = { announce: 1, cascade: 4 };
    expect(initStage(apart, 2)).toBe("between");
    expect(stageAnnounced("between", null, false)).toBe(true);
    expect(stageTicketPhase("between", 0, 99, false)).toBe("waiting");
  });

  it("copes with a chapter that has only one cue, or none", () => {
    expect(initStage({ announce: null, cascade: null }, 3)).toBe("before");
    expect(initStage({ announce: 2, cascade: null }, 5)).toBe("between");
    expect(initStage({ announce: null, cascade: 2 }, 1)).toBe("before");
    expect(initStage({ announce: null, cascade: 2 }, 2)).toBe("cascade");
  });
});

describe("initSettled", () => {
  it("is settled while travelling: the arrival, not the clock, moves things on", () => {
    expect(initSettled(moment(2, null), COUNT)).toBe(true);
    expect(initSettled(moment(3, null), COUNT)).toBe(true);
  });

  it("waits for the announcement at the announcement beat", () => {
    expect(initSettled(moment(2, 0.59), COUNT)).toBe(false);
    expect(initSettled(moment(2, 0.6), COUNT)).toBe(true);
    expect(initSettled(moment(2, 0, true), COUNT)).toBe(true);
  });

  it("waits for the last ticket at the cascade beat", () => {
    expect(initSettled(moment(3, 2.09), COUNT)).toBe(false);
    expect(initSettled(moment(3, 2.1), COUNT)).toBe(true);
    expect(initSettled(moment(3, 0, true), COUNT)).toBe(true);
    expect(initSettled(moment(3, 0), 0)).toBe(true);
  });

  it("is settled away from the cues", () => {
    expect(initSettled(moment(0, 0), COUNT)).toBe(true);
    expect(initSettled(moment(4, 0), COUNT)).toBe(true);
  });

  it("matches the stage-level check the render loop uses", () => {
    expect(stageSettled("cascade", 2.09, false, COUNT)).toBe(false);
    expect(stageSettled("between", 0, false, COUNT)).toBe(true);
  });
});
