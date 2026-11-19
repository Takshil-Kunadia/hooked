import { describe, expect, it } from "vitest";
import { toDataJson } from "./json";

describe("toDataJson", () => {
  it("puts each structured array item and record entry on its own line, scalars inline", () => {
    const text = toDataJson({
      scenario: "block-single",
      hooks: [{ name: "init" }, { name: "wp" }],
      listeners: { init: [["a", 10, 1, null]] },
      sequence: [0, 1, 0],
      empty: [],
      skipped: undefined,
    });
    expect(text).toBe(
      [
        "{",
        '  "scenario": "block-single",',
        '  "hooks": [',
        '    {"name":"init"},',
        '    {"name":"wp"}',
        "  ],",
        '  "listeners": {',
        '    "init": [["a",10,1,null]]',
        "  },",
        '  "sequence": [0,1,0],',
        '  "empty": []',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("round-trips through JSON.parse", () => {
    const value = { a: [{ b: 1 }], c: { d: [2] }, e: {} };
    expect(JSON.parse(toDataJson(value))).toEqual(value);
  });
});
