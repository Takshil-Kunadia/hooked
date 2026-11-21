import type { Metadata } from "next";
import Link from "next/link";
import { LifecycleApp } from "@/components/lifecycle/LifecycleApp";
import { getLifecycleMap } from "@/lib/lifecycle/data";

export const metadata: Metadata = {
  title: "Every hook in one request",
  description:
    "The map of a whole WordPress request: every action and filter one page visit fires, in the order it fires, recorded from real WordPress.",
};

const n = (value: number): string => value.toLocaleString("en");

/**
 * The lifecycle map: one real request, every hook it fired, as one metro line. The 3D map is an
 * extra; the timetable below it is the same information as plain HTML.
 */
export default async function MapPage() {
  const map = await getLifecycleMap();
  const actions = map.stops.filter((s) => s.type === "action").length;
  return (
    <main className="relative">
      <section aria-labelledby="map-title" className="map-hero">
        <div className="map-intro">
          <Link href="/" className="map-back">
            ← The story
          </Link>
          <h1 id="map-title" className="map-title">
            Every hook, one request.
          </h1>
          <p className="map-lede">
            <code>
              {map.request.method} {map.request.path}
            </code>{" "}
            on WordPress {map.wp} fired <strong>{n(map.stops.length)} different hooks</strong> ({n(actions)} actions,{" "}
            {n(map.stops.length - actions)} filters), <strong>{n(map.totalCalls)} times</strong> in all. Each is a stop
            on this line, in the order it first ran.
          </p>
          <p className="map-legend">
            <span>◉ action: a station</span> <span>⌒ filter: a portal, taller the more often it ran</span>{" "}
            <span>Drag to move · scroll to zoom · click a stop</span>
          </p>
        </div>
        <LifecycleApp map={map} />
      </section>

      <section aria-labelledby="timetable-title" className="map-timetable">
        <h2 id="timetable-title">The timetable</h2>
        <p>Every hook the request fired, stage by stage, in the order each first ran.</p>
        {map.stages.map((stage, k) => (
          <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="map-tt-stage">
            <h3 id={`stage-${stage.id}`}>
              {k + 1}. {stage.title} <span>{stage.where}</span>
            </h3>
            <p>
              {stage.what} {n(stage.count)} hooks, {n(stage.calls)} calls.
            </p>
            <ol start={stage.first + 1}>
              {map.stops.slice(stage.first, stage.first + stage.count).map((s) => (
                <li key={s.name}>
                  <code>{s.name}</code> <span>{s.type}</span>
                  {s.count > 1 && <span> ×{n(s.count)}</span>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </section>
    </main>
  );
}
