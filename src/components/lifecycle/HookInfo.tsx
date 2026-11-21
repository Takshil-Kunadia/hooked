"use client";

import { useStore } from "zustand";
import type { LifecycleMap, LifecycleStop } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";

const ORIGIN_LABEL: Readonly<Record<string, string>> = {
  core: "core",
  plugin: "plugin",
  theme: "theme",
  mu: "must-use",
  dropin: "drop-in",
  php: "PHP",
  tooling: "tracer",
};

const sourceUrl = (wp: string, stop: LifecycleStop): string | null =>
  stop.file === null
    ? null
    : `https://github.com/WordPress/WordPress/blob/${wp}/${stop.file}${stop.line === null ? "" : `#L${stop.line}`}`;

const times = (n: number): string => (n === 1 ? "once" : `${n.toLocaleString("en")} times`);

interface HookInfoProps {
  readonly map: LifecycleMap;
}

/** The card for the stop under the pointer, or the one picked (which stays until closed). */
export function HookInfo({ map }: HookInfoProps) {
  const hovered = useStore(lifecycleStore, (s) => s.hovered);
  const selected = useStore(lifecycleStore, (s) => s.selected);
  const index = selected ?? hovered;
  const stop = index === null ? undefined : map.stops[index];
  if (!stop || index === null) return null;
  const doc = stop.doc === null ? undefined : map.docs[stop.doc];
  const stage = map.stages.find((s) => s.id === stop.stage);
  const source = sourceUrl(map.wp, stop);
  const isAction = stop.type === "action";

  return (
    <aside className="map-card" aria-live="polite" data-pinned={selected !== null ? "" : undefined}>
      <div className="map-card-head">
        <span className="map-chip" data-kind={stop.type}>
          {isAction ? "◉ action" : "⌒ filter"}
        </span>
        <span className="map-card-stage">
          {stage ? `${map.stages.indexOf(stage) + 1} · ${stage.title}` : ""} · stop {index + 1} of {map.stops.length}
        </span>
        {selected !== null && (
          <button type="button" className="map-card-close" onClick={() => lifecycleStore.getState().select(null)}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
      <h2 className="map-card-name">{stop.name}</h2>
      <p className="map-card-call">
        {isAction ? "do_action" : "apply_filters"}( &apos;{stop.name}&apos;
        {isAction ? "" : ", $value"} ) ran {times(stop.count)}, first as call{" "}
        {(stop.firstCall + 1).toLocaleString("en")} of {map.totalCalls.toLocaleString("en")}.
      </p>
      {doc ? (
        <p className="map-card-doc">
          {doc.description}
          {doc.dynamic && (
            <span className="map-card-pattern">
              {" "}
              Documented as <code>{doc.pattern}</code>.
            </span>
          )}
        </p>
      ) : (
        <p className="map-card-doc">Not in the documented hook list.</p>
      )}
      {stop.listeners.length > 0 && (
        <div className="map-card-listeners">
          <p className="map-card-label">Listening when it first ran</p>
          <ol>
            {stop.listeners.map((l, k) => (
              <li key={`${l.callback}-${k}`}>
                <span className="map-card-priority">P{l.priority}</span>
                <code>{l.callback}</code>
                <span className="map-card-origin" data-origin={l.origin}>
                  {ORIGIN_LABEL[l.origin] ?? l.origin}
                </span>
              </li>
            ))}
          </ol>
          {stop.moreListeners > 0 && <p className="map-card-more">and {stop.moreListeners} more</p>}
        </div>
      )}
      <p className="map-card-links">
        {source && (
          <a href={source} target="_blank" rel="noreferrer">
            {stop.file}
            {stop.line === null ? "" : `:${stop.line}`} ↗
          </a>
        )}
        {doc?.docsUrl && (
          <a href={doc.docsUrl} target="_blank" rel="noreferrer">
            Official docs ↗
          </a>
        )}
      </p>
    </aside>
  );
}
