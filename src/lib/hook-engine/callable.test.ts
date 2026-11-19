import { describe, expect, it } from "vitest";
import { closure, createIdBuilder, displayName, fn, idFormatFor, invoke, method, staticMethod } from "./callable.ts";
import { PhpError, PhpObject } from "./php.ts";

const noop = (): null => null;

describe("idFormatFor", () => {
  it.each([
    ["6.9", "spl_object_hash"],
    ["7.0", "spl_object_hash"],
    ["7.1", "spl_object_id"],
    ["7.2", "spl_object_id"],
    ["10.0", "spl_object_id"],
    [undefined, "spl_object_id"],
  ] as const)("WordPress %s builds object ids with %s", (version, format) => {
    expect(idFormatFor(version)).toBe(format);
  });

  it.each(["7", "7.1.5", "latest", ""])("rejects %j, which is not a major.minor version", (version) => {
    expect(() => idFormatFor(version)).toThrow(RangeError);
  });
});

describe("createIdBuilder (_wp_filter_build_unique_id)", () => {
  it("keys plain functions and static methods by name, whichever form they are given in", () => {
    const id = createIdBuilder("spl_object_id");
    expect(id(fn("ucwords", noop))).toBe("ucwords");
    expect(id("ucwords")).toBe("ucwords");
    expect(id(staticMethod("My_Plugin", "boot", noop))).toBe("My_Plugin::boot");
    expect(id("My_Plugin::boot")).toBe("My_Plugin::boot");
  });

  it("WordPress 7.1+ keys closures and object methods by spl_object_id()", () => {
    const id = createIdBuilder("spl_object_id");
    const first = closure(noop);
    const plugin = new PhpObject("My_Plugin");
    expect(id(first)).toBe("spl_object_id:1");
    expect(id(first)).toBe("spl_object_id:1");
    expect(id(closure(noop))).toBe("spl_object_id:2");
    expect(id(method(plugin, "run", noop))).toBe("3run");
    expect(id(method(plugin, "stop", noop))).toBe("3stop");
    expect(id(method(new PhpObject("My_Plugin"), "run", noop))).toBe("4run");
  });

  it("WordPress 7.0 and older key them by spl_object_hash()", () => {
    const id = createIdBuilder("spl_object_hash");
    const plugin = new PhpObject("My_Plugin");
    expect(id(closure(noop))).toBe("00000000000000010000000000000000");
    expect(id(method(plugin, "run", noop))).toBe("00000000000000020000000000000000run");
  });
});

describe("displayName", () => {
  it("names callbacks the way the trace data does", () => {
    expect(displayName(fn("wptexturize", noop))).toBe("wptexturize");
    expect(displayName(closure(noop))).toBe("{closure}");
    expect(displayName(method(new PhpObject("WP_Embed"), "autoembed", noop))).toBe("WP_Embed->autoembed");
    expect(displayName(staticMethod("WP_Block_Supports", "init", noop))).toBe("WP_Block_Supports::init");
  });
});

describe("invoke", () => {
  it("passes the arguments through and returns the callback's value", () => {
    expect(
      invoke(
        fn("join", (a, b) => `${String(a)}+${String(b)}`),
        ["x", "y"],
      ),
    ).toBe("x+y");
  });

  it("turns a callback that returns nothing into null, like a PHP function without return", () => {
    expect(
      invoke(
        fn("forgot_to_return", () => undefined),
        ["x"],
      ),
    ).toBeNull();
  });

  it("lets user functions ignore extra arguments", () => {
    expect(
      invoke(
        fn("first", (a) => a, { params: 1 }),
        ["x", "y", "z"],
      ),
    ).toBe("x");
  });

  it.each([
    [fn("f", noop, { params: 2 }), [1], "Too few arguments to function f(), 1 passed and exactly 2 expected"],
    [
      fn("g", noop, { params: 2, required: 1 }),
      [],
      "Too few arguments to function g(), 0 passed and at least 1 expected",
    ],
    [
      method(new PhpObject("K"), "m", noop, { params: 1 }),
      [],
      "Too few arguments to function K::m(), 0 passed and exactly 1 expected",
    ],
    [closure(noop, { params: 1 }), [], "Too few arguments to function {closure}(), 0 passed and exactly 1 expected"],
  ] as const)("throws ArgumentCountError when a user function gets too few arguments", (callable, args, message) => {
    expect(() => invoke(callable, args)).toThrow(new PhpError("ArgumentCountError", message));
  });

  it.each([
    [
      fn("strtoupper", noop, { params: 1, internal: true }),
      ["a", "b"],
      "strtoupper() expects exactly 1 argument, 2 given",
    ],
    [fn("strtoupper", noop, { params: 1, internal: true }), [], "strtoupper() expects exactly 1 argument, 0 given"],
    [
      fn("ucwords", noop, { params: 2, required: 1, internal: true }),
      [],
      "ucwords() expects at least 1 argument, 0 given",
    ],
    [
      fn("ucwords", noop, { params: 2, required: 1, internal: true }),
      ["a", " ", "x"],
      "ucwords() expects at most 2 arguments, 3 given",
    ],
  ] as const)(
    "throws ArgumentCountError when a PHP built-in gets the wrong number of arguments",
    (callable, args, message) => {
      expect(() => invoke(callable, args)).toThrow(new PhpError("ArgumentCountError", message));
    },
  );

  it("does not run the callback when the call is rejected", () => {
    let ran = false;
    const strict = fn("strict", () => ((ran = true), null), { params: 1 });
    expect(() => invoke(strict, [])).toThrow(PhpError);
    expect(ran).toBe(false);
  });
});
