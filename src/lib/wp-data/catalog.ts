/**
 * The hook catalog: every action and filter WordPress core defines, from the
 * @wp-hooks/wordpress-core package (generated from core's docblocks).
 *
 * Kept free of path aliases and non-erasable TypeScript so the data pipeline can
 * import it with plain Node (type stripping).
 */

interface RawDocTag {
  readonly name: string;
  readonly content?: string;
  readonly types?: ReadonlyArray<string>;
  readonly variable?: string;
}

export interface RawCatalogHook {
  readonly name: string;
  readonly file: string;
  readonly type:
    "action" | "filter" | "action_reference" | "filter_reference" | "action_deprecated" | "filter_deprecated";
  readonly doc: {
    readonly description: string;
    readonly long_description: string;
    readonly tags: ReadonlyArray<RawDocTag>;
  };
  readonly args: number;
}

interface CatalogParam {
  readonly name: string;
  readonly types: ReadonlyArray<string>;
  readonly description: string;
}

export interface CatalogHook {
  readonly name: string;
  readonly type: "action" | "filter";
  readonly file: string;
  readonly since?: string;
  readonly description: string;
  readonly params: ReadonlyArray<CatalogParam>;
  readonly args: number;
  /** Name contains placeholders such as `{$option}`. */
  readonly dynamic: boolean;
  readonly deprecated: boolean;
}

export function normalizeCatalog(raw: ReadonlyArray<RawCatalogHook>): CatalogHook[] {
  return raw.map((hook) => {
    const tags = hook.doc.tags;
    return {
      name: hook.name,
      type: hook.type.startsWith("action") ? "action" : "filter",
      file: hook.file,
      since: tags.find((t) => t.name === "since")?.content,
      description: hook.doc.description,
      params: tags
        .filter((t) => t.name === "param")
        .map((t) => ({ name: t.variable ?? "", types: t.types ?? [], description: t.content ?? "" })),
      args: hook.args,
      dynamic: hook.name.includes("{"),
      deprecated: hook.type.endsWith("_deprecated") || tags.some((t) => t.name === "deprecated"),
    };
  });
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Turns `save_post_{$post_type}` into /^save_post_.*$/. A placeholder can be empty: core fires
 * `render_block_{$this->name}` as plain `render_block_` for blocks without a name.
 */
function patternFor(name: string): RegExp {
  const parts = name.split(/\{[^}]*\}/g).map(escapeRegExp);
  return new RegExp(`^${parts.join(".*")}$`);
}

/** Literal characters in a dynamic name: more literal text means a more specific pattern. */
const specificity = (name: string): number => name.replace(/\{[^}]*\}/g, "").length;

/**
 * Finds the catalog entry for a hook as it fired at runtime: an exact name first, then the most
 * specific dynamic pattern. Some patterns are almost all placeholder (`{$option}`, `{$field}`) and
 * would match any name, so when the call site is known a dynamic match must also come from the
 * file the catalog lists for that pattern.
 */
export type HookMatcher = (firedName: string, callSite?: string | null) => CatalogHook | undefined;

export function createHookMatcher(catalog: ReadonlyArray<CatalogHook>): HookMatcher {
  const exact = new Map(catalog.filter((h) => !h.dynamic).map((h) => [h.name, h]));
  const dynamic = catalog
    .filter((h) => h.dynamic)
    .map((hook) => ({ hook, regex: patternFor(hook.name), weight: specificity(hook.name) }))
    .sort((a, b) => b.weight - a.weight);
  return (firedName, callSite) => {
    const named = exact.get(firedName);
    if (named) return named;
    const candidates = dynamic.filter((d) => d.regex.test(firedName));
    const match = callSite ? candidates.find((d) => d.hook.file === callSite) : candidates[0];
    return match?.hook;
  };
}
