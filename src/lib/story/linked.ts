/**
 * Two-way hover linking: whichever card is open, opened from a copy word, a board row or a map
 * object, every element showing that name highlights (the words, the board row, the 3D prop).
 */
import type { StoryState } from "./store";

/** The card the page highlights everywhere: the pinned card, else the hovered one. */
export const linkedCard = (s: Pick<StoryState, "hovered" | "pinned">): string | null => s.pinned ?? s.hovered;

/** Whether an element showing card `name` is linked to the open card `linked`. */
export const isLinked = (name: string, linked: string | null): boolean => linked !== null && name === linked;
