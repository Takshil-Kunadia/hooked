/**
 * From one tracer dump to the committed trace file.
 *
 * Playground is real WordPress plus a little tooling of its own (auto-login, a SQLite database
 * driver standing in for MySQL). Its own listeners are dropped. Hooks fired from its code are kept
 * only when they are core hooks (the SQLite driver fires core's `query` filter just as wpdb does),
 * without a call site, since that would point at Playground rather than WordPress.
 */
import type { RawEvent } from "./trace.ts";
import { classifyOrigin, compactTrace } from "./trace.ts";
import type { TraceFile, TracerDump } from "./schema.ts";

export interface TracedRequest {
  readonly scenario: string;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly status: number;
}

/** Paths the tracer could not make relative to the WordPress root belong to Playground. */
const isOutsideWordPress = (file: string | null): boolean => file !== null && file.startsWith("/");

export function buildTraceFile(
  dump: TracerDump,
  request: TracedRequest,
  isCoreHook: (name: string) => boolean,
): TraceFile {
  if (dump.scenario !== request.scenario) {
    throw new Error(`Tracer wrote scenario "${dump.scenario}" for request "${request.scenario}"`);
  }

  const events = dump.events.flatMap((event): RawEvent[] => {
    const [name, type, file] = event;
    if (!isOutsideWordPress(file)) return [event];
    return isCoreHook(name) ? [[name, type, null, null]] : [];
  });
  const trace = compactTrace(events);

  const listeners = Object.fromEntries(
    trace.hooks
      .map(
        ({ name }) =>
          [name, (dump.listeners[name] ?? []).filter(([, , , f]) => classifyOrigin(f).origin !== "tooling")] as const,
      )
      .filter(([, list]) => list.length > 0),
  );

  return {
    scenario: request.scenario,
    request: { method: request.method, path: request.path },
    status: request.status,
    theme: dump.theme,
    hooks: [...trace.hooks],
    listeners,
    sequence: [...trace.sequence],
  };
}
