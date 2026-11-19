import { describe, expect, it } from "vitest";
import { createHookMatcher, normalizeCatalog, type RawCatalogHook } from "./catalog";

const raw = (name: string, type: "action" | "filter", tags: RawCatalogHook["doc"]["tags"] = []): RawCatalogHook => ({
  name,
  file: "wp-includes/example.php",
  type,
  doc: { description: `About ${name}.`, long_description: "", tags },
  args: 1,
});

const catalog = normalizeCatalog([
  raw("init", "action", [{ name: "since", content: "1.5.0" }]),
  raw("the_title", "filter", [
    { name: "since", content: "0.71" },
    { name: "param", content: "The post title.", types: ["string"], variable: "$post_title" },
  ]),
  raw("pre_option_{$option}", "filter", [{ name: "since", content: "1.5.0" }]),
  raw("auth_{$object_type}_meta_{$meta_key}", "filter"),
  raw("save_{$thing}", "action"),
  raw("save_post_{$post_type}", "action"),
  raw("pre_option_special", "filter"),
  raw("old_hook", "action", [{ name: "deprecated", content: "6.0.0 Use new_hook instead." }]),
]);

describe("normalizeCatalog", () => {
  it("keeps the facts the site needs from each docblock", () => {
    const title = catalog.find((h) => h.name === "the_title");
    expect(title).toMatchObject({
      type: "filter",
      since: "0.71",
      description: "About the_title.",
      params: [{ name: "$post_title", types: ["string"], description: "The post title." }],
      dynamic: false,
      deprecated: false,
    });
  });

  it("flags dynamic and deprecated hooks", () => {
    expect(catalog.find((h) => h.name === "pre_option_{$option}")?.dynamic).toBe(true);
    expect(catalog.find((h) => h.name === "old_hook")?.deprecated).toBe(true);
  });
});

describe("createHookMatcher", () => {
  const match = createHookMatcher(catalog);

  it("matches exact names", () => {
    expect(match("init")?.name).toBe("init");
  });

  it("matches dynamic hooks by their placeholders", () => {
    expect(match("pre_option_blogname")?.name).toBe("pre_option_{$option}");
    expect(match("auth_post_meta_color")?.name).toBe("auth_{$object_type}_meta_{$meta_key}");
  });

  it("lets a placeholder be empty, as core does for blocks without a name", () => {
    expect(match("pre_option_")?.name).toBe("pre_option_{$option}");
  });

  it("prefers an exact name over a dynamic pattern", () => {
    expect(match("pre_option_special")?.name).toBe("pre_option_special");
  });

  it("prefers the most specific dynamic pattern", () => {
    expect(match("save_post_book")?.name).toBe("save_post_{$post_type}");
  });

  it("returns undefined for hooks core does not define", () => {
    expect(match("acme_custom_hook")).toBeUndefined();
  });

  it("with a call site, only accepts a dynamic match fired from the pattern's own file", () => {
    const strict = createHookMatcher(
      normalizeCatalog([{ ...raw("{$option}", "filter"), file: "wp-includes/option.php" }, raw("init", "action")]),
    );
    expect(strict("blogname", "wp-includes/option.php")?.name).toBe("{$option}");
    expect(strict("acme_anything", "wp-content/plugins/acme/acme.php")).toBeUndefined();
    expect(strict("init", "wp-content/plugins/acme/acme.php")?.name).toBe("init");
  });
});
