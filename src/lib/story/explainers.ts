/** Hover-card explainers: the short "what is this?" notes behind real WordPress names in the copy. */
import { z } from "zod";
import { docsUrl } from "./facts";

export const explainerSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["hook", "function", "file", "concept"]),
  summary: z.string().min(20),
  example: z.string().optional(),
  /** Made up for this demo, not in core: never linked to the reference. */
  demo: z.boolean().optional(),
  /** False when the developer.wordpress.org reference has no page for it (a theme's own functions). Default true. */
  docs: z.boolean().optional(),
});
export type Explainer = z.infer<typeof explainerSchema>;

const explainersFileSchema = z.object({ explainers: z.array(explainerSchema) });

/** Validates the explainers file and indexes it by name. Throws on a schema error or a duplicate name. */
export function loadExplainers(json: unknown): ReadonlyMap<string, Explainer> {
  const parsed = explainersFileSchema.safeParse(json);
  if (!parsed.success) throw new Error(`explainers.json is not valid: ${parsed.error.message}`);
  const map = new Map<string, Explainer>();
  for (const explainer of parsed.data.explainers) {
    if (map.has(explainer.name)) throw new Error(`explainers.json has a duplicate name: "${explainer.name}"`);
    map.set(explainer.name, explainer);
  }
  return map;
}

const PHP_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The developer.wordpress.org reference page for a hook or function; null when there is no such page. */
export function docsLink(e: Explainer): string | null {
  if (e.docs === false || e.demo === true || !PHP_IDENTIFIER.test(e.name)) return null;
  if (e.kind === "hook") return docsUrl("hooks", e.name);
  if (e.kind === "function") return docsUrl("functions", e.name);
  return null;
}
