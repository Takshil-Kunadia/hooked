import { describe, expect, it } from "vitest";
import { buildTraceFile } from "./build";
import { traceFileSchema, type TracerDump } from "./schema";

const dump: TracerDump = {
  scenario: "block-single",
  wp: "7.1.5",
  php: "8.3.36",
  theme: "twentytwentyfive",
  events: [
    ["muplugins_loaded", "action", "wp-settings.php", 590],
    ["query", "filter", "/internal/shared/sqlite-database-integration/class-wp-sqlite-db.php", 560],
    ["playground_ready", "action", "/internal/shared/mu-plugins/0-playground.php", 12],
    ["init", "action", "wp-settings.php", 807],
    ["query", "filter", "/internal/shared/sqlite-database-integration/class-wp-sqlite-db.php", 560],
  ],
  listeners: {
    muplugins_loaded: [["playground_load_mu_plugins", 0, 1, "/internal/shared/preload/env.php"]],
    init: [
      ["create_initial_post_types", 0, 1, "wp-includes/post.php"],
      ["playground_auto_login", 1, 1, "/internal/shared/mu-plugins/1-auto-login.php"],
      ["hooked_demo_init", 10, 1, "wp-content/plugins/hooked-demo/hooked-demo.php"],
    ],
    query: [],
    playground_ready: [["noop", 10, 1, "/internal/shared/mu-plugins/0-playground.php"]],
  },
};

const request = { scenario: "block-single", method: "GET", path: "/hello-world/", status: 200 } as const;
const isCoreHook = (name: string): boolean => ["muplugins_loaded", "init", "query"].includes(name);

describe("buildTraceFile", () => {
  const trace = buildTraceFile(dump, request, isCoreHook);

  it("produces a file that passes its own schema", () => {
    expect(() => traceFileSchema.parse(trace)).not.toThrow();
  });

  it("keeps core hooks fired by Playground's stand-ins, without a call site", () => {
    expect(trace.hooks.map((h) => h.name)).toEqual(["muplugins_loaded", "query", "init"]);
    expect(trace.hooks[1]).toMatchObject({ name: "query", file: null, line: null, count: 2 });
  });

  it("drops hooks that only Playground fires", () => {
    expect(trace.hooks.some((h) => h.name === "playground_ready")).toBe(false);
  });

  it("drops Playground's listeners and hooks left with none", () => {
    expect(trace.listeners).toEqual({
      init: [
        ["create_initial_post_types", 0, 1, "wp-includes/post.php"],
        ["hooked_demo_init", 10, 1, "wp-content/plugins/hooked-demo/hooked-demo.php"],
      ],
    });
  });

  it("records the request and the full sequence", () => {
    expect(trace).toMatchObject({ request: { method: "GET", path: "/hello-world/" }, status: 200 });
    expect(trace.sequence).toEqual([0, 1, 2, 1]);
  });

  it("refuses a dump written for a different request", () => {
    expect(() => buildTraceFile({ ...dump, scenario: "block-home" }, request, isCoreHook)).toThrow(/block-home/);
  });
});
