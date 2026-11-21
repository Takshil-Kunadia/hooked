import path from "node:path";
import { describe, expect, it } from "vitest";
import { readCatalog, readIndex, readMeta, readTrace } from "@/lib/wp-data/files";
import { catalogMatcher, hookDocsUrl } from "./catalog-match";
import { DEFAULT_LAYOUT, rowSizes, snakeLayout } from "./layout";
import { buildLifecycle } from "./model";
import { stageAt, stageStarts } from "./stages";

const ROOT = path.join(process.cwd(), "content", "versions");

describe("stages", () => {
  const hooks = [
    { name: "muplugins_loaded", firstIndex: 3 },
    { name: "init", firstIndex: 10 },
    { name: "wp_loaded", firstIndex: 20 },
    { name: "shutdown", firstIndex: 40 },
  ];

  it("starts each stage at its marker, or just after it, and drops stages that never began", () => {
    const starts = stageStarts(hooks).map((s) => [s.stage.id, s.start]);
    expect(starts).toEqual([
      ["boot", 0],
      ["init", 10],
      ["main", 21],
      ["shutdown", 40],
    ]);
  });

  it("puts a call in the last stage that started at or before it", () => {
    const starts = stageStarts(hooks);
    expect(stageAt(starts, 0).id).toBe("boot");
    expect(stageAt(starts, 10).id).toBe("init");
    expect(stageAt(starts, 20).id).toBe("init");
    expect(stageAt(starts, 21).id).toBe("main");
    expect(stageAt(starts, 99).id).toBe("shutdown");
    expect(() => stageAt([], 0)).toThrow(RangeError);
  });
});

describe("catalog matching", () => {
  const entry = (name: string, file: string, dynamic: boolean, type: "action" | "filter" = "filter") => ({
    name,
    type,
    file,
    description: `about ${name}`,
    dynamic,
    deprecated: false,
  });
  const lookup = catalogMatcher([
    entry("init", "wp-settings.php", false, "action"),
    entry("option_{$option}", "wp-includes/option.php", true),
    entry("{$hook}", "wp-includes/x.php", true),
    entry("pre_option_{$option}", "wp-includes/option.php", true),
    entry("pre_{$field}", "wp-includes/post.php", true),
    entry("render_block_{$this->name}", "wp-includes/class-wp-block.php", true),
  ]);

  it("finds exact names first", () => {
    expect(lookup("init", "action", "wp-settings.php")?.docsUrl).toBe(
      "https://developer.wordpress.org/reference/hooks/init/",
    );
  });

  it("matches dynamic hooks to their pattern, preferring the same file, then the most specific", () => {
    expect(lookup("option_siteurl", "filter", "wp-includes/option.php")?.pattern).toBe("option_{$option}");
    expect(lookup("pre_option_home", "filter", "wp-includes/option.php")?.pattern).toBe("pre_option_{$option}");
    expect(lookup("pre_option_home", "filter", "wp-includes/post.php")?.pattern).toBe("pre_{$field}");
    expect(lookup("pre_option_home", "filter", null)?.pattern).toBe("pre_option_{$option}");
  });

  it("ignores patterns of the wrong type and patterns with almost no fixed text", () => {
    expect(lookup("option_siteurl", "action", "wp-includes/option.php")).toBeNull();
    expect(lookup("anything", "filter", "wp-includes/x.php")).toBeNull();
  });

  it("derives developer.wordpress.org links, and none for names it can't predict", () => {
    expect(hookDocsUrl("option_{$option}")).toBe("https://developer.wordpress.org/reference/hooks/option_option/");
    expect(hookDocsUrl("render_block_{$this->name}")).toBeNull();
    expect(lookup("render_block_core/group", "filter", "wp-includes/class-wp-block.php")?.docsUrl).toBeNull();
  });
});

describe("snake layout", () => {
  it("splits a stage into the fewest, most even rows", () => {
    expect(rowSizes(0, 60)).toEqual([]);
    expect(rowSizes(60, 60)).toEqual([60]);
    expect(rowSizes(169, 60)).toEqual([57, 56, 56]);
  });

  it("starts every stage on a new row and alternates the rows' direction", () => {
    const layout = snakeLayout([3, 70, 1], { ...DEFAULT_LAYOUT, maxPerRow: 60 });
    expect(layout.rows.map((r) => [r.group, r.count, r.dir])).toEqual([
      [0, 3, 1],
      [1, 35, -1],
      [1, 35, 1],
      [2, 1, -1],
    ]);
    expect(layout.positions).toHaveLength(74);
    const zs = layout.rows.map((r) => r.z);
    expect(zs[1]! - zs[0]!).toBeCloseTo(DEFAULT_LAYOUT.rowGap + DEFAULT_LAYOUT.stageGap);
    expect(zs[2]! - zs[1]!).toBeCloseTo(DEFAULT_LAYOUT.rowGap);
  });

  it("spreads each row across the full width and runs the line past its ends", () => {
    const w = DEFAULT_LAYOUT.rowWidth;
    const { positions, path, bounds } = snakeLayout([3, 2]);
    expect(positions.map(([x]) => x)).toEqual([0, w / 2, w, w, 0]);
    expect(path[0]).toEqual([-DEFAULT_LAYOUT.pad, 0]);
    expect(path.at(-1)?.[0]).toBeCloseTo(-DEFAULT_LAYOUT.pad);
    expect(bounds.minX).toBe(-DEFAULT_LAYOUT.pad);
    expect(bounds.maxX).toBe(w + DEFAULT_LAYOUT.pad);
  });

  it("puts a lone stop where its row is entered and ends the line just after it", () => {
    const w = DEFAULT_LAYOUT.rowWidth;
    const { positions, path } = snakeLayout([2, 1]);
    expect(positions.at(-1)).toEqual([w, positions.at(-1)![1]]);
    expect(path.at(-1)?.[0]).toBeCloseTo(w - DEFAULT_LAYOUT.pad);
  });
});

describe("the lifecycle of a real request", async () => {
  const { latest } = await readIndex(ROOT);
  const [meta, catalog, trace] = await Promise.all([
    readMeta(ROOT, latest),
    readCatalog(ROOT, latest),
    readTrace(ROOT, latest, "block-single"),
  ]);
  const map = buildLifecycle({ trace, lookup: catalogMatcher(catalog.hooks), wp: meta.wp });

  it("has one stop per hook, in the order the hooks first fired", () => {
    expect(map.stops).toHaveLength(trace.hooks.length);
    const first = map.stops.map((s) => s.firstCall);
    expect(first).toEqual([...first].sort((a, b) => a - b));
    expect(map.totalCalls).toBe(trace.sequence.length);
  });

  it("splits the request into its stages, which add up to every hook and every call", () => {
    expect(map.stages.map((s) => s.id)).toEqual(["boot", "init", "main", "template", "render", "shutdown"]);
    expect(map.stages.reduce((n, s) => n + s.count, 0)).toBe(map.stops.length);
    expect(map.stages.reduce((n, s) => n + s.calls, 0)).toBe(map.totalCalls);
    const init = map.stops.find((s) => s.name === "init");
    expect(init?.stage).toBe("init");
    expect(map.stops.find((s) => s.name === "shutdown")?.stage).toBe("shutdown");
  });

  it("gives every stop its own place on the map", () => {
    const places = new Set(map.stops.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`));
    expect(places.size).toBe(map.stops.length);
  });

  it("shares one docs entry between the stops of a dynamic hook", () => {
    const options = map.stops.filter((s) => s.name.startsWith("option_") && s.doc !== null);
    expect(new Set(options.map((s) => s.doc)).size).toBe(1);
    expect(map.docs[options[0]!.doc!]?.pattern).toBe("option_{$option}");
  });

  it("documents most hooks and knows where they fire", () => {
    const documented = map.stops.filter((s) => s.doc !== null).length;
    expect(documented / map.stops.length).toBeGreaterThan(0.9);
    const init = map.stops.find((s) => s.name === "init");
    expect(init?.file).toBe("wp-settings.php");
    expect(init?.listeners.length).toBeGreaterThan(0);
    expect(map.wp).toBe(meta.wp);
  });
});

describe("every recorded request", async () => {
  const { latest } = await readIndex(ROOT);
  const [meta, catalog] = await Promise.all([readMeta(ROOT, latest), readCatalog(ROOT, latest)]);
  const lookup = catalogMatcher(catalog.hooks);
  const maps = await Promise.all(
    meta.scenarios.map(async (id) => buildLifecycle({ trace: await readTrace(ROOT, latest, id), lookup, wp: meta.wp })),
  );
  const stagesOf = (id: string): string[] => maps.find((m) => m.scenario === id)?.stages.map((s) => s.id) ?? [];

  it("lays out every hook of every request, in stages that account for every call", () => {
    for (const map of maps) {
      expect(
        map.stages.reduce((n, s) => n + s.count, 0),
        map.scenario,
      ).toBe(map.stops.length);
      expect(
        map.stages.reduce((n, s) => n + s.calls, 0),
        map.scenario,
      ).toBe(map.totalCalls);
      expect(map.stages[0]?.id, map.scenario).toBe("boot");
      expect(map.stages.at(-1)?.id, map.scenario).toBe("shutdown");
    }
  });

  it("follows each request through the door it came in by", () => {
    expect(stagesOf("classic-404")).toEqual(["boot", "init", "main", "template", "render", "shutdown"]);
    expect(stagesOf("rest-posts")).toEqual(["boot", "init", "main", "rest", "shutdown"]);
    expect(stagesOf("admin-dashboard")).toEqual(["boot", "init", "admin", "screen", "shutdown"]);
    expect(stagesOf("ajax-nopriv")).toEqual(["boot", "init", "ajax", "action", "shutdown"]);
    expect(stagesOf("cron")).toEqual(["boot", "init", "cron", "shutdown"]);
    expect(maps.find((m) => m.scenario === "cron")?.kind).toBe("cron");
  });

  it("marks the demo plugins' own hooks as not part of WordPress", () => {
    const ajax = maps.find((m) => m.scenario === "ajax-nopriv");
    expect(ajax?.stops.find((s) => s.name === "wp_ajax_nopriv_hooked_demo")?.demo).toBe(false);
    const cron = maps.find((m) => m.scenario === "cron");
    expect(cron?.stops.find((s) => s.name === "hooked_demo_cron")?.demo).toBe(true);
    expect(cron?.stops.find((s) => s.name === "init")?.demo).toBe(false);
  });
});
