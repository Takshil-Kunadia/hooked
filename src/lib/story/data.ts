import "server-only";
import path from "node:path";
import { readIndex, readMeta, readTrace } from "@/lib/wp-data/files";
import { normalizeListeners } from "@/lib/wp-data/trace";
import { firedOrder, hookSource, initTickets, sourceUrl, type StoryData } from "./facts";

const CONTENT_ROOT = path.join(process.cwd(), "content", "versions");
const SCENARIO = "block-single";
const BOOT_HOOKS = ["muplugins_loaded", "plugins_loaded", "setup_theme", "after_setup_theme"] as const;
/** Every hook named in Chapter 1's "Under the hood" lists. */
const SOURCE_HOOKS = [...BOOT_HOOKS, "init", "wp_loaded"] as const;

/** Chapter 1's facts from the latest WordPress version's data. Throws if a fact is missing. */
export async function getStoryData(): Promise<StoryData> {
  "use cache";
  const { latest } = await readIndex(CONTENT_ROOT);
  const [meta, trace] = await Promise.all([readMeta(CONTENT_ROOT, latest), readTrace(CONTENT_ROOT, latest, SCENARIO)]);

  const sources = Object.fromEntries(
    SOURCE_HOOKS.map((name) => {
      const source = hookSource(trace, name);
      if (!source) throw new Error(`The ${SCENARIO} trace for ${latest} has no source location for "${name}"`);
      return [name, { file: source.file, line: source.line, url: sourceUrl(meta.wp, source.file, source.line) }];
    }),
  );

  return {
    version: latest,
    wp: meta.wp,
    request: trace.request,
    status: trace.status,
    tickets: initTickets(normalizeListeners(trace.listeners["init"] ?? [])),
    bootAnnouncements: firedOrder(trace, BOOT_HOOKS),
    sources,
  };
}
