"use client";

import { useLayoutEffect } from "react";
import { focusOwnsKey, stepDirection } from "@/lib/story/keys";
import {
  activeBeatOf,
  copyVisibility,
  focusTarget,
  globalIndexOf,
  hashTarget,
  keyTarget,
  settleTarget,
  SNAP_IDLE_MS,
  type ActShape,
  type FocusSpot,
} from "@/lib/story/pins";
import { REDUCED_MOTION_QUERY, syncReducedMotion } from "@/lib/story/reduced-motion";
import { beatScrollY, positionAt, type MeasuredAct, type StoryPosition } from "@/lib/story/scroll";
import { storyStore } from "@/lib/story/store";
import { dropProgrammaticScroll, measureStory, pinHeight, programmaticScrollInFlight, scrollToY } from "./dom";

const COARSE_POINTER = "(pointer: coarse)";
const PASSIVE = { passive: true } as const;
/** The hover card (HookCard): focus coming back from it is not the reader moving on. */
const CARD_PANEL = ".hook-card";

/** A reload or back/forward visit, where the browser restores the scroll position itself. */
function isRestoredVisit(): boolean {
  const entry = performance.getEntriesByType("navigation")[0];
  return entry instanceof PerformanceNavigationTiming && entry.type !== "navigate";
}

/** The DOM an act's copy is painted into; the first act (the page's hero) has none. */
interface ActNodes {
  readonly pin: HTMLElement | null;
  readonly beats: ReadonlyArray<HTMLElement>;
}

function nodesOf({ id }: ActShape): ActNodes {
  const section = document.getElementById(id);
  return {
    pin: section?.querySelector<HTMLElement>("[data-pin]") ?? null,
    beats: section ? Array.from(section.querySelectorAll<HTMLElement>("[data-beats] > li")) : [],
  };
}

/** The act, and the beat within it, whose copy holds `el`; null outside every act's copy. */
function locateCopy(nodes: ReadonlyArray<ActNodes>, el: Element): FocusSpot | null {
  const actIndex = nodes.findIndex((n) => n.pin?.contains(el));
  const beats = nodes[actIndex]?.beats;
  if (!beats) return null;
  const beat = beats.findIndex((li) => li.contains(el));
  return { actIndex, beat: beat === -1 ? null : beat };
}

/** Writes one act's copy visibility and active beat, touching the DOM only when they change. */
function createPainter(nodes: ReadonlyArray<ActNodes>) {
  const shown = nodes.map(() => -1);
  const active = nodes.map(() => 0);
  return (i: number, visibility: number, beat: number): void => {
    const { pin, beats } = nodes[i] ?? { pin: null, beats: [] };
    if (!pin) return;
    const v = Math.round(visibility * 1000) / 1000;
    if (shown[i] !== v) {
      shown[i] = v;
      pin.style.setProperty("--vis", String(v));
      pin.toggleAttribute("data-off", v === 0);
    }
    if (active[i] !== beat) {
      beats[active[i] ?? 0]?.removeAttribute("data-active");
      beats[beat]?.setAttribute("data-active", "");
      active[i] = beat;
    }
  };
}

const samePlace = (a: StoryPosition | null, b: StoryPosition): boolean =>
  a !== null && a.actIndex === b.actIndex && a.beat === b.beat;

/**
 * Drives the story from the page's scroll position: reports the beat to the store, fades the copy,
 * snaps to the nearest beat after 160ms idle (unless `?snap=off` or reduced motion), steps beats on
 * ↓/↑/Space/PageUp/PageDown, follows focus into copy that isn't on screen, and re-measures when the
 * width changes (any resize on a fine pointer). It owns the store's reduced-motion flag; with
 * reduced motion every scroll it makes is instant.
 */
function startStory(shape: ReadonlyArray<ActShape>): () => void {
  /* first, so snapping, keys and the rail read the right flag even before (or without) the 3D stage */
  const stopMotionSync = syncReducedMotion(storyStore, window.matchMedia(REDUCED_MOTION_QUERY));
  const nodes = shape.map(nodesOf);
  const paint = createPainter(nodes);
  const snapOff = new URLSearchParams(window.location.search).get("snap") === "off";
  const coarse = window.matchMedia(COARSE_POINTER);
  let acts: MeasuredAct[] = measureStory(shape);
  let vh = pinHeight();
  let width = window.innerWidth;
  let position: StoryPosition | null = null;
  let frame = 0;
  let focusFrame = 0;
  let snapTimer = 0;
  let holding = false;
  /** Where the last step key is taking the page, so quick presses keep stepping mid-scroll. */
  let stepping: number | null = null;
  let stopped = false;

  const update = (): void => {
    frame = 0;
    const y = window.scrollY;
    const next = positionAt(acts, y, vh);
    const act = shape[next.actIndex];
    if (act && !samePlace(position, next)) {
      const index = globalIndexOf(shape, next.actIndex, next.beat);
      storyStore.getState().goTo(act.id, next.beat, index, performance.now() / 1000);
    }
    position = next;
    acts.forEach((a, i) => paint(i, copyVisibility(a, y, vh), activeBeatOf(i, a.beats, next)));
  };
  const remeasure = (): void => {
    acts = measureStory(shape);
    vh = pinHeight();
  };
  const settle = (): void => {
    if (programmaticScrollInFlight()) {
      armSnap();
      return;
    }
    stepping = null;
    if (snapOff || holding || storyStore.getState().reducedMotion) return;
    const target = settleTarget(acts, window.scrollY, vh);
    if (target !== null) scrollToY(target, true);
  };
  /* wheel and touch cancel a smooth scroll; the reader is steering now */
  const takeOver = (): void => {
    dropProgrammaticScroll();
    stepping = null;
  };
  const armSnap = (): void => {
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(settle, SNAP_IDLE_MS);
  };
  const onScroll = (): void => {
    if (frame === 0) frame = requestAnimationFrame(update);
    armSnap();
  };
  const onKey = (e: Event): void => {
    if (!(e instanceof KeyboardEvent)) return;
    const direction = stepDirection(e);
    if (direction === null || e.defaultPrevented || focusOwnsKey(document.activeElement, e.key)) return;
    const target = keyTarget(acts, stepping ?? window.scrollY, vh, direction);
    if (target === null) return;
    e.preventDefault();
    stepping = target;
    scrollToY(target, !storyStore.getState().reducedMotion);
  };
  /* Tab into copy that isn't on screen (another act, or a beat a stacked sheet hides): go to its beat */
  const onFocusIn = (e: Event): void => {
    const el = e.target;
    if (!(el instanceof Element) || !(e instanceof FocusEvent)) return;
    if (e.relatedTarget instanceof Element && e.relatedTarget.closest(CARD_PANEL)) return;
    const spot = locateCopy(nodes, el);
    const at = positionAt(acts, window.scrollY, vh);
    const goal = spot && focusTarget(shape, at, spot, el.matches(":focus-visible"));
    const act = goal ? acts[goal.actIndex] : undefined;
    if (!goal || !act) return;
    const target = beatScrollY(act, goal.beat, vh);
    stepping = target;
    cancelAnimationFrame(focusFrame);
    /* next frame: after the browser's own scroll to the focused element, which would cut ours short */
    focusFrame = requestAnimationFrame(() => scrollToY(target, !storyStore.getState().reducedMotion));
  };
  /* rotation or a window resize: re-measure, then keep the same beat in place */
  const onResize = (): void => {
    if (coarse.matches && window.innerWidth === width) return;
    width = window.innerWidth;
    const keep = position;
    remeasure();
    const act = keep && !keep.inBreather ? acts[keep.actIndex] : undefined;
    if (keep && act) scrollToY(beatScrollY(act, keep.beat, vh), false);
    update();
  };
  const onLoad = (): void => {
    if (stopped) return;
    remeasure();
    update();
  };
  /* don't snap under a finger or while the scrollbar is held; settle once it lets go */
  const hold = (e: Event): void => {
    if (!(e instanceof PointerEvent) || e.pointerType === "mouse") holding = true;
  };
  const release = (): void => {
    holding = false;
    armSnap();
  };

  const listeners: ReadonlyArray<readonly [string, (e: Event) => void, AddEventListenerOptions?]> = [
    ["scroll", onScroll, PASSIVE],
    ["resize", onResize],
    ["load", onLoad],
    ["keydown", onKey],
    ["focusin", onFocusIn],
    ["wheel", takeOver, PASSIVE],
    ["pointerdown", hold, PASSIVE],
    ["pointerup", release, PASSIVE],
    ["touchstart", takeOver, PASSIVE],
    ["touchstart", hold, PASSIVE],
    ["touchend", release, PASSIVE],
    ["touchcancel", release, PASSIVE],
  ];
  for (const [type, fn, options] of listeners) window.addEventListener(type, fn, options);
  void document.fonts.ready.then(onLoad);

  /* first paint (R8): a `#act` link or the browser-restored position, before the 3D stage loads */
  const jump = isRestoredVisit() ? null : hashTarget(acts, window.location.hash, window.scrollY, vh);
  if (jump !== null) scrollToY(jump, false);
  update();
  armSnap();

  return () => {
    stopped = true;
    stopMotionSync();
    for (const [type, fn] of listeners) window.removeEventListener(type, fn);
    cancelAnimationFrame(frame);
    cancelAnimationFrame(focusFrame);
    window.clearTimeout(snapTimer);
  };
}

interface StoryControllerProps {
  /** Every act in order, the page's hero first. */
  readonly acts: ReadonlyArray<ActShape>;
}

/** Turns scroll into story beats; renders nothing. */
export function StoryController({ acts }: StoryControllerProps) {
  useLayoutEffect(() => startStory(acts), [acts]);
  return null;
}
