/**
 * Turning the raw tracer output (one entry per hook call) into compact, typed data:
 * each hook once, plus the full firing sequence as indexes, plus who was listening.
 *
 * Kept free of path aliases and non-erasable TypeScript so the data pipeline can
 * import it with plain Node (type stripping).
 */

/** Hook priority. PHP's integer extremes travel as their names (JSON loses precision past 2^53). */
export type Priority = number | "PHP_INT_MAX" | "PHP_INT_MIN";

/** [hook name, action|filter, call-site file relative to the WordPress root, line]. */
export type RawEvent = readonly [name: string, type: "action" | "filter", file: string | null, line: number | null];

/** [callback name, priority, accepted args, file the callback is defined in (null for built-in PHP)]. */
export type RawListener = readonly [callback: string, priority: Priority, acceptedArgs: number, file: string | null];

interface TracedHook {
  readonly name: string;
  readonly type: "action" | "filter";
  readonly file: string | null;
  readonly line: number | null;
  readonly count: number;
  readonly firstIndex: number;
}

export interface CompactTrace {
  readonly hooks: ReadonlyArray<TracedHook>;
  readonly sequence: ReadonlyArray<number>;
}

export function compactTrace(events: ReadonlyArray<RawEvent>): CompactTrace {
  const indexByName = new Map<string, number>();
  const hooks: TracedHook[] = [];
  const counts: number[] = [];
  const sequence: number[] = [];
  events.forEach(([name, type, file, line], i) => {
    let idx = indexByName.get(name);
    if (idx === undefined) {
      idx = hooks.length;
      indexByName.set(name, idx);
      hooks.push({ name, type, file, line, count: 0, firstIndex: i });
      counts.push(0);
    }
    counts[idx] = (counts[idx] ?? 0) + 1;
    sequence.push(idx);
  });
  return { hooks: hooks.map((h, i) => ({ ...h, count: counts[i] ?? 0 })), sequence };
}

/** The given hook names ordered by when they first fired; names that never fired are dropped. */
export function firstFiredOrder(trace: CompactTrace, names: ReadonlyArray<string>): string[] {
  const first = new Map(trace.hooks.map((h) => [h.name, h.firstIndex]));
  return names.filter((n) => first.has(n)).sort((a, b) => (first.get(a) ?? 0) - (first.get(b) ?? 0));
}

type ListenerOrigin = "core" | "plugin" | "theme" | "mu" | "dropin" | "php" | "tooling";

export interface OriginInfo {
  readonly origin: ListenerOrigin;
  readonly component: string | undefined;
}

const DROPINS = /^wp-content\/(advanced-cache|object-cache|db|db-error|maintenance|sunrise|fatal-error-handler)\.php$/;

/** Who a callback belongs to, judged by the file it is defined in. */
export function classifyOrigin(file: string | null): OriginInfo {
  if (file === null) return { origin: "php", component: undefined };
  const plugin = /^wp-content\/plugins\/([^/]+)\//.exec(file);
  if (plugin) return { origin: "plugin", component: plugin[1] };
  const theme = /^wp-content\/themes\/([^/]+)\//.exec(file);
  if (theme) return { origin: "theme", component: theme[1] };
  const mu = /^wp-content\/mu-plugins\/(.+)$/.exec(file);
  if (mu) return { origin: "mu", component: mu[1] };
  if (DROPINS.test(file)) return { origin: "dropin", component: file.slice("wp-content/".length) };
  if (/^(wp-includes|wp-admin)\//.test(file) || /^(index|xmlrpc|wp-[a-z-]+)\.php$/.test(file)) {
    return { origin: "core", component: undefined };
  }
  return { origin: "tooling", component: undefined };
}

export interface Listener {
  readonly callback: string;
  readonly priority: Priority;
  readonly acceptedArgs: number;
  readonly file: string | null;
  readonly origin: ListenerOrigin;
  readonly component: string | undefined;
}

/** A sortable number for any priority. */
export function priorityValue(priority: Priority): number {
  if (priority === "PHP_INT_MAX") return Number.POSITIVE_INFINITY;
  if (priority === "PHP_INT_MIN") return Number.NEGATIVE_INFINITY;
  return priority;
}

/** Listeners in the order WordPress runs them: by priority, then by registration order. */
export function normalizeListeners(raw: ReadonlyArray<RawListener>): Listener[] {
  return raw
    .map(([callback, priority, acceptedArgs, file], order) => ({
      listener: { callback, priority, acceptedArgs, file, ...classifyOrigin(file) },
      order,
    }))
    .sort((a, b) => priorityValue(a.listener.priority) - priorityValue(b.listener.priority) || a.order - b.order)
    .map(({ listener }) => listener);
}
