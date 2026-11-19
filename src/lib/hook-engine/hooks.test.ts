import { describe, expect, it } from "vitest";
import { closure, fn } from "./callable.ts";
import { Hooks, type HookEvent } from "./hooks.ts";
import { concat, PhpError, type PhpValue } from "./php.ts";

const append = (name: string, suffix: string) => fn(name, (value) => concat(value ?? null, suffix));

/** The events, with callables reduced to their names so expectations stay readable. */
function recorder() {
  const events: unknown[] = [];
  const onEvent = (event: HookEvent): void => {
    events.push("callable" in event ? { ...event, callable: undefined, name: event.name } : event);
  };
  return { events, onEvent };
}

describe("Hooks events", () => {
  it("reports a filter's run callback by callback, with the value after each one", () => {
    const { events, onEvent } = recorder();
    const hooks = new Hooks({ onEvent });
    hooks.addFilter("the_title", append("shout", "!"), 10);
    hooks.addFilter("the_title", append("ask", "?"), 20);
    expect(hooks.applyFilters("the_title", "Hello", 42)).toBe("Hello!?");
    expect(events).toEqual([
      { type: "fire", hook: "the_title", kind: "filter", args: ["Hello", 42], depth: 1, registered: true },
      {
        type: "call",
        hook: "the_title",
        priority: 10,
        id: "shout",
        name: "shout",
        args: ["Hello"],
        depth: 1,
        callable: undefined,
      },
      {
        type: "return",
        hook: "the_title",
        priority: 10,
        id: "shout",
        name: "shout",
        result: "Hello!",
        depth: 1,
        callable: undefined,
      },
      {
        type: "call",
        hook: "the_title",
        priority: 20,
        id: "ask",
        name: "ask",
        args: ["Hello!"],
        depth: 1,
        callable: undefined,
      },
      {
        type: "return",
        hook: "the_title",
        priority: 20,
        id: "ask",
        name: "ask",
        result: "Hello!?",
        depth: 1,
        callable: undefined,
      },
      { type: "done", hook: "the_title", kind: "filter", value: "Hello!?", depth: 1 },
    ]);
  });

  it("reports hooks that fire with nothing attached", () => {
    const { events, onEvent } = recorder();
    const hooks = new Hooks({ onEvent });
    hooks.doAction("init");
    expect(events).toEqual([
      { type: "fire", hook: "init", kind: "action", args: [], depth: 1, registered: false },
      { type: "done", hook: "init", kind: "action", value: null, depth: 1 },
    ]);
  });

  it("reports how deep a nested hook runs", () => {
    const { events, onEvent } = recorder();
    const hooks = new Hooks({ onEvent });
    hooks.addAction(
      "init",
      fn("register", () => (hooks.doAction("registered_post_type", "post"), null)),
    );
    hooks.doAction("init");
    const fires = events.filter((e): e is HookEvent => (e as HookEvent).type === "fire");
    expect(fires.map((e) => [e.hook, e.depth])).toEqual([
      ["init", 1],
      ["registered_post_type", 2],
    ]);
  });

  it("reports the all hook's callbacks under the hook that fired", () => {
    const { events, onEvent } = recorder();
    const hooks = new Hooks({ onEvent });
    hooks.addAction(
      "all",
      fn("spy", () => null),
    );
    hooks.doAction("init");
    expect(events[1]).toEqual({
      type: "call",
      hook: "all",
      priority: 10,
      id: "spy",
      name: "spy",
      args: ["init"],
      depth: 1,
      callable: undefined,
    });
  });
});

describe("Hooks", () => {
  it("returns true from addFilter and removeAllFilters, like WordPress", () => {
    const hooks = new Hooks();
    expect(hooks.addFilter("h", append("a", "a"))).toBe(true);
    expect(hooks.addAction("h", append("b", "b"))).toBe(true);
    expect(hooks.removeAllFilters("h")).toBe(true);
    expect(hooks.removeAllActions("nothing-here")).toBe(true);
  });

  it("offers the action names as aliases of the filter functions", () => {
    const hooks = new Hooks();
    const greet = fn("greet", () => null);
    hooks.addAction("wp_head", greet, 5);
    expect(hooks.hasAction("wp_head", greet)).toBe(5);
    hooks.doAction("wp_head");
    expect(hooks.didAction("wp_head")).toBe(1);
    expect(hooks.currentAction()).toBe(false);
    expect(hooks.doingAction("wp_head")).toBe(false);
    expect(hooks.removeAction("wp_head", greet, 5)).toBe(true);
    expect(hooks.hasAction("wp_head")).toBe(false);
  });

  it.each([10.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects a priority of %s (WordPress documents an int)",
    (priority) => {
      const hooks = new Hooks();
      expect(() => hooks.addFilter("h", append("a", "a"), priority)).toThrow(RangeError);
      expect(() => hooks.removeFilter("h", "a", priority)).toThrow(RangeError);
    },
  );

  it("treats a negative zero priority as 0", () => {
    const hooks = new Hooks();
    hooks.addFilter("h", append("a", "a"), -0);
    expect(Object.is(hooks.hook("h")?.callbacks()[0]?.priority, 0)).toBe(true);
  });

  it("truncates accepted args the way PHP's (int) cast does", () => {
    const hooks = new Hooks();
    hooks.addFilter("h", append("a", "a"), 10, 2.9);
    expect(hooks.hook("h")?.callbacks()[0]?.entries[0]?.acceptedArgs).toBe(2);
  });

  it.each(["", "0"])("answers has_filter() with false for the falsy callback id %j, like WordPress", (name) => {
    const hooks = new Hooks();
    hooks.addFilter(
      "h",
      fn(name, () => null),
    );
    expect(hooks.hasFilter("h", name)).toBe(false);
    expect(hooks.hasFilter("h", name, 10)).toBe(false);
    expect(hooks.hasFilter("h")).toBe(true);
  });

  it.each([Number.NaN, Number.NEGATIVE_INFINITY])("rejects accepted args of %s", (acceptedArgs) => {
    expect(() => new Hooks().addFilter("h", append("a", "a"), 10, acceptedArgs)).toThrow(RangeError);
  });

  it("builds callback ids the way the chosen WordPress version does", () => {
    const callback = closure(() => null);
    const older = new Hooks({ version: "7.0" });
    const newer = new Hooks({ version: "7.1" });
    older.addFilter("h", callback);
    newer.addFilter("h", callback);
    expect(older.hook("h")?.callbacks()[0]?.entries[0]?.id).toBe("00000000000000010000000000000000");
    expect(newer.hook("h")?.callbacks()[0]?.entries[0]?.id).toBe("spl_object_id:1");
  });

  it("hands out snapshots that later changes do not touch", () => {
    const hooks = new Hooks();
    hooks.addFilter("h", append("a", "a"));
    const before = hooks.hook("h")?.callbacks();
    hooks.addFilter("h", append("b", "b"));
    hooks.addFilter("h", append("c", "c"), 5);
    expect(before?.map((group) => group.entries.map((entry) => entry.id))).toEqual([["a"]]);
    expect(Object.isFrozen(before)).toBe(true);
  });

  it("lets a PHP fatal error from a callback end the run", () => {
    const hooks = new Hooks();
    hooks.addFilter(
      "the_title",
      fn("strtoupper", (s: PhpValue) => String(s).toUpperCase(), { params: 1, internal: true }),
      10,
      2,
    );
    expect(() => hooks.applyFilters("the_title", "Hello", 42)).toThrow(
      new PhpError("ArgumentCountError", "strtoupper() expects exactly 1 argument, 2 given"),
    );
  });
});
