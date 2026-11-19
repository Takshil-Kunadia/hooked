/**
 * What changed between two WordPress versions: hooks added, removed or deprecated in the catalog,
 * and, per traced request, hooks that started or stopped firing, moved in the firing order, or
 * gained, lost or re-prioritised a core listener.
 */
import type { CatalogHook } from "./catalog.ts";
import type { ChangesFile, TraceFile } from "./schema.ts";
import type { Priority, RawListener } from "./trace.ts";
import { classifyOrigin } from "./trace.ts";

type CatalogChanges = ChangesFile["catalog"];
type ScenarioChanges = ChangesFile["scenarios"][number];
type ListenerChange = ScenarioChanges["listeners"][number];

/** One entry per hook name; a hook fired from several places counts as deprecated if any is, with the most args. */
function byName(hooks: ReadonlyArray<CatalogHook>): Map<string, CatalogHook> {
  const merged = new Map<string, CatalogHook>();
  for (const hook of hooks) {
    const seen = merged.get(hook.name);
    merged.set(
      hook.name,
      seen ? { ...seen, args: Math.max(seen.args, hook.args), deprecated: seen.deprecated || hook.deprecated } : hook,
    );
  }
  return merged;
}

/** Locale-independent ordering, so generated files are identical on every machine. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (names: Iterable<string>): string[] => [...new Set(names)].sort(byCodeUnit);

export function diffCatalogs(prev: ReadonlyArray<CatalogHook>, next: ReadonlyArray<CatalogHook>): CatalogChanges {
  const before = byName(prev);
  const after = byName(next);
  const both = [...after.values()].filter((h) => before.has(h.name));
  return {
    added: sorted([...after.keys()].filter((name) => !before.has(name))),
    removed: sorted([...before.keys()].filter((name) => !after.has(name))),
    deprecated: sorted(both.filter((h) => h.deprecated && !before.get(h.name)?.deprecated).map((h) => h.name)),
    argsChanged: both
      .filter((h) => before.get(h.name)?.args !== h.args)
      .map((h) => ({ name: h.name, from: before.get(h.name)?.args ?? 0, to: h.args }))
      .sort((a, b) => byCodeUnit(a.name, b.name)),
  };
}

/** Indexes (into `values`) of one longest strictly increasing subsequence, O(n log n). */
function longestIncreasingRun(values: ReadonlyArray<number>): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array<number>(values.length).fill(-1);
  values.forEach((value, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((values[tails[mid] ?? 0] ?? 0) < value) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) previous[i] = tails[lo - 1] ?? -1;
    tails[lo] = i;
  });
  const keep = new Set<number>();
  for (let i = tails[tails.length - 1] ?? -1; i >= 0; i = previous[i] ?? -1) keep.add(i);
  return keep;
}

/** The fewest items that must move to turn the order `prev` into `next` (items in both lists only). */
export function movedItems(prev: ReadonlyArray<string>, next: ReadonlyArray<string>): string[] {
  const position = new Map(next.map((name, i) => [name, i]));
  const common = prev.filter((name) => position.has(name));
  const keep = longestIncreasingRun(common.map((name) => position.get(name) ?? 0));
  return common.filter((_, i) => !keep.has(i));
}

/**
 * Core listeners keyed by callback. Closures have no name, so they are keyed by the file they are
 * written in, numbered within that file: a new closure elsewhere doesn't renumber them.
 */
function coreListeners(list: ReadonlyArray<RawListener>): Map<string, Priority> {
  const seen = new Map<string, number>();
  const out = new Map<string, Priority>();
  for (const [callback, priority, , file] of list) {
    const origin = classifyOrigin(file).origin;
    if (origin !== "core" && origin !== "php") continue;
    const base = callback === "{closure}" ? `{closure}@${file ?? "?"}` : callback;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.set(n === 1 ? base : `${base}#${n}`, priority);
  }
  return out;
}

function diffListeners(
  hook: string,
  prev: ReadonlyArray<RawListener>,
  next: ReadonlyArray<RawListener>,
): ListenerChange[] {
  const before = coreListeners(prev);
  const after = coreListeners(next);
  const changes: ListenerChange[] = [];
  for (const [callback, to] of after) {
    const from = before.get(callback);
    if (from === undefined) changes.push({ hook, callback, change: "added", from: null, to });
    else if (from !== to) changes.push({ hook, callback, change: "priority", from, to });
  }
  for (const [callback, from] of before) {
    if (!after.has(callback)) changes.push({ hook, callback, change: "removed", from, to: null });
  }
  return changes;
}

export function diffTraces(prev: TraceFile, next: TraceFile): ScenarioChanges {
  const before = new Set(prev.hooks.map((h) => h.name));
  const after = new Set(next.hooks.map((h) => h.name));
  const listeners = next.hooks
    .filter((h) => before.has(h.name))
    .flatMap((h) => diffListeners(h.name, prev.listeners[h.name] ?? [], next.listeners[h.name] ?? []));
  return {
    scenario: next.scenario,
    firedAdded: next.hooks.filter((h) => !before.has(h.name)).map((h) => h.name),
    firedRemoved: prev.hooks.filter((h) => !after.has(h.name)).map((h) => h.name),
    moved: movedItems(
      prev.hooks.map((h) => h.name),
      next.hooks.map((h) => h.name),
    ),
    listeners,
  };
}
