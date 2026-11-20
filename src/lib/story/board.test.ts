import { describe, expect, it } from "vitest";
import { initBoardStatus, ticketStatus } from "./board";

describe("initBoardStatus", () => {
  it("says the train is approaching while it travels", () => {
    expect(initBoardStatus({ announced: false, tickets: ["waiting", "waiting"] }, true)).toBe("train approaching");
  });

  it("says the train is at the platform before the announcement", () => {
    expect(initBoardStatus({ announced: false, tickets: ["waiting", "waiting"] }, false)).toBe("train at platform");
  });

  it("says it is announcing until the first listener finishes", () => {
    expect(initBoardStatus({ announced: true, tickets: ["waiting", "waiting"] }, false)).toBe("announcing…");
    expect(initBoardStatus({ announced: true, tickets: ["running", "waiting"] }, false)).toBe("announcing…");
  });

  it("counts the listeners done while they take their turns", () => {
    expect(initBoardStatus({ announced: true, tickets: ["done", "running", "waiting"] }, false)).toBe("boarding 1/3");
  });

  it("says when every listener is done", () => {
    expect(initBoardStatus({ announced: true, tickets: ["done", "done"] }, false)).toBe("all listeners done");
    expect(initBoardStatus({ announced: true, tickets: [] }, false)).toBe("all listeners done");
  });
});

describe("ticketStatus", () => {
  it("labels each phase with text, not colour alone", () => {
    expect(ticketStatus("waiting")).toBe("waiting");
    expect(ticketStatus("running")).toBe("▶ now");
    expect(ticketStatus("done")).toBe("✓ done");
  });
});
