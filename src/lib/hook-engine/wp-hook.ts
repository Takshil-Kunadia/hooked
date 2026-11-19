/**
 * A line-for-line port of WordPress's WP_Hook (wp-includes/class-wp-hook.php), including its
 * quirks: tools/hook-engine/conformance.test.ts replays scenarios recorded from the real class.
 *
 * This deliberately mirrors PHP's mutable state (callbacks change while a hook is running, and
 * that is exactly what WP_Hook has to cope with). Callers only ever get frozen snapshots out.
 */
import type { Callable, CallableRef } from "./callable.ts";
import type { PhpValue } from "./php.ts";

export interface HookEntry {
  readonly id: string;
  readonly callable: Callable;
  readonly acceptedArgs: number;
}

export interface PriorityGroup {
  readonly priority: number;
  readonly entries: ReadonlyArray<HookEntry>;
}

/** Calls one callback. The registry wraps it to report events and check PHP arity. */
export type Runner = (entry: HookEntry, args: ReadonlyArray<PhpValue>, priority: number) => PhpValue;

/** A PHP array of priorities with its internal pointer, as WP_Hook walks it with current()/next(). */
class Cursor {
  #list: number[];
  #pos = 0;

  constructor(list: ReadonlyArray<number>) {
    this.#list = [...list];
  }

  get #valid(): boolean {
    return this.#pos >= 0 && this.#pos < this.#list.length;
  }

  current(): number | false {
    return this.#valid ? (this.#list[this.#pos] ?? false) : false;
  }

  next(): number | false {
    if (!this.#valid) return false;
    this.#pos += 1;
    return this.current();
  }

  prev(): number | false {
    if (!this.#valid) return false;
    this.#pos -= 1;
    return this.current();
  }

  reset(): void {
    this.#pos = 0;
  }

  end(): number | false {
    this.#pos = this.#list.length - 1;
    return this.current();
  }

  /** `$iteration = $new_priorities;` — a fresh copy, pointer at the start. */
  replace(list: ReadonlyArray<number>): void {
    this.#list = [...list];
    this.#pos = 0;
  }

  /** array_unshift(), which also resets the pointer. */
  unshift(value: number): void {
    this.#list.unshift(value);
    this.#pos = 0;
  }
}

/**
 * WordPress documents priorities as ints, and only ints behave the same everywhere: PHP compares
 * the raw value strictly in resort_active_iterations(), so '10' and 10.0 take a different path
 * from 10 there. Strings and floats are therefore refused rather than converted. null becomes 0,
 * as WP_Hook does explicitly.
 */
function toPriority(priority: number | null): number {
  if (priority === null) return 0;
  if (!Number.isInteger(priority)) throw new RangeError(`A hook priority must be an integer, got ${priority}`);
  return priority === 0 ? 0 : priority;
}

function toAcceptedArgs(acceptedArgs: number): number {
  if (!Number.isFinite(acceptedArgs))
    throw new RangeError(`accepted_args must be a finite number, got ${acceptedArgs}`);
  return Math.trunc(acceptedArgs);
}

/** What callers outside the registry may do with a hook: look, never change it behind the registry's back. */
export type HookView = Pick<WpHook, "hasFilter" | "hasFilters" | "currentPriority" | "callbacks">;

export class WpHook {
  readonly #buildId: (ref: CallableRef) => string;
  /** priority => (callback id => entry), kept in ascending priority order like ksort() leaves it. */
  #callbacks = new Map<number, Map<string, HookEntry>>();
  #priorities: number[] = [];
  /** Nesting level => the priorities that run is walking. */
  readonly #iterations = new Map<number, Cursor>();
  readonly #currentPriority = new Map<number, number | false>();
  #nestingLevel = 0;
  #doingAction = false;

  constructor(buildId: (ref: CallableRef) => string) {
    this.#buildId = buildId;
  }

  addFilter(callable: Callable, priority: number | null, acceptedArgs: number): void {
    const key = toPriority(priority);
    const entry: HookEntry = Object.freeze({
      id: this.#buildId(callable),
      callable,
      acceptedArgs: toAcceptedArgs(acceptedArgs),
    });
    const existing = this.#callbacks.get(key);
    const priorityExisted = existing !== undefined;
    if (existing) {
      existing.set(entry.id, entry);
    } else {
      this.#callbacks.set(key, new Map([[entry.id, entry]]));
      if (this.#callbacks.size > 1) this.#callbacks = new Map([...this.#callbacks].sort(([a], [b]) => a - b));
    }
    this.#priorities = [...this.#callbacks.keys()];
    if (this.#nestingLevel > 0) this.#resortActiveIterations(key, priorityExisted);
  }

  /** Keeps every running iteration pointing at the right priority after callbacks were added or removed. */
  #resortActiveIterations(newPriority: number | false = false, priorityExisted = false): void {
    const newPriorities = this.#priorities;
    if (newPriorities.length === 0) {
      for (const iteration of this.#iterations.values()) iteration.replace(newPriorities);
      return;
    }
    const min = newPriorities.reduce((lowest, priority) => (priority < lowest ? priority : lowest));
    for (const [level, iteration] of this.#iterations) {
      const current = iteration.current();
      if (current === false) continue;
      iteration.replace(newPriorities);
      if (current < min) {
        iteration.unshift(current);
        continue;
      }
      while (Number(iteration.current()) < current) {
        if (iteration.next() === false) break;
      }
      if (newPriority === this.#currentPriority.get(level) && !priorityExisted) {
        // The current priority was emptied and filled again: step back so it is not run twice.
        const prev = iteration.current() === false ? iteration.end() : iteration.prev();
        if (prev === false) iteration.reset();
        else if (newPriority !== prev) iteration.next();
      }
    }
  }

  removeFilter(ref: CallableRef, priority: number | null): boolean {
    const key = toPriority(priority);
    const id = this.#buildId(ref);
    const group = this.#callbacks.get(key);
    if (!group?.has(id)) return false;
    group.delete(id);
    if (group.size === 0) {
      this.#callbacks.delete(key);
      this.#priorities = [...this.#callbacks.keys()];
      if (this.#nestingLevel > 0) this.#resortActiveIterations();
    }
    return true;
  }

  /**
   * Without a callback: whether anything is attached. With one: its priority, or false. With a
   * callback and an integer priority: whether it is attached at exactly that priority.
   */
  hasFilter(ref: CallableRef | false = false, priority: number | false = false): boolean | number {
    if (ref === false) return this.hasFilters();
    const id = this.#buildId(ref);
    // PHP's `if ( ! $function_key )`: '' and '0' are falsy strings.
    if (id === "" || id === "0") return false;
    if (priority !== false && Number.isInteger(priority)) return this.#callbacks.get(priority)?.has(id) ?? false;
    for (const [key, group] of this.#callbacks) {
      if (group.has(id)) return key;
    }
    return false;
  }

  hasFilters(): boolean {
    return this.#callbacks.size > 0;
  }

  removeAllFilters(priority: number | false = false): void {
    if (this.#callbacks.size === 0) return;
    if (priority === false) {
      this.#callbacks = new Map();
      this.#priorities = [];
    } else if (this.#callbacks.delete(toPriority(priority))) {
      this.#priorities = [...this.#callbacks.keys()];
    }
    if (this.#nestingLevel > 0) this.#resortActiveIterations();
  }

  /** `$args` must already hold `$value` at index 0. */
  applyFilters(value: PhpValue, args: ReadonlyArray<PhpValue>, run: Runner): PhpValue {
    if (this.#callbacks.size === 0) return value;
    const level = this.#nestingLevel++;
    const iteration = new Cursor(this.#priorities);
    this.#iterations.set(level, iteration);
    const numArgs = args.length;
    const callArgs = [...args];
    let filtered = value;
    do {
      const priority = iteration.current();
      this.#currentPriority.set(level, priority);
      // PHP's foreach walks a copy: callbacks added or removed at this priority now do not change this pass.
      for (const entry of this.#group(priority)) {
        if (!this.#doingAction) callArgs[0] = filtered;
        const passed =
          entry.acceptedArgs === 0
            ? []
            : entry.acceptedArgs >= numArgs
              ? [...callArgs]
              : callArgs.slice(0, entry.acceptedArgs);
        filtered = run(entry, passed, Number(priority));
      }
    } while (iteration.next() !== false);
    this.#iterations.delete(level);
    this.#currentPriority.delete(level);
    this.#nestingLevel -= 1;
    return filtered;
  }

  doAction(args: ReadonlyArray<PhpValue>, run: Runner): void {
    this.#doingAction = true;
    this.applyFilters("", args, run);
    // Only the outermost run resets the flag, so a nested action leaves it on for an outer filter.
    if (this.#nestingLevel === 0) this.#doingAction = false;
  }

  /** The `all` hook: every callback gets every argument, whatever its accepted_args. */
  doAllHook(args: ReadonlyArray<PhpValue>, run: Runner): void {
    const level = this.#nestingLevel++;
    const iteration = new Cursor(this.#priorities);
    this.#iterations.set(level, iteration);
    do {
      const priority = iteration.current();
      for (const entry of this.#group(priority)) run(entry, args, Number(priority));
    } while (iteration.next() !== false);
    this.#iterations.delete(level);
    this.#nestingLevel -= 1;
  }

  /** Like WordPress, this reports the outermost run's priority, even from inside a nested run. */
  currentPriority(): number | false {
    return this.#iterations.get(0)?.current() ?? false;
  }

  /** A frozen snapshot of `$wp_filter[ $hook ]->callbacks`. */
  callbacks(): ReadonlyArray<PriorityGroup> {
    return Object.freeze(
      [...this.#callbacks].map(([priority, group]) =>
        Object.freeze({ priority, entries: Object.freeze([...group.values()]) }),
      ),
    );
  }

  #group(priority: number | false): HookEntry[] {
    return priority === false ? [] : [...(this.#callbacks.get(priority)?.values() ?? [])];
  }
}
