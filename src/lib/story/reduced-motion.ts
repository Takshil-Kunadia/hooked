/**
 * The story's single source for `prefers-reduced-motion`. The DOM controller binds it as soon as the
 * story mounts, before the 3D stage loads (and when it never does), so key and rail scrolling,
 * snapping and the scene all read the same flag from the store.
 */
import type { StoryStore } from "./store";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** The part of a MediaQueryList this reads, so it runs without a DOM. */
export interface MediaLike {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

/** Copies the media query's answer into the store now and on every change; returns the cleanup. */
export function syncReducedMotion(store: StoryStore, media: MediaLike): () => void {
  const apply = (): void => {
    const { reducedMotion, setReducedMotion } = store.getState();
    if (reducedMotion !== media.matches) setReducedMotion(media.matches);
  };
  apply();
  media.addEventListener("change", apply);
  return () => media.removeEventListener("change", apply);
}
