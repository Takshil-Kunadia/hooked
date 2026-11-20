/** "Under the hood": the hooks an act talks about, with where WordPress core fires each one. */
import type { ActSpec } from "./chapter";
import type { StoryData } from "./facts";

export interface HoodRow {
  readonly name: string;
  readonly file: string;
  readonly line: number;
  /** The line on GitHub, at the WordPress release the story describes. */
  readonly url: string;
}

/**
 * Each hook the act's beats name, once, in the order the hooks fired (`sources` is kept in that
 * order, see data.ts). Throws when a hook has no source, so a missing fact fails the build rather
 * than quietly dropping a row.
 */
export function hoodRows(act: ActSpec, sources: StoryData["sources"]): HoodRow[] {
  const named = new Set(act.beats.flatMap((b) => b.hooks));
  const missing = [...named].filter((name) => !Object.hasOwn(sources, name));
  if (missing.length > 0) {
    throw new Error(`Act "${act.id}" names hooks with no source in the story data: ${missing.join(", ")}`);
  }
  return Object.entries(sources)
    .filter(([name]) => named.has(name))
    .map(([name, { file, line, url }]) => ({ name, file, line, url }));
}
