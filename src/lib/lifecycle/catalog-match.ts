/**
 * Matching a hook as it fired (`option_siteurl`) to its documented entry in the hook catalog
 * (`option_{$option}`), so every stop on the map can say what it is and link to the official docs.
 */

interface CatalogHook {
  readonly name: string;
  readonly type: "action" | "filter";
  readonly file: string;
  readonly description: string;
  readonly since?: string | undefined;
  readonly dynamic: boolean;
  readonly deprecated: boolean;
}

export interface CatalogDoc {
  /** The documented name: the same as the fired name, or its pattern for a dynamic hook. */
  readonly pattern: string;
  readonly description: string;
  readonly since: string | null;
  readonly dynamic: boolean;
  /** The developer.wordpress.org page; null when the pattern has no predictable page. */
  readonly docsUrl: string | null;
}

const DOCS_BASE = "https://developer.wordpress.org/reference/hooks/";
const PLACEHOLDER = /\{\$?([^}]*)\}/g;
const SLUG = /^[a-z0-9_]+$/;
/** A pattern with less fixed text than this (`{$hook}`) would match nearly anything. */
const MIN_LITERAL = 3;

/** developer.wordpress.org drops the `{$` and `}` of a dynamic hook's name: `option_{$option}` → option_option. */
export function hookDocsUrl(pattern: string): string | null {
  const slug = pattern.replace(PLACEHOLDER, "$1").toLowerCase();
  return SLUG.test(slug) ? `${DOCS_BASE}${slug}/` : null;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface DynamicEntry {
  readonly hook: CatalogHook;
  readonly regex: RegExp;
  /** How much of the name is fixed text: the more, the more specific the match. */
  readonly literal: number;
}

function dynamicEntry(hook: CatalogHook): DynamicEntry {
  const parts = hook.name.split(PLACEHOLDER).filter((_, i) => i % 2 === 0);
  const regex = new RegExp(`^${parts.map(escapeRegExp).join(".+")}$`);
  return { hook, regex, literal: parts.join("").length };
}

function toDoc(hook: CatalogHook): CatalogDoc {
  return {
    pattern: hook.name,
    description: hook.description,
    since: hook.since ?? null,
    dynamic: hook.dynamic,
    docsUrl: hookDocsUrl(hook.name),
  };
}

export type CatalogLookup = (name: string, type: "action" | "filter", file: string | null) => CatalogDoc | null;

/**
 * Builds a lookup. Exact names win; otherwise the dynamic pattern of the same type that matches,
 * preferring one documented in the file the hook fired from, then the most specific one.
 */
export function catalogMatcher(hooks: ReadonlyArray<CatalogHook>): CatalogLookup {
  const exact = new Map<string, CatalogHook>();
  for (const h of hooks) if (!h.dynamic && !exact.has(h.name)) exact.set(h.name, h);
  const dynamic = hooks
    .filter((h) => h.dynamic)
    .map(dynamicEntry)
    .filter((d) => d.literal >= MIN_LITERAL);

  return (name, type, file) => {
    const hit = exact.get(name);
    if (hit) return toDoc(hit);
    const candidates = dynamic.filter((d) => d.hook.type === type && d.regex.test(name));
    candidates.sort((a, b) => Number(b.hook.file === file) - Number(a.hook.file === file) || b.literal - a.literal);
    const best = candidates[0];
    return best ? toDoc(best.hook) : null;
  };
}
