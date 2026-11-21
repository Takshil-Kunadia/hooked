"use client";

import { useId, useMemo, useState } from "react";
import { useStore } from "zustand";
import type { LifecycleMap } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";
import { overviewPose, stagePose, stopPose } from "@/lib/lifecycle/view";

const MAX_RESULTS = 8;

const aspect = (): number =>
  typeof window === "undefined" ? 16 / 9 : window.innerWidth / Math.max(1, window.innerHeight);

function flyToStop(map: LifecycleMap, i: number): void {
  const stop = map.stops[i];
  if (!stop) return;
  const store = lifecycleStore.getState();
  store.select(i);
  store.flyTo(stopPose(stop.x, stop.z));
}

interface MapControlsBarProps {
  readonly map: LifecycleMap;
}

/** Ride, the stage chips and hook search. */
export function MapControlsBar({ map }: MapControlsBarProps) {
  const riding = useStore(lifecycleStore, (s) => s.riding);
  const ride = useStore(lifecycleStore, (s) => Math.floor(s.ride));
  const [query, setQuery] = useState("");
  const listId = useId();
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return map.stops
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.s.name.startsWith(q)) - Number(!b.s.name.startsWith(q)))
      .slice(0, MAX_RESULTS);
  }, [map.stops, query]);
  const finished = !riding && ride >= map.stops.length - 1;
  const started = riding || ride > 0;

  return (
    <div className="map-bar">
      <button
        type="button"
        className="map-ride"
        aria-pressed={riding}
        onClick={() => lifecycleStore.getState().toggleRide(map.stops.length)}
      >
        <span aria-hidden="true">{riding ? "❚❚" : "▶"}</span>
        {riding ? "Pause" : finished ? "Ride again" : started ? "Keep riding" : "Ride the request"}
      </button>
      <nav aria-label="Stages" className="map-stages">
        <button
          type="button"
          className="map-stage"
          onClick={() => lifecycleStore.getState().flyTo(overviewPose(map.bounds, aspect()))}
        >
          All
        </button>
        {map.stages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="map-stage"
            onClick={() => lifecycleStore.getState().flyTo(stagePose(s, map.bounds))}
          >
            <span className="map-stage-n">{i + 1}</span> {s.title} <span className="map-stage-count">{s.count}</span>
          </button>
        ))}
      </nav>
      <div className="map-search">
        <label htmlFor={`${listId}-q`} className="sr-only">
          Find a hook
        </label>
        <input
          id={`${listId}-q`}
          type="search"
          placeholder="Find a hook…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            const first = results[0];
            if (e.key === "Enter" && first) {
              flyToStop(map, first.i);
              setQuery("");
            }
            if (e.key === "Escape") setQuery("");
          }}
        />
        {results.length > 0 && (
          <ul className="map-results">
            {results.map(({ s, i }) => (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => {
                    flyToStop(map, i);
                    setQuery("");
                  }}
                >
                  <code>{s.name}</code>
                  <span>{s.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
