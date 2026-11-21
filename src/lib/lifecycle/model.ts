/**
 * The lifecycle map's data: every hook one request fired, in the order it first fired, placed on
 * the map, with its stage, its docs and who was listening. Pure: built on the server from the
 * generated WordPress data and handed to the page and the 3D stage as plain JSON.
 */
import { normalizeListeners, type RawListener } from "@/lib/wp-data/trace";
import type { CatalogDoc, CatalogLookup } from "./catalog-match";
import { DEFAULT_LAYOUT, snakeLayout, type LayoutOptions, type XZ } from "./layout";
import { stageAt, stageStarts, type StageId } from "./stages";

/** At most this many listeners travel with a stop; the rest are counted. */
const MAX_LISTENERS = 12;

interface TracedHook {
  readonly name: string;
  readonly type: "action" | "filter";
  readonly file: string | null;
  readonly line: number | null;
  readonly count: number;
  readonly firstIndex: number;
}

interface LifecycleTrace {
  readonly scenario: string;
  readonly request: { readonly method: string; readonly path: string };
  readonly status: number;
  readonly theme: string | null;
  readonly hooks: ReadonlyArray<TracedHook>;
  readonly listeners: Readonly<Record<string, ReadonlyArray<RawListener>>>;
  readonly sequence: ReadonlyArray<number>;
}

interface StopListener {
  readonly callback: string;
  /** As text: PHP's integer extremes keep their names. */
  readonly priority: string;
  readonly origin: string;
}

export interface LifecycleStop {
  readonly name: string;
  readonly type: "action" | "filter";
  readonly file: string | null;
  readonly line: number | null;
  /** How many times it fired in this request. */
  readonly count: number;
  /** Its first call's position among all of the request's hook calls (0-based). */
  readonly firstCall: number;
  readonly stage: StageId;
  readonly x: number;
  readonly z: number;
  /** Index into `LifecycleMap.docs`: dynamic hooks share their pattern's entry. */
  readonly doc: number | null;
  readonly listeners: ReadonlyArray<StopListener>;
  readonly moreListeners: number;
}

export interface LifecycleStage {
  readonly id: StageId;
  readonly title: string;
  readonly where: string;
  readonly what: string;
  readonly mood: number;
  /** Index of its first stop, and how many stops it has. */
  readonly first: number;
  readonly count: number;
  readonly actions: number;
  /** Every hook call made during the stage. */
  readonly calls: number;
  /** Where its title is printed: just before its first row, at the row's entry side. */
  readonly label: XZ;
  readonly zRange: readonly [number, number];
}

export interface LifecycleMap {
  readonly wp: string;
  readonly scenario: string;
  readonly request: { readonly method: string; readonly path: string };
  readonly status: number;
  readonly theme: string | null;
  readonly totalCalls: number;
  readonly stops: ReadonlyArray<LifecycleStop>;
  readonly docs: ReadonlyArray<CatalogDoc>;
  readonly stages: ReadonlyArray<LifecycleStage>;
  readonly path: ReadonlyArray<XZ>;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

export interface LifecycleInput {
  readonly trace: LifecycleTrace;
  readonly lookup: CatalogLookup;
  /** The WordPress release the trace was recorded on, for source links (`7.1.5`). */
  readonly wp: string;
  readonly layout?: LayoutOptions;
}

const priorityText = (p: RawListener[1]): string => (typeof p === "number" ? String(p) : p);

function stopListeners(
  raw: ReadonlyArray<RawListener> | undefined,
): Pick<LifecycleStop, "listeners" | "moreListeners"> {
  const all = normalizeListeners(raw ?? []);
  return {
    listeners: all.slice(0, MAX_LISTENERS).map((l) => ({
      callback: l.callback,
      priority: priorityText(l.priority),
      origin: l.origin,
    })),
    moreListeners: Math.max(0, all.length - MAX_LISTENERS),
  };
}

/** One entry per documented pattern, so the many `option_*` stops share one description. */
function docTable(): { readonly docs: CatalogDoc[]; readonly add: (doc: CatalogDoc | null) => number | null } {
  const docs: CatalogDoc[] = [];
  const index = new Map<string, number>();
  const add = (doc: CatalogDoc | null): number | null => {
    if (doc === null) return null;
    const known = index.get(doc.pattern);
    if (known !== undefined) return known;
    index.set(doc.pattern, docs.length);
    docs.push(doc);
    return docs.length - 1;
  };
  return { docs, add };
}

/** Calls made in each stage, from the full call sequence. */
function callsPerStage(trace: LifecycleTrace, starts: ReturnType<typeof stageStarts>): Map<StageId, number> {
  const calls = new Map<StageId, number>();
  trace.sequence.forEach((_, i) => {
    const id = stageAt(starts, i).id;
    calls.set(id, (calls.get(id) ?? 0) + 1);
  });
  return calls;
}

export function buildLifecycle({ trace, lookup, wp, layout = DEFAULT_LAYOUT }: LifecycleInput): LifecycleMap {
  const starts = stageStarts(trace.hooks);
  const ordered = [...trace.hooks].sort((a, b) => a.firstIndex - b.firstIndex);
  const staged = ordered.map((h) => ({ hook: h, stage: stageAt(starts, h.firstIndex) }));
  const groups = starts.map((s) => staged.filter((h) => h.stage.id === s.stage.id).length);
  const placed = snakeLayout(groups, layout);
  const calls = callsPerStage(trace, starts);
  const table = docTable();

  const stops: LifecycleStop[] = staged.map(({ hook, stage }, i) => {
    const [x, z] = placed.positions[i] ?? [0, 0];
    return {
      name: hook.name,
      type: hook.type,
      file: hook.file,
      line: hook.line,
      count: hook.count,
      firstCall: hook.firstIndex,
      stage: stage.id,
      x,
      z,
      doc: table.add(lookup(hook.name, hook.type, hook.file)),
      ...stopListeners(trace.listeners[hook.name]),
    };
  });

  let first = 0;
  const stages: LifecycleStage[] = starts.flatMap(({ stage }, group) => {
    const count = groups[group] ?? 0;
    const rows = placed.rows.filter((r) => r.group === group);
    const start = first;
    first += count;
    const row = rows[0];
    if (count === 0 || !row) return [];
    const lastRow = rows[rows.length - 1] ?? row;
    return [
      {
        id: stage.id,
        title: stage.title,
        where: stage.where,
        what: stage.what,
        mood: stage.mood,
        first: start,
        count,
        actions: stops.slice(start, start + count).filter((s) => s.type === "action").length,
        calls: calls.get(stage.id) ?? 0,
        /* in the gap before the stage, nearer its own first row */
        label: [row.dir === 1 ? 0 : layout.rowWidth, row.z - (layout.rowGap + layout.stageGap) * 0.45] as const,
        zRange: [row.z, lastRow.z] as const,
      },
    ];
  });

  return {
    wp,
    scenario: trace.scenario,
    request: trace.request,
    status: trace.status,
    theme: trace.theme,
    totalCalls: trace.sequence.length,
    stops,
    docs: table.docs,
    stages,
    path: placed.path,
    bounds: placed.bounds,
  };
}
