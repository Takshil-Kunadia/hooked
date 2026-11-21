"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PORTRAIT_LAYOUT } from "@/lib/lifecycle/layout";
import { relayout, type LifecycleMap } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";
import { isWebGLAvailable } from "@/lib/webgl/support";
import { HookInfo } from "./HookInfo";
import { MapControlsBar } from "./MapControlsBar";

const LifecycleStage = dynamic(() => import("./LifecycleStage"), { ssr: false, loading: () => null });

/** Above this mood the scene is dark enough that the page's UI switches to its dark colours. */
const DARK_UI_FROM = 0.42;

const subscribeNever = (): (() => void) => () => {};
const getWebGL = (): boolean => isWebGLAvailable();
const getServerWebGL = (): null => null;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void): (() => void) => {
  const q = window.matchMedia(REDUCED_MOTION);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
const getMotion = (): boolean => window.matchMedia(REDUCED_MOTION).matches;
const getServerMotion = (): boolean => false;
const PORTRAIT = "(orientation: portrait)";
const subscribePortrait = (onChange: () => void): (() => void) => {
  const q = window.matchMedia(PORTRAIT);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
const getPortrait = (): boolean => window.matchMedia(PORTRAIT).matches;

interface LifecycleAppProps {
  readonly map: LifecycleMap;
}

/** The map's 3D stage and the HTML laid over it: names, the train's pill, the card and controls. */
export function LifecycleApp({ map }: LifecycleAppProps) {
  const webgl = useSyncExternalStore<boolean | null>(subscribeNever, getWebGL, getServerWebGL);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotion, getServerMotion);
  /* a tall screen gets narrow rows, so the whole line still fits */
  const portrait = useSyncExternalStore(subscribePortrait, getPortrait, getServerMotion);
  const placed = useMemo(() => (portrait ? relayout(map, PORTRAIT_LAYOUT) : map), [map, portrait]);
  const overlay = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(false);
  const onMood = useCallback((mood: number) => setDark(mood >= DARK_UI_FROM), []);
  /* the store outlives a page: a newly opened map starts with nothing picked and the train parked */
  useEffect(() => lifecycleStore.getState().reset(), [map]);

  return (
    <div className="map-app" data-scheme={dark ? "dark" : "light"}>
      {webgl === false && (
        <p className="map-nogl">
          This browser can&apos;t show the 3D map. Every hook is listed below, in the order it ran.
        </p>
      )}
      {webgl && (
        <div className="map-canvas" aria-hidden="true">
          <LifecycleStage
            key={portrait ? "tall" : "wide"}
            map={placed}
            overlay={overlay}
            pill={pill}
            reducedMotion={reducedMotion}
            onMood={onMood}
          />
        </div>
      )}
      <div ref={overlay} className="map-names" aria-hidden="true" />
      <div ref={pill} className="map-pill" aria-hidden="true" />
      <MapControlsBar map={placed} />
      <HookInfo map={map} />
    </div>
  );
}
