import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeListeners, type RawListener } from "@/lib/wp-data/trace";
import { traceFileSchema } from "@/lib/wp-data/schema";
import { bootActionsFired, docsUrl, firedOrder, hookSource, initTickets, sourceUrl } from "./facts";

const raw: RawListener[] = [
  ["core_a", 0, 1, "wp-includes/a.php"],
  ["core_b", 1, 1, "wp-includes/b.php"],
  ["core_c", 5, 1, "wp-includes/c.php"],
  ["core_d", 10, 1, "wp-includes/d.php"],
  ["core_e", 10, 1, "wp-includes/e.php"],
  ["core_f", 10, 1, "wp-admin/f.php"],
  ["core_g", 10, 1, "wp-includes/g.php"],
  ["core_h", 20, 1, "wp-includes/h.php"],
  ["hooked_demo_init", 10, 1, "wp-content/plugins/hooked-demo/hooked-demo.php"],
  ["theme_setup", 10, 1, "wp-content/themes/twentytwentyfive/functions.php"],
  ["tooling_probe", 10, 1, "tools/probe.php"],
  ["builtin", 10, 1, null],
];

describe("initTickets", () => {
  const result = initTickets(normalizeListeners(raw));

  it("shows 8 tickets in run order with the plugin and theme included and tooling dropped", () => {
    expect(result.shown.map((t) => t.callback)).toEqual([
      "core_a",
      "core_b",
      "core_c",
      "core_d",
      "core_e",
      "core_f",
      "hooked_demo_init",
      "theme_setup",
    ]);
  });

  it("counts the core listeners left out", () => {
    expect(result.hidden).toBe(2);
    expect(result.all).toHaveLength(10);
  });

  it("flags demo callbacks and records origin and file", () => {
    const demo = result.shown.find((t) => t.callback === "hooked_demo_init");
    expect(demo).toMatchObject({ demo: true, origin: "plugin", priority: 10 });
    expect(result.shown[0]).toMatchObject({ demo: false, origin: "core", file: "wp-includes/a.php" });
  });

  it("keeps every non-core ticket even when they exceed max", () => {
    const r = initTickets(normalizeListeners(raw), 3);
    expect(r.shown.map((t) => t.callback)).toEqual(["core_a", "hooked_demo_init", "theme_setup"]);
    expect(r.hidden).toBe(7);
  });
});

describe("urls", () => {
  it("builds source and docs links", () => {
    expect(sourceUrl("7.1.5", "wp-settings.php", 779)).toBe(
      "https://github.com/WordPress/WordPress/blob/7.1.5/wp-settings.php#L779",
    );
    expect(sourceUrl("7.1.5", "wp-settings.php")).toBe(
      "https://github.com/WordPress/WordPress/blob/7.1.5/wp-settings.php",
    );
    expect(docsUrl("hooks", "WP_Loaded")).toBe("https://developer.wordpress.org/reference/hooks/wp_loaded/");
    expect(docsUrl("functions", "add_action")).toBe("https://developer.wordpress.org/reference/functions/add_action/");
  });
});

describe("trace facts", () => {
  const trace = traceFileSchema.parse(
    JSON.parse(readFileSync("content/versions/7.1/traces/block-single.json", "utf8")),
  );

  it("orders names by first firing and drops names that never fired", () => {
    expect(firedOrder(trace, ["init", "muplugins_loaded", "no_such_hook"])).toEqual(["muplugins_loaded", "init"]);
  });

  it("finds where init is fired", () => {
    expect(hookSource(trace, "init")).toMatchObject({ type: "action", file: "wp-settings.php" });
    expect(hookSource(trace, "no_such_hook")).toBeUndefined();
  });

  it("picks init's tickets from the real trace", () => {
    const r = initTickets(normalizeListeners(trace.listeners["init"] ?? []));
    expect(r.all).toHaveLength(129);
    expect(r.hidden).toBe(121);
    expect(r.shown).toHaveLength(8);
    expect(r.shown.filter((t) => t.origin !== "core").map((t) => t.origin)).toEqual([
      "plugin",
      "theme",
      "theme",
      "theme",
    ]);
  });

  it("counts the actions fired up to after_setup_theme from the real trace", () => {
    const count = bootActionsFired(trace);
    const first = trace.hooks.find((h) => h.name === "after_setup_theme")!.firstIndex;
    const expected = trace.hooks.filter((h) => h.type === "action" && h.firstIndex <= first).length;
    expect(count).toBe(expected);
    expect(count).toBe(36);
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it("throws when the boundary hook never fired", () => {
    expect(() => bootActionsFired({ ...trace, hooks: [] })).toThrow(/after_setup_theme/);
  });
});
