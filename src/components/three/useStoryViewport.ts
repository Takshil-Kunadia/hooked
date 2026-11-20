"use client";

import { useEffect } from "react";
import { layoutMode } from "@/lib/story/layout";
import { storyStore } from "@/lib/story/store";

const COARSE_POINTER = "(pointer: coarse)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Keeps the story store's layout mode and reduced-motion flag in step with the viewport.
 * On touch screens a resize that only changes the height (the URL bar sliding, the keyboard)
 * is ignored, so the scene never jumps mid-scroll.
 */
export function useStoryViewport(): void {
  useEffect(() => {
    const coarse = window.matchMedia(COARSE_POINTER);
    const motion = window.matchMedia(REDUCED_MOTION);
    let lastWidth = Number.NaN;

    const onResize = (): void => {
      const width = window.innerWidth;
      if (coarse.matches && width === lastWidth) return;
      lastWidth = width;
      const next = layoutMode(width, window.innerHeight);
      const { layout, setLayout } = storyStore.getState();
      if (layout !== next) setLayout(next);
    };
    const onMotion = (): void => {
      const { reducedMotion, setReducedMotion } = storyStore.getState();
      if (reducedMotion !== motion.matches) setReducedMotion(motion.matches);
    };

    onResize();
    onMotion();
    window.addEventListener("resize", onResize);
    motion.addEventListener("change", onMotion);
    return () => {
      window.removeEventListener("resize", onResize);
      motion.removeEventListener("change", onMotion);
    };
  }, []);
}
