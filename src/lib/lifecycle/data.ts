import "server-only";
import path from "node:path";
import { readCatalog, readIndex, readMeta, readTrace } from "@/lib/wp-data/files";
import { catalogMatcher } from "./catalog-match";
import { buildLifecycle, type LifecycleMap } from "./model";

const CONTENT_ROOT = path.join(process.cwd(), "content", "versions");
/** The request the map shows: one blog post, on the default block theme. */
const SCENARIO = "block-single";

/** The lifecycle map for the latest WordPress version's single-post request. */
export async function getLifecycleMap(): Promise<LifecycleMap> {
  "use cache";
  const { latest } = await readIndex(CONTENT_ROOT);
  const [meta, catalog, trace] = await Promise.all([
    readMeta(CONTENT_ROOT, latest),
    readCatalog(CONTENT_ROOT, latest),
    readTrace(CONTENT_ROOT, latest, SCENARIO),
  ]);
  return buildLifecycle({ trace, lookup: catalogMatcher(catalog.hooks), wp: meta.wp });
}
