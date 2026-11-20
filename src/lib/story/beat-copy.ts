/** A beat's copy, as the chapter's content module writes it. */
import type { ReactNode } from "react";
import type { StoryData } from "./facts";

/**
 * Fixed words, or a function of the story's data for copy that quotes a fact (the request's path,
 * say), so the fact is never typed into the copy.
 */
export type BeatCopy = ReactNode | ((data: StoryData) => ReactNode);

export function renderBeatCopy(copy: BeatCopy | undefined, data: StoryData): ReactNode {
  return typeof copy === "function" ? copy(data) : (copy ?? null);
}
