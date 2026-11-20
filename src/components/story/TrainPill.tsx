"use client";

import { useStore } from "zustand";
import { pillSpot } from "@/lib/story/pill";
import { storyStore } from "@/lib/story/store";
import { trainScreen } from "@/lib/story/train-screen";
import { avoidRects } from "./dom";

/**
 * Follows the train's screen point with a transform, once per frame at most: reads sizes first, then
 * writes. Hidden when the train is out of view or the pill would crowd the copy, a board or the header.
 */
function followTrain(el: HTMLDivElement): () => void {
  let frame = 0;
  const place = (): void => {
    frame = 0;
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const spot = pillSpot(trainScreen.getState(), { w: el.offsetWidth, h: el.offsetHeight }, viewport, avoidRects());
    if (spot) el.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
    el.style.opacity = spot ? "1" : "0";
  };
  const schedule = (): void => {
    if (frame === 0) frame = requestAnimationFrame(place);
  };
  schedule();
  const unsubscribe = trainScreen.subscribe(schedule);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    unsubscribe();
    cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

interface TrainPillProps {
  /** The pill's text at each beat (by global index), or null where it hides. */
  readonly texts: ReadonlyArray<string | null>;
}

/** The train's cargo, floating above it: the request, the announcement, the response. */
export function TrainPill({ texts }: TrainPillProps) {
  const text = useStore(storyStore, (s) => texts[s.globalIndex] ?? null);
  if (text === null) return null;
  return (
    <div ref={followTrain} className="train-pill" aria-hidden="true">
      <span key={text}>{text}</span>
    </div>
  );
}
