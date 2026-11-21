/**
 * The lighting narrative of the story: daylight at the browser, a misty morning while WordPress
 * loads, dusk at `init`, the dark core at the database, and light again when the page comes back.
 * Pure numbers (0 Day, 0.25 mist, 0.5 Dusk, 1 the dark core); the scene turns them into colours.
 */
import type { StationId } from "@/lib/metro/route";
import type { BeatSpec } from "./chapter";

const STATION_MOOD: Readonly<Record<StationId, number>> = {
  browser: 0,
  server: 0,
  php: 0.05,
  index: 0.2,
  config: 0.22,
  settings: 0.3,
  init: 0.5,
  query: 1,
  template: 0.75,
  the_title: 0.35,
  response: 0,
};

/** Looking into the database is a glimpse of the core, even from Stop 0. */
const DEPOT_MOOD = 0.85;

/** The page's text switches to its dark colours from this mood on. */
export const DARK_TEXT_FROM = 0.42;

/** The mood of a beat; the hero and the overviews stay in the scheme's own light. */
export function beatMood(beat: Pick<BeatSpec, "station" | "shot"> | null, dark: boolean): number {
  let mood = 0;
  if (beat && beat.shot !== "overview") mood = beat.shot === "depot" ? DEPOT_MOOD : STATION_MOOD[beat.station];
  return dark ? 0.5 + mood / 2 : mood;
}

/** One frame of easing towards `goal`, snapped to `step` so colours change in a few steps, not every frame. */
export function easeMood(
  current: number,
  goal: number,
  k: number,
  step: number,
): { readonly value: number; readonly shown: number } {
  const value = current + (goal - current) * Math.min(1, Math.max(0, k));
  return { value, shown: Math.round(value / step) * step };
}
