/**
 * A port of WordPress's hook API (wp-includes/plugin.php): add_filter(), apply_filters(),
 * do_action() and friends over their globals $wp_filter, $wp_actions, $wp_filters and
 * $wp_current_filter. Each Hooks instance is one request's worth of that state.
 *
 * It also reports every step as an event, which is what the Hook Lab and the story animate.
 */
import { createIdBuilder, displayName, idFormatFor, invoke, type Callable, type CallableRef } from "./callable.ts";
import { PhpObject, type PhpValue } from "./php.ts";
import { WpHook, type HookView, type Runner } from "./wp-hook.ts";

export type HookKind = "action" | "filter";

interface CallInfo {
  readonly hook: string;
  readonly priority: number;
  readonly id: string;
  readonly name: string;
  readonly callable: Callable;
  readonly depth: number;
}

/** `depth` is 1 for a hook fired at the top level, 2 for one fired from inside its callback, and so on. */
export type HookEvent =
  | {
      readonly type: "fire";
      readonly hook: string;
      readonly kind: HookKind;
      readonly args: ReadonlyArray<PhpValue>;
      readonly depth: number;
      /** Whether anything was attached when it fired. */
      readonly registered: boolean;
    }
  | (CallInfo & { readonly type: "call"; readonly args: ReadonlyArray<PhpValue> })
  | (CallInfo & { readonly type: "return"; readonly result: PhpValue })
  | {
      readonly type: "done";
      readonly hook: string;
      readonly kind: HookKind;
      readonly value: PhpValue;
      readonly depth: number;
    };

export interface HooksOptions {
  /** The WordPress major.minor version to behave like. Defaults to the current behaviour. */
  readonly version?: string;
  readonly onEvent?: (event: HookEvent) => void;
}

const ALL = "all";

export class Hooks {
  /** $wp_filter */
  readonly #hooks = new Map<string, WpHook>();
  /** $wp_actions */
  readonly #actionCounts = new Map<string, number>();
  /** $wp_filters */
  readonly #filterCounts = new Map<string, number>();
  /** $wp_current_filter */
  readonly #stack: string[] = [];
  readonly #buildId: (ref: CallableRef) => string;
  readonly #onEvent: (event: HookEvent) => void;

  constructor({ version, onEvent }: HooksOptions = {}) {
    this.#buildId = createIdBuilder(idFormatFor(version));
    this.#onEvent = onEvent ?? (() => undefined);
  }

  addFilter(hook: string, callable: Callable, priority: number | null = 10, acceptedArgs = 1): true {
    let registered = this.#hooks.get(hook);
    if (!registered) {
      registered = new WpHook(this.#buildId);
      this.#hooks.set(hook, registered);
    }
    registered.addFilter(callable, priority, acceptedArgs);
    return true;
  }

  applyFilters(hook: string, value: PhpValue, ...args: PhpValue[]): PhpValue {
    return this.#fire(hook, "filter", [hook, value, ...args], [value, ...args], (target, run) =>
      target.applyFilters(value, [value, ...args], run),
    );
  }

  applyFiltersRefArray(hook: string, args: ReadonlyArray<PhpValue>): PhpValue {
    const value = args[0] ?? null;
    return this.#fire(
      hook,
      "filter",
      [hook, [...args]],
      args,
      (target, run) => target.applyFilters(value, args, run),
      value,
    );
  }

  doAction(hook: string, ...args: PhpValue[]): void {
    this.#fire(
      hook,
      "action",
      [hook, ...args],
      args,
      (target, run) => (target.doAction(padActionArgs(args), run), null),
    );
  }

  doActionRefArray(hook: string, args: ReadonlyArray<PhpValue>): void {
    this.#fire(hook, "action", [hook, [...args]], args, (target, run) => (target.doAction(args, run), null));
  }

  hasFilter(hook: string, callback: CallableRef | false = false, priority: number | false = false): boolean | number {
    return this.#hooks.get(hook)?.hasFilter(callback, priority) ?? false;
  }

  removeFilter(hook: string, callback: CallableRef, priority: number | null = 10): boolean {
    const target = this.#hooks.get(hook);
    if (!target) return false;
    const removed = target.removeFilter(callback, priority);
    if (!target.hasFilters()) this.#hooks.delete(hook);
    return removed;
  }

  removeAllFilters(hook: string, priority: number | false = false): true {
    const target = this.#hooks.get(hook);
    if (target) {
      target.removeAllFilters(priority);
      if (!target.hasFilters()) this.#hooks.delete(hook);
    }
    return true;
  }

  /** The hook running right now, or false. */
  currentFilter(): string | false {
    return this.#stack.at(-1) ?? false;
  }

  /** Whether any hook (or the named one) is running, at any depth. */
  doingFilter(hook: string | null = null): boolean {
    return hook === null ? this.#stack.length > 0 : this.#stack.includes(hook);
  }

  /** How many times a filter has been applied, attached callbacks or not. */
  didFilter(hook: string): number {
    return this.#filterCounts.get(hook) ?? 0;
  }

  /** How many times an action has fired, attached callbacks or not. */
  didAction(hook: string): number {
    return this.#actionCounts.get(hook) ?? 0;
  }

  /** A copy of $wp_current_filter: the running hooks, outermost first. */
  currentFilterStack(): ReadonlyArray<string> {
    return Object.freeze([...this.#stack]);
  }

  /** `$wp_filter[ $hook ]`, if anything is attached to it. Changes go through this registry. */
  hook(name: string): HookView | undefined {
    return this.#hooks.get(name);
  }

  // In WordPress the action functions are thin wrappers around the filter ones.
  addAction(hook: string, callable: Callable, priority: number | null = 10, acceptedArgs = 1): true {
    return this.addFilter(hook, callable, priority, acceptedArgs);
  }

  hasAction(hook: string, callback: CallableRef | false = false, priority: number | false = false): boolean | number {
    return this.hasFilter(hook, callback, priority);
  }

  removeAction(hook: string, callback: CallableRef, priority: number | null = 10): boolean {
    return this.removeFilter(hook, callback, priority);
  }

  removeAllActions(hook: string, priority: number | false = false): true {
    return this.removeAllFilters(hook, priority);
  }

  currentAction(): string | false {
    return this.currentFilter();
  }

  doingAction(hook: string | null = null): boolean {
    return this.doingFilter(hook);
  }

  /**
   * The shared body of apply_filters(), do_action() and their _ref_array twins: count the call,
   * run the `all` hook, then the hook's own callbacks, keeping $wp_current_filter in step exactly
   * as plugin.php does (including re-checking `all` after its callbacks ran).
   */
  #fire(
    hook: string,
    kind: HookKind,
    allArgs: ReadonlyArray<PhpValue>,
    eventArgs: ReadonlyArray<PhpValue>,
    run: (target: WpHook, runner: Runner) => PhpValue,
    unfiltered: PhpValue = eventArgs[0] ?? null,
  ): PhpValue {
    const counts = kind === "action" ? this.#actionCounts : this.#filterCounts;
    counts.set(hook, (counts.get(hook) ?? 0) + 1);
    const depth = this.#stack.length + 1;
    this.#onEvent({ type: "fire", hook, kind, args: eventArgs, depth, registered: this.#hooks.has(hook) });

    const all = this.#hooks.get(ALL);
    if (all) {
      this.#stack.push(hook);
      all.doAllHook(allArgs, this.#runner(ALL, depth));
    }
    const target = this.#hooks.get(hook);
    if (!target) {
      if (this.#hooks.has(ALL)) this.#stack.pop();
      const value = kind === "action" ? null : unfiltered;
      this.#onEvent({ type: "done", hook, kind, value, depth });
      return value;
    }
    if (!this.#hooks.has(ALL)) this.#stack.push(hook);
    const value = run(target, this.#runner(hook, depth));
    this.#stack.pop();
    this.#onEvent({ type: "done", hook, kind, value, depth });
    return value;
  }

  #runner(hook: string, depth: number): Runner {
    return (entry, args, priority) => {
      const info = { hook, priority, id: entry.id, name: displayName(entry.callable), callable: entry.callable, depth };
      this.#onEvent({ type: "call", ...info, args });
      const result = invoke(entry.callable, args);
      this.#onEvent({ type: "return", ...info, result });
      return result;
    };
  }
}

/**
 * do_action() passes '' when called without arguments, and unwraps `array( $object )` into the
 * object itself (a PHP 4 era convention). Only lists are unwrapped here; this engine writes PHP
 * arrays with a single object as lists.
 */
function padActionArgs(args: ReadonlyArray<PhpValue>): ReadonlyArray<PhpValue> {
  const [first, ...rest] = args;
  if (first === undefined) return [""];
  if (Array.isArray(first) && first.length === 1 && first[0] instanceof PhpObject) return [first[0], ...rest];
  return args;
}
