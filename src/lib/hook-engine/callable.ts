/**
 * PHP callables as the hook engine sees them: what they are (for ids and names) and what they do
 * (a JavaScript body standing in for the PHP function).
 */
import { PhpError, type PhpObject, type PhpValue } from "./php.ts";

/** What the callback does. Returning nothing is PHP's implicit `return null;`. */
export type CallbackBody = (...args: PhpValue[]) => PhpValue | undefined;

/** The PHP signature, when the arity matters (PHP 8 throws ArgumentCountError otherwise). */
export interface CallableOptions {
  /** Declared parameters. Omit for a function that takes whatever it is given. */
  readonly params?: number;
  /** Parameters without a default. Defaults to `params`. */
  readonly required?: number;
  /** A PHP built-in such as strtoupper(), which also refuses extra arguments. */
  readonly internal?: boolean;
}

interface CallableBase extends CallableOptions {
  readonly run: CallbackBody;
}

/** `'ucwords'` */
export interface FunctionCallable extends CallableBase {
  readonly kind: "function";
  readonly name: string;
}

/** `function () { … }`. Its identity is this object, as a PHP closure's is its instance. */
export interface ClosureCallable extends CallableBase {
  readonly kind: "closure";
}

/** `array( $object, 'method' )` */
export interface MethodCallable extends CallableBase {
  readonly kind: "method";
  readonly object: PhpObject;
  readonly method: string;
}

/** `array( 'Class', 'method' )` or `'Class::method'` */
export interface StaticCallable extends CallableBase {
  readonly kind: "static";
  readonly className: string;
  readonly method: string;
}

export type Callable = FunctionCallable | ClosureCallable | MethodCallable | StaticCallable;

/** What has_filter() and remove_filter() accept: a callable, or a function or 'Class::method' name. */
export type CallableRef = Callable | string;

export const fn = (name: string, run: CallbackBody, options: CallableOptions = {}): FunctionCallable =>
  Object.freeze({ ...options, kind: "function", name, run });

export const closure = (run: CallbackBody, options: CallableOptions = {}): ClosureCallable =>
  Object.freeze({ ...options, kind: "closure", run });

export const method = (
  object: PhpObject,
  name: string,
  run: CallbackBody,
  options: CallableOptions = {},
): MethodCallable => Object.freeze({ ...options, kind: "method", object, method: name, run });

export const staticMethod = (
  className: string,
  name: string,
  run: CallbackBody,
  options: CallableOptions = {},
): StaticCallable => Object.freeze({ ...options, kind: "static", className, method: name, run });

/** How _wp_filter_build_unique_id() turns an object into part of a callback id. */
export type IdFormat = "spl_object_id" | "spl_object_hash";

const MAJOR_MINOR = /^(\d+)\.(\d+)$/;

/** WordPress 7.1 switched object ids from spl_object_hash() to spl_object_id(). */
export function idFormatFor(version?: string): IdFormat {
  if (version === undefined) return "spl_object_id";
  const match = MAJOR_MINOR.exec(version);
  if (!match) throw new RangeError(`Expected a WordPress major.minor version such as "7.1", got "${version}"`);
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major > 7 || (major === 7 && minor >= 1) ? "spl_object_id" : "spl_object_hash";
}

/**
 * A port of _wp_filter_build_unique_id(). Object handles are numbered in the order the builder
 * first sees them, like PHP numbers objects in the order they are created.
 */
export function createIdBuilder(format: IdFormat): (ref: CallableRef) => string {
  const handles = new WeakMap<object, number>();
  let next = 1;
  const handle = (target: object): number => {
    const known = handles.get(target);
    if (known !== undefined) return known;
    handles.set(target, next);
    return next++;
  };
  const objectId = (target: object): string =>
    format === "spl_object_id"
      ? String(handle(target))
      : `${handle(target).toString(16).padStart(16, "0")}${"0".repeat(16)}`;

  return (ref) => {
    if (typeof ref === "string") return ref;
    switch (ref.kind) {
      case "function":
        return ref.name;
      case "static":
        return `${ref.className}::${ref.method}`;
      case "closure":
        return format === "spl_object_id" ? `spl_object_id:${handle(ref)}` : objectId(ref);
      case "method":
        return `${objectId(ref.object)}${ref.method}`;
    }
  };
}

/** The name used in traces and on screen: `wptexturize`, `{closure}`, `WP_Embed->autoembed`, `Class::method`. */
export function displayName(callable: Callable): string {
  switch (callable.kind) {
    case "function":
      return callable.name;
    case "closure":
      return "{closure}";
    case "method":
      return `${callable.object.className}->${callable.method}`;
    case "static":
      return `${callable.className}::${callable.method}`;
  }
}

/** The name PHP uses in error messages, where every method is written Class::method. */
const errorName = (callable: Callable): string =>
  callable.kind === "method" ? `${callable.object.className}::${callable.method}` : displayName(callable);

const argumentCount = (count: number): string => `${count} argument${count === 1 ? "" : "s"}`;

function checkArity(callable: Callable, given: number): void {
  const max = callable.params ?? Number.POSITIVE_INFINITY;
  const min = callable.required ?? callable.params ?? 0;
  const name = errorName(callable);
  if (callable.internal && (given < min || given > max)) {
    const [bound, count] = min === max ? ["exactly", max] : given < min ? ["at least", min] : ["at most", max];
    throw new PhpError("ArgumentCountError", `${name}() expects ${bound} ${argumentCount(count)}, ${given} given`);
  }
  if (given < min) {
    const bound = min === max ? "exactly" : "at least";
    throw new PhpError(
      "ArgumentCountError",
      `Too few arguments to function ${name}(), ${given} passed and ${bound} ${min} expected`,
    );
  }
}

/** Calls the callback the way call_user_func_array() would. */
export function invoke(callable: Callable, args: ReadonlyArray<PhpValue>): PhpValue {
  checkArity(callable, args.length);
  return callable.run(...args) ?? null;
}
