/**
 * Integrity tests for the generated WordPress data in content/versions.
 *
 * The schemas check that each file is well formed. These tests check the data is complete and
 * that the lifecycle facts the story teaches still hold for every kept version. When a new
 * WordPress release breaks one of these, the story text that depends on it needs an edit.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createHookMatcher } from "@/lib/wp-data/catalog";
import { readCatalog, readChanges, readIndex, readMeta, readTrace } from "@/lib/wp-data/files";
import { isDemoName, SCENARIOS } from "@/lib/wp-data/scenarios";
import { classifyOrigin } from "@/lib/wp-data/trace";
import type { TraceFile } from "@/lib/wp-data/schema";

const ROOT = path.resolve(import.meta.dirname, "../../content/versions");
const index = await readIndex(ROOT);

const versions = await Promise.all(
  index.versions.map(async (version) => {
    const meta = await readMeta(ROOT, version);
    const traces = new Map<string, TraceFile>();
    for (const id of meta.scenarios) traces.set(id, await readTrace(ROOT, version, id));
    return { version, meta, catalog: await readCatalog(ROOT, version), traces };
  }),
);

/** Position of the first call to each hook; -1 when it never fired. */
const firstAt = (trace: TraceFile, hook: string): number => trace.hooks.find((h) => h.name === hook)?.firstIndex ?? -1;
const fired = (trace: TraceFile, hook: string): boolean => firstAt(trace, hook) >= 0;

function expectOrder(trace: TraceFile, hooks: ReadonlyArray<string>): void {
  const positions = hooks.map((hook) => [hook, firstAt(trace, hook)] as const);
  for (const [hook, at] of positions) expect(at, `${trace.scenario}: ${hook} should fire`).toBeGreaterThanOrEqual(0);
  const actual = [...positions].sort((a, b) => a[1] - b[1]).map(([hook]) => hook);
  expect(actual, `${trace.scenario}: first-fired order`).toEqual(hooks);
}

const listenerNames = (trace: TraceFile, hook: string): string[] => (trace.listeners[hook] ?? []).map(([cb]) => cb);

/** WordPress has had well over this many documented hooks for years; fewer means a broken import. */
const MIN_CATALOG_HOOKS = 2000;

const PAGE_SCENARIOS = SCENARIOS.filter((s) => s.site === "block" || s.site === "classic")
  .filter((s) => !s.path.startsWith("/wp-"))
  .map((s) => s.id);

/** The front-end journey, stop by stop. */
const FRONT_END_ORDER = [
  "enable_loading_advanced_cache_dropin",
  "muplugins_loaded",
  "plugins_loaded",
  "setup_theme",
  "after_setup_theme",
  "init",
  "wp_loaded",
  "parse_request",
  "pre_get_posts",
  "send_headers",
  "wp",
  "template_redirect",
  "template_include",
  "wp_head",
  "wp_footer",
  "shutdown",
];

describe("content/versions/index.json", () => {
  it("names the newest kept version as latest", () => {
    expect(index.latest).toBe(index.versions[0]);
  });
});

describe.each(versions)("WordPress $version", ({ version, meta, catalog, traces }) => {
  const trace = (id: string): TraceFile => {
    const found = traces.get(id);
    if (!found) throw new Error(`No ${id} trace for ${version}`);
    return found;
  };

  it("was generated from that version, with every scenario traced", () => {
    expect(meta.version).toBe(version);
    expect(meta.wp === version || meta.wp.startsWith(`${version}.`)).toBe(true);
    expect([...meta.scenarios].sort()).toEqual(SCENARIOS.map((s) => s.id).sort());
  });

  it("has a full hook catalog", () => {
    expect(catalog.hooks.length).toBeGreaterThan(MIN_CATALOG_HOOKS);
  });

  it("compares itself with the previous kept version", async () => {
    const previous = index.versions[index.versions.indexOf(version) + 1];
    if (previous === undefined) return;
    const changes = await readChanges(ROOT, version);
    expect([changes.from, changes.to]).toEqual([previous, version]);
  });

  it("every hook core fires is in the catalog", () => {
    const match = createHookMatcher(catalog.hooks);
    const firedByCore = (file: string | null): boolean => file === null || classifyOrigin(file).origin === "core";
    const undocumented = new Set(
      [...traces.values()]
        .flatMap((t) => t.hooks)
        .filter((h) => firedByCore(h.file) && !isDemoName(h.name) && !match(h.name, h.file))
        .map((h) => `${h.name} (${h.file}:${h.line})`),
    );
    expect([...undocumented].sort()).toEqual([]);
  });

  it("answers each request with the status its scenario expects", () => {
    for (const scenario of SCENARIOS) expect(trace(scenario.id).status, scenario.id).toBe(scenario.expectedStatus);
  });

  it.each(PAGE_SCENARIOS)("front end (%s): the journey runs in the order the story tells", (id) => {
    expectOrder(trace(id), FRONT_END_ORDER);
  });

  it("block themes render the post before wp_head; classic themes print the head first", () => {
    expectOrder(trace("block-single"), ["template_include", "the_content", "wp_head"]);
    expectOrder(trace("classic-single"), ["template_include", "wp_head", "the_content"]);
  });

  it("loads the child theme before its parent", () => {
    const setup = listenerNames(trace("classic-single"), "after_setup_theme");
    expect(setup.indexOf("hooked_child_setup")).toBeGreaterThanOrEqual(0);
    expect(setup.indexOf("hooked_child_setup")).toBeLessThan(setup.indexOf("twenty_twenty_one_setup"));
  });

  it("loads must-use plugins and plugins in their stages", () => {
    const single = trace("block-single");
    expect(listenerNames(single, "muplugins_loaded")).toContain("hooked_demo_mu_ready");
    expect(listenerNames(single, "init")).toContain("hooked_demo_init");
  });

  it("REST requests leave before the template loader", () => {
    const rest = trace("rest-posts");
    expectOrder(rest, ["init", "parse_request", "rest_api_init"]);
    expect(fired(rest, "template_redirect")).toBe(false);
  });

  it("admin-ajax.php runs admin_init, then the visitor's AJAX action", () => {
    const ajax = trace("ajax-nopriv");
    expectOrder(ajax, ["init", "admin_init", "wp_ajax_nopriv_hooked_demo"]);
    expect(fired(ajax, "template_redirect")).toBe(false);
  });

  it("wp-cron.php runs the due job", () => {
    const cron = trace("cron");
    expectOrder(cron, ["init", "wp_loaded", "hooked_demo_cron"]);
    expect(fired(cron, "template_redirect")).toBe(false);
  });

  it("the admin builds its menu before admin_init", () => {
    const admin = trace("admin-dashboard");
    expectOrder(admin, ["init", "admin_menu", "admin_init", "current_screen", "load-index.php", "admin_head"]);
    expect(fired(admin, "template_redirect")).toBe(false);
  });
});
