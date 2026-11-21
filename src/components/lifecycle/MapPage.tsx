import Link from "next/link";
import type { RequestChoice } from "@/lib/lifecycle/data";
import type { LifecycleMap } from "@/lib/lifecycle/model";
import { LifecycleApp } from "./LifecycleApp";

const n = (value: number): string => value.toLocaleString("en");

const DOOR: Readonly<Record<LifecycleMap["kind"], string>> = {
  front: "a page of the site",
  rest: "the REST API",
  admin: "the admin",
  ajax: "admin-ajax.php",
  cron: "wp-cron.php",
};

interface RequestPickerProps {
  readonly choices: ReadonlyArray<RequestChoice>;
  readonly current: string;
}

/** Every recorded request, as plain links: each has its own map page. */
function RequestPicker({ choices, current }: RequestPickerProps) {
  const now = choices.find((c) => c.id === current);
  return (
    <details className="map-picker">
      <summary>
        <span className="map-picker-label">Request</span>
        <span className="map-picker-now">{now ? now.summary : current}</span>
        <span aria-hidden="true">▾</span>
      </summary>
      <ul>
        {choices.map((c) => (
          <li key={c.id}>
            <Link
              href={c.id === "block-single" ? "/map" : `/map/${c.id}`}
              aria-current={c.id === current ? "page" : undefined}
            >
              <span>{c.summary}</span>
              <code>
                {c.method} {c.path}
              </code>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface MapPageProps {
  readonly map: LifecycleMap;
  readonly choices: ReadonlyArray<RequestChoice>;
}

/**
 * The lifecycle map of one request: every hook it fired, as one metro line. The 3D map is an
 * extra; the timetable below it is the same information as plain HTML.
 */
export function MapPage({ map, choices }: MapPageProps) {
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
          <RequestPicker choices={choices} current={map.scenario} />
          <p className="map-lede">
            <code>
              {map.request.method} {map.request.path}
            </code>{" "}
            came in through {DOOR[map.kind]} on WordPress {map.wp} and fired{" "}
            <strong>{n(map.stops.length)} different hooks</strong> ({n(actions)} actions,{" "}
            {n(map.stops.length - actions)} filters), <strong>{n(map.totalCalls)} times</strong> in all. Each is a stop
            on this line, in the order it first ran.
          </p>
          <p className="map-legend">
            <span>◉ action: a station</span> <span>⌒ filter: a portal, taller the more often it ran</span>{" "}
            <span>Drag to move · scroll to zoom · click a stop</span>
          </p>
        </div>
        <LifecycleApp key={map.scenario} map={map} />
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
                  {s.demo && <span> · demo, not in WordPress</span>}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </section>
    </main>
  );
}
