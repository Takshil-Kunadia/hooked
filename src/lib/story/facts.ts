/**
 * Chapter 1's facts, picked from the generated WordPress data so the copy never hardcodes them.
 * Pure: safe to import from client code (the file reading lives in data.ts).
 */
import type { Origin } from "@/lib/metro/route";
import { isDemoName } from "@/lib/wp-data/scenarios";
import type { TraceFile } from "@/lib/wp-data/schema";
import { firstFiredOrder, type Listener, type Priority } from "@/lib/wp-data/trace";

export interface Ticket {
  readonly callback: string;
  readonly priority: Priority;
  readonly origin: Origin;
  readonly demo: boolean;
  readonly file: string | null;
}

export interface Tickets {
  readonly shown: Ticket[];
  readonly hidden: number;
  readonly all: Ticket[];
}

const ORIGINS: ReadonlyArray<Origin> = ["core", "plugin", "theme", "mu", "dropin"];
const isOrigin = (value: string): value is Origin => (ORIGINS as ReadonlyArray<string>).includes(value);

function toTicket(listener: Listener): Ticket | null {
  if (!isOrigin(listener.origin)) return null;
  return {
    callback: listener.callback,
    priority: listener.priority,
    origin: listener.origin,
    demo: isDemoName(listener.callback),
    file: listener.file,
  };
}

/**
 * Turns a hook's listeners (already in run order) into tickets: every non-core listener, plus the
 * core ones that run first until `max` is reached. Run order is kept.
 */
export function initTickets(listeners: ReadonlyArray<Listener>, max = 8): Tickets {
  const all = listeners.flatMap((l) => toTicket(l) ?? []);
  const nonCore = all.filter((t) => t.origin !== "core").length;
  let coreSlots = Math.max(0, max - nonCore);
  const shown = all.filter((t) => {
    if (t.origin !== "core") return true;
    if (coreSlots === 0) return false;
    coreSlots -= 1;
    return true;
  });
  return { shown, hidden: all.length - shown.length, all };
}

/** The given hook names ordered by when they first fired. */
export function firedOrder(trace: TraceFile, names: ReadonlyArray<string>): string[] {
  return firstFiredOrder(trace, names);
}

/**
 * How many distinct action hooks fire from the start of the request up to and including
 * `after_setup_theme`: the boot announcements the board picks four of.
 */
export function bootActionsFired(trace: TraceFile): number {
  const boundary = trace.hooks.find((h) => h.name === "after_setup_theme");
  if (!boundary) throw new Error('The trace has no "after_setup_theme" hook to count the boot actions up to');
  return trace.hooks.filter((h) => h.type === "action" && h.firstIndex <= boundary.firstIndex).length;
}

export interface HookSource {
  readonly type: "action" | "filter";
  readonly file: string;
  readonly line: number;
}

/** Where WordPress fires a hook, or undefined when the trace has no usable call site for it. */
export function hookSource(trace: TraceFile, name: string): HookSource | undefined {
  const hook = trace.hooks.find((h) => h.name === name);
  if (!hook || hook.file === null || hook.line === null) return undefined;
  return { type: hook.type, file: hook.file, line: hook.line };
}

export function sourceUrl(wpRelease: string, file: string, line?: number): string {
  const base = `https://github.com/WordPress/WordPress/blob/${wpRelease}/${file}`;
  return line === undefined ? base : `${base}#L${line}`;
}

export function docsUrl(kind: "hooks" | "functions", name: string): string {
  return `https://developer.wordpress.org/reference/${kind}/${name.toLowerCase()}/`;
}

export interface StoryData {
  readonly version: string;
  readonly wp: string;
  readonly request: { readonly method: string; readonly path: string };
  readonly status: number;
  readonly tickets: Tickets;
  readonly bootAnnouncements: string[];
  /** All the actions fired up to after_setup_theme, of which bootAnnouncements are a selection. */
  readonly bootActionsFired: number;
  /** Where core fires each hook "Under the hood" lists, in the order the hooks first fired. */
  readonly sources: Readonly<Record<string, { file: string; line: number; url: string }>>;
}
