import { describe, expect, it } from "vitest";
import {
  classifyOrigin,
  compactTrace,
  firstFiredOrder,
  normalizeListeners,
  priorityValue,
  type RawEvent,
} from "./trace";

const events: RawEvent[] = [
  ["muplugins_loaded", "action", "wp-settings.php", 579],
  ["init", "action", "wp-settings.php", 807],
  ["the_title", "filter", "wp-includes/post-template.php", 182],
  ["the_title", "filter", "wp-includes/post-template.php", 182],
];

describe("compactTrace", () => {
  const trace = compactTrace(events);

  it("lists each hook once, in first-fired order, with counts", () => {
    expect(trace.hooks.map((h) => [h.name, h.count, h.firstIndex])).toEqual([
      ["muplugins_loaded", 1, 0],
      ["init", 1, 1],
      ["the_title", 2, 2],
    ]);
  });

  it("keeps the full firing sequence as indexes into the hook list", () => {
    expect(trace.sequence).toEqual([0, 1, 2, 2]);
  });

  it("records where each hook was fired from", () => {
    expect(trace.hooks[1]).toMatchObject({ type: "action", file: "wp-settings.php", line: 807 });
  });
});

describe("firstFiredOrder", () => {
  it("orders the requested hooks by when they first fired and drops unfired ones", () => {
    const trace = compactTrace(events);
    expect(firstFiredOrder(trace, ["the_title", "never_fired", "muplugins_loaded"])).toEqual([
      "muplugins_loaded",
      "the_title",
    ]);
  });
});

describe("classifyOrigin", () => {
  it.each([
    ["wp-includes/post.php", "core", undefined],
    ["wp-admin/includes/menu.php", "core", undefined],
    ["wp-settings.php", "core", undefined],
    ["xmlrpc.php", "core", undefined],
    ["wp-content/plugins/acme-demo/acme-demo.php", "plugin", "acme-demo"],
    ["wp-content/themes/acme-child/functions.php", "theme", "acme-child"],
    ["wp-content/mu-plugins/acme-mu.php", "mu", "acme-mu.php"],
    ["wp-content/advanced-cache.php", "dropin", "advanced-cache.php"],
    ["/internal/shared/mu-plugins/0-playground.php", "tooling", undefined],
    [null, "php", undefined],
  ] as const)("%s → %s", (file, origin, component) => {
    expect(classifyOrigin(file)).toEqual({ origin, component });
  });
});

describe("normalizeListeners", () => {
  it("names each listener, tags its origin and sorts by priority then registration", () => {
    const listeners = normalizeListeners([
      ["acme_register_cpt", 10, 1, "wp-content/plugins/acme-demo/acme-demo.php"],
      ["create_initial_post_types", 0, 1, "wp-includes/post.php"],
      ["trim", 10, 1, null],
    ]);
    expect(listeners.map((l) => [l.callback, l.priority, l.origin, l.component])).toEqual([
      ["create_initial_post_types", 0, "core", undefined],
      ["acme_register_cpt", 10, "plugin", "acme-demo"],
      ["trim", 10, "php", undefined],
    ]);
    expect(listeners[0]).toMatchObject({ acceptedArgs: 1, file: "wp-includes/post.php" });
  });

  it("puts PHP_INT_MIN first and PHP_INT_MAX last, keeping registration order between equals", () => {
    const listeners = normalizeListeners([
      ["late", "PHP_INT_MAX", 1, "wp-includes/a.php"],
      ["later", "PHP_INT_MAX", 1, "wp-includes/a.php"],
      ["normal", 10, 1, "wp-includes/a.php"],
      ["early", "PHP_INT_MIN", 1, "wp-includes/a.php"],
    ]);
    expect(listeners.map((l) => l.callback)).toEqual(["early", "normal", "late", "later"]);
  });
});

describe("priorityValue", () => {
  it("maps the PHP extremes to infinities and passes numbers through", () => {
    expect(priorityValue("PHP_INT_MAX")).toBe(Number.POSITIVE_INFINITY);
    expect(priorityValue("PHP_INT_MIN")).toBe(Number.NEGATIVE_INFINITY);
    expect(priorityValue(-5)).toBe(-5);
  });
});
