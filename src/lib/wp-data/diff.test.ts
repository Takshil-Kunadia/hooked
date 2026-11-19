import { describe, expect, it } from "vitest";
import type { CatalogHook } from "./catalog";
import { diffCatalogs, diffTraces, movedItems } from "./diff";
import type { TraceFile } from "./schema";

const hook = (name: string, extra: Partial<CatalogHook> = {}): CatalogHook => ({
  name,
  type: "action",
  file: "wp-includes/x.php",
  since: "1.0.0",
  description: "",
  params: [],
  args: 1,
  dynamic: false,
  deprecated: false,
  ...extra,
});

describe("diffCatalogs", () => {
  it("lists added, removed, newly deprecated and re-signatured hooks", () => {
    const changes = diffCatalogs(
      [hook("init"), hook("gone"), hook("old"), hook("the_title", { args: 1 })],
      [hook("init"), hook("old", { deprecated: true }), hook("the_title", { args: 2 }), hook("fresh")],
    );
    expect(changes).toEqual({
      added: ["fresh"],
      removed: ["gone"],
      deprecated: ["old"],
      argsChanged: [{ name: "the_title", from: 1, to: 2 }],
    });
  });

  it("does not repeat a hook that was already deprecated", () => {
    const old = hook("old", { deprecated: true });
    expect(diffCatalogs([old], [old]).deprecated).toEqual([]);
  });
});

describe("diffCatalogs with a hook fired from two places", () => {
  it("treats it as one hook, deprecated if either place is, with the most args", () => {
    const prev = [hook("dup", { file: "a.php", args: 1 }), hook("dup", { file: "b.php", args: 2 })];
    const next = [hook("dup", { file: "a.php", args: 1, deprecated: true }), hook("dup", { file: "b.php", args: 2 })];
    expect(diffCatalogs(prev, next)).toMatchObject({ deprecated: ["dup"], argsChanged: [] });
  });
});

describe("movedItems", () => {
  it("finds the fewest items that changed place", () => {
    expect(movedItems(["a", "b", "c", "d"], ["a", "c", "d", "b"])).toEqual(["b"]);
  });

  it("ignores items that are only in one list", () => {
    expect(movedItems(["a", "x", "b"], ["a", "b", "y"])).toEqual([]);
  });

  it("handles empty lists and full reversals", () => {
    expect(movedItems([], [])).toEqual([]);
    expect(movedItems(["a", "b", "c"], ["c", "b", "a"])).toHaveLength(2);
  });
});

const trace = (hooks: string[], listeners: TraceFile["listeners"] = {}): TraceFile => ({
  scenario: "block-single",
  request: { method: "GET", path: "/" },
  status: 200,
  theme: null,
  hooks: hooks.map((name, i) => ({ name, type: "action", file: null, line: null, count: 1, firstIndex: i })),
  listeners,
  sequence: hooks.map((_, i) => i),
});

describe("diffTraces closure keys", () => {
  it("does not renumber closures when a new one appears in another file", () => {
    const closure = (file: string): [string, number, number, string] => ["{closure}", 10, 1, file];
    const changes = diffTraces(
      trace(["init"], { init: [closure("wp-includes/b.php")] }),
      trace(["init"], { init: [closure("wp-includes/a.php"), closure("wp-includes/b.php")] }),
    );
    expect(changes.listeners).toEqual([
      { hook: "init", callback: "{closure}@wp-includes/a.php", change: "added", from: null, to: 10 },
    ]);
  });
});

describe("diffTraces", () => {
  it("reports hooks that started or stopped firing, and moves", () => {
    const changes = diffTraces(trace(["a", "b", "c", "gone"]), trace(["a", "c", "b", "new"]));
    expect(changes).toMatchObject({ firedAdded: ["new"], firedRemoved: ["gone"], moved: ["b"] });
  });

  it("reports core listener changes and ignores plugins and themes", () => {
    const changes = diffTraces(
      trace(["init"], {
        init: [
          ["create_initial_post_types", 0, 1, "wp-includes/post.php"],
          ["{closure}", 10, 1, "wp-includes/a.php"],
          ["{closure}", 10, 1, "wp-includes/b.php"],
          ["old_core_fn", 5, 1, "wp-includes/post.php"],
          ["acme_init", 10, 1, "wp-content/plugins/acme/acme.php"],
        ],
      }),
      trace(["init"], {
        init: [
          ["create_initial_post_types", 1, 1, "wp-includes/post.php"],
          ["{closure}", 10, 1, "wp-includes/a.php"],
          ["trim", 10, 1, null],
          ["acme_other", 10, 1, "wp-content/plugins/acme/acme.php"],
        ],
      }),
    );
    expect(changes.listeners).toEqual([
      { hook: "init", callback: "create_initial_post_types", change: "priority", from: 0, to: 1 },
      { hook: "init", callback: "trim", change: "added", from: null, to: 10 },
      { hook: "init", callback: "{closure}@wp-includes/b.php", change: "removed", from: 10, to: null },
      { hook: "init", callback: "old_core_fn", change: "removed", from: 5, to: null },
    ]);
  });
});
