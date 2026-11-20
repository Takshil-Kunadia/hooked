"use client";

import { useEffect } from "react";
import { layoutMode } from "@/lib/story/layout";
import { storyStore } from "@/lib/story/store";

const COARSE_POINTER = "(pointer: coarse)";

/**
 * Keeps the story store's layout mode in step with the viewport. On touch screens a resize that only
 * changes the height (the URL bar sliding, the keyboard) is ignored, so the scene never jumps
 * mid-scroll. The reduced-motion flag comes from the story's DOM controller (lib/story/reduced-motion).
 */
export function useStoryViewport(): void {
  useEffect(() => {
    const coarse = window.matchMedia(COARSE_POINTER);
    let lastWidth = Number.NaN;

    const onResize = (): void => {
      const width = window.innerWidth;
      if (coarse.matches && width === lastWidth) return;
      lastWidth = width;
      const next = layoutMode(width, window.innerHeight);
      const { layout, setLayout } = storyStore.getState();
      if (layout !== next) setLayout(next);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
}
