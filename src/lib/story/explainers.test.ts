import { describe, expect, it } from "vitest";
import { docsLink, explainerSchema, loadExplainers } from "./explainers";

const base = { name: "init", kind: "hook", summary: "Fires once WordPress has finished loading." } as const;

describe("explainerSchema", () => {
  it("accepts a valid explainer with optional fields", () => {
    expect(explainerSchema.parse({ ...base, example: "add_action('init', 'f');", demo: true }).demo).toBe(true);
  });

  it("rejects a summary that is too short", () => {
    expect(explainerSchema.safeParse({ ...base, summary: "Too short" }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(explainerSchema.safeParse({ ...base, kind: "widget" }).success).toBe(false);
  });
});

describe("loadExplainers", () => {
  it("indexes explainers by name", () => {
    const map = loadExplainers({ explainers: [base, { ...base, name: "wp_loaded" }] });
    expect([...map.keys()]).toEqual(["init", "wp_loaded"]);
    expect(map.get("init")?.kind).toBe("hook");
  });

  it("accepts an empty list", () => {
    expect(loadExplainers({ explainers: [] }).size).toBe(0);
  });

  it("throws on a duplicate name", () => {
    expect(() => loadExplainers({ explainers: [base, base] })).toThrow(/duplicate.*init/i);
  });

  it("throws on a schema error", () => {
    expect(() => loadExplainers({ explainers: [{ ...base, kind: "nope" }] })).toThrow();
    expect(() => loadExplainers({})).toThrow();
  });
});

describe("docsLink", () => {
  it("links hooks and functions to the reference", () => {
    expect(docsLink({ ...base, kind: "hook", name: "WP_Loaded" })).toBe(
      "https://developer.wordpress.org/reference/hooks/wp_loaded/",
    );
    expect(docsLink({ ...base, kind: "function", name: "add_action" })).toBe(
      "https://developer.wordpress.org/reference/functions/add_action/",
    );
  });

  it("has no link for files or concepts", () => {
    expect(docsLink({ ...base, kind: "file", name: "wp-settings.php" })).toBeNull();
    expect(docsLink({ ...base, kind: "concept", name: "callback" })).toBeNull();
  });

  it("has no link when the name is not a plain PHP identifier", () => {
    for (const name of ["WP_Block_Supports::init", "{closure}", "$obj->method", "1abc", ""]) {
      expect(docsLink({ ...base, kind: "function", name })).toBeNull();
    }
  });
});
