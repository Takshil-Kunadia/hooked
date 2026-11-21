import "server-only";
import path from "node:path";
import { readCatalog, readIndex, readMeta, readTrace } from "@/lib/wp-data/files";
import { SCENARIOS } from "@/lib/wp-data/scenarios";
import { catalogMatcher } from "./catalog-match";
import { buildLifecycle, type LifecycleMap } from "./model";

const CONTENT_ROOT = path.join(process.cwd(), "content", "versions");
/** The request the map opens on: one blog post, on the default block theme. */
export const DEFAULT_REQUEST = "block-single";

export interface RequestChoice {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly summary: string;
}

/** Every request recorded for the latest version, in the pipeline's order. */
export async function getRequestChoices(): Promise<RequestChoice[]> {
  "use cache";
  const { latest } = await readIndex(CONTENT_ROOT);
  const meta = await readMeta(CONTENT_ROOT, latest);
  return SCENARIOS.filter((s) => meta.scenarios.includes(s.id)).map((s) => ({
    id: s.id,
    method: s.method,
    path: s.path,
    summary: s.summary,
  }));
}

/** The lifecycle map of one recorded request (by scenario id) on the latest WordPress version. */
export async function getLifecycleMap(request: string = DEFAULT_REQUEST): Promise<LifecycleMap> {
  "use cache";
  const { latest } = await readIndex(CONTENT_ROOT);
  const [meta, catalog] = await Promise.all([readMeta(CONTENT_ROOT, latest), readCatalog(CONTENT_ROOT, latest)]);
  if (!meta.scenarios.includes(request)) throw new RangeError(`No recorded request "${request}" for ${latest}`);
  const trace = await readTrace(CONTENT_ROOT, latest, request);
  return buildLifecycle({ trace, lookup: catalogMatcher(catalog.hooks), wp: meta.wp });
}
