import { describe, expect, it } from "vitest";
import { indexFileSchema, rawCatalogFileSchema, traceFileSchema, tracerDumpSchema } from "./schema";

const validTrace = {
  scenario: "block-single",
  request: { method: "GET", path: "/" },
  status: 200,
  theme: null,
  hooks: [{ name: "init", type: "action", file: "wp-settings.php", line: 807, count: 2, firstIndex: 0 }],
  listeners: { init: [["create_initial_post_types", 0, 1, "wp-includes/post.php"]] },
  sequence: [0, 0],
};

describe("traceFileSchema", () => {
  it("accepts a consistent trace", () => {
    expect(traceFileSchema.safeParse(validTrace).success).toBe(true);
  });

  it.each([
    ["a sequence index past the hooks list", { sequence: [0, 1] }],
    ["counts that disagree with the sequence", { sequence: [0] }],
    ["listeners for a hook that never fired", { listeners: { wp: [["x", 10, 1, null]] } }],
    ["a scenario id that could escape a folder", { scenario: "../etc" }],
  ])("rejects %s", (_, patch) => {
    expect(traceFileSchema.safeParse({ ...validTrace, ...patch }).success).toBe(false);
  });
});

describe("tracerDumpSchema", () => {
  const dump = {
    scenario: "cron",
    wp: "7.1.5",
    php: "8.3",
    theme: null,
    events: [["init", "action", null, null]],
    listeners: {},
  };

  it("accepts PHP_INT_MAX priorities and rejects unknown hook types", () => {
    expect(tracerDumpSchema.safeParse({ ...dump, listeners: { init: [["f", "PHP_INT_MAX", 1, null]] } }).success).toBe(
      true,
    );
    expect(tracerDumpSchema.safeParse({ ...dump, events: [["init", "unknown", null, null]] }).success).toBe(false);
  });
});

describe("rawCatalogFileSchema", () => {
  it("keeps the fields we use and drops the rest", () => {
    const parsed = rawCatalogFileSchema.parse({
      $schema: "x",
      hooks: [
        {
          name: "init",
          file: "wp-settings.php",
          type: "action",
          doc: { description: "d", long_description: "", long_description_html: "", tags: [] },
          args: 0,
          aliases: [],
        },
      ],
    });
    expect(parsed.hooks[0]).not.toHaveProperty("aliases");
    expect(parsed.hooks[0]?.doc).not.toHaveProperty("long_description_html");
  });
});

describe("indexFileSchema", () => {
  it("requires latest to be one of the kept versions", () => {
    expect(indexFileSchema.safeParse({ latest: "7.1", versions: ["7.1", "7.0"] }).success).toBe(true);
    expect(indexFileSchema.safeParse({ latest: "7.2", versions: ["7.1"] }).success).toBe(false);
  });
});
