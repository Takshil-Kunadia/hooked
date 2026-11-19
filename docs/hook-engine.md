# Hook engine

`src/lib/hook-engine/` is a TypeScript port of WordPress's hook system: `WP_Hook` (`wp-includes/class-wp-hook.php`) and the hook functions in `wp-includes/plugin.php`. The Hook Lab and the story run real filters and actions on it, in the browser, and animate every step.

"Port" here means _behaves exactly like WordPress, quirks included_. That claim is tested against WordPress itself, not against our reading of it.

```ts
import { fn } from "@/lib/hook-engine/callable";
import { Hooks } from "@/lib/hook-engine/hooks";

const hooks = new Hooks({ version: "7.1", onEvent: (event) => draw(event) });
hooks.addFilter(
  "the_title",
  fn("ucwords", (title) => ucwords(String(title)), { params: 2, required: 1, internal: true }),
  20,
);
hooks.applyFilters("the_title", "hello world", 42); // runs every callback, reports each step
```

## What is in it

| File          | Mirrors                                       | Notes                                                                                                                                                                                          |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wp-hook.ts`  | `WP_Hook`                                     | Priority buckets, PHP's array pointer while a hook runs, `resort_active_iterations()`, the `all` hook                                                                                          |
| `hooks.ts`    | `plugin.php`                                  | `add_filter()`, `apply_filters()`, `do_action()`, their `_ref_array` twins, `has_`/`remove_`/`remove_all_`, `current_`/`doing_`/`did_`, and an event stream (`fire`, `call`, `return`, `done`) |
| `callable.ts` | PHP callables, `_wp_filter_build_unique_id()` | Functions, closures, `array( $object, 'method' )`, `'Class::method'`; callback ids per WordPress version; PHP 8's `ArgumentCountError` when a callback gets the wrong number of arguments      |
| `php.ts`      | PHP values                                    | `(string)` casts, the `.` operator, `PHP_INT_MAX`/`PHP_INT_MIN` stand-ins, fatal errors                                                                                                        |

Behaviour that differs between WordPress versions is keyed by `version` (major.minor, matching `content/versions/`). The only difference modelled today is how callback ids are built: `spl_object_hash()` up to 7.0, and `spl_object_id()` (with the `spl_object_id:` prefix 7.1.1 added for closures) from 7.1. Ids never appear in the conformance logs, so this part is covered by unit tests only. Two other differences between 7.0 and 7.1 can't occur here: 7.1 ignores an invalid callback, which the engine's types make impossible to pass, and 7.1.0 used unprefixed closure ids, a patch release the major.minor key can't name.

Each `Hooks` instance is one request's worth of state. The Lab starts a fresh one for every run. As in PHP, a fatal error thrown by a callback leaves that instance mid-run, so it should not be reused.

### Limits

- **Priorities must be integers**, as WordPress documents them. PHP compares the raw priority strictly in `resort_active_iterations()`, so `'10'` or `10.0` can take a different path from `10` there. The engine refuses non-integers instead of guessing. `accepted_args` is truncated like PHP's `(int)` cast.
- **Numbers:** a whole number in JavaScript's safe range is treated as a PHP int, any other number as a float. Float-to-string follows PHP's `precision=14` rules; it was checked against PHP 8.4 on about 40,000 random doubles.
- **PHP objects** have identity and a class name, nothing more. The `{closure}` name in error messages is simplified: PHP 8.4 writes `{closure:file:line}`.
- **Object ids** are numbered in the order the engine first sees each object. PHP numbers them in creation order and reuses an id once its object is freed.

## How it is proven: conformance with real WordPress

```bash
pnpm hook-conformance   # needs PHP 8.1+ and network access; CI needs neither
```

1. `tools/hook-engine/scenarios.json` describes about 40 situations as small step lists. Many are taken from core's own unit tests (`tests/phpunit/tests/hooks/*`, `actions.php`, `filters.php`). Others are edge cases: callbacks that remove or re-add themselves mid-run, recursion, nested hooks, the `all` hook.
2. `tools/hook-engine/generate.ts` downloads `plugin.php` and the files it requires at the exact release of every version in `content/versions/`. The download comes from the WordPress/WordPress mirror, and each file is checked against the official checksums from `api.wordpress.org`. It then runs `conformance-runner.php` on them with the local `php`.
3. The runner records everything that happens, step by step, into `tools/hook-engine/expected/<x.y>.json`: each call and its arguments, return values, `has_filter()` answers, the `$wp_current_filter` stack and the registered callbacks. Each recording also states where it came from: the WordPress release, the full PHP version, the official md5 of every WordPress file used, and a fingerprint of `scenarios.json`.
4. `tools/hook-engine/conformance.test.ts` replays the same scenarios on the TypeScript engine and compares the logs. Any difference fails CI, and so does a recording whose fingerprint doesn't match the current scenarios.

### What it doesn't cover

- **PHP warnings.** The runner turns every warning into a hard stop, so a scenario can't depend on one by accident. Real WordPress does warn in a few reachable cases, for example an `all` callback that adds another `all` callback (`Undefined array key 0`). It then carries on exactly as the engine does, but those cases aren't recorded.
- **`ArgumentCountError` messages.** Every runner callback accepts any arguments, so arity errors are never recorded. The engine's messages were checked by hand against PHP 8.4. They leave out PHP's "in file on line" part.
- **Inputs outside the types:** string or float priorities, invalid callbacks, and `{}` in a scenario (PHP reads it as an empty array; the replay refuses it).

A new WordPress version gets checked by running `pnpm hook-conformance` after `pnpm wp-data <x.y>`. If its hook code changed, the diff in `expected/` shows exactly which behaviour moved.

### Scenario steps

A scenario declares named callbacks (`"kind"`: `function` (default), `closure`, `method` with `"object"`/`"method"`, or `static` with an optional `"form": "string"`) and a list of steps. Every callback logs `["call", name, args]` when it runs, then runs its `body`. Inside a body, the working value starts as the callback's first argument and is returned at the end.

| Step                                                 | Does                                                                        | Logs                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `["add", hook, cb, priority?, args?]`                | `add_filter()` (priority may be `"PHP_INT_MAX"`, `"PHP_INT_MIN"` or `null`) |                                                                   |
| `["remove", hook, cb, priority?]`                    | `remove_filter()`                                                           | `["remove", hook, cb, result]`                                    |
| `["remove-all", hook, priority?]`                    | `remove_all_filters()`                                                      |                                                                   |
| `["apply", hook, value, ...args]`                    | `apply_filters()`                                                           | `["applied", hook, result]`                                       |
| `["apply-ref", hook, [args]]`                        | `apply_filters_ref_array()`                                                 | `["applied", hook, result]`                                       |
| `["do", hook, ...args]`                              | `do_action()`                                                               | `["do", hook]` first                                              |
| `["do-ref", hook, [args]]`                           | `do_action_ref_array()`                                                     | `["do", hook]` first                                              |
| `["has", hook, cb or null, priority?]`               | `has_filter()`                                                              | `["has", hook, cb, result]`                                       |
| `["did", hook]`                                      |                                                                             | `["did", hook, did_action(), did_filter()]`                       |
| `["state"]`                                          |                                                                             | `["state", current_filter(), doing_filter(), $wp_current_filter]` |
| `["doing", hook]`                                    |                                                                             | `["doing", hook, doing_filter( hook )]`                           |
| `["priority", hook]`                                 |                                                                             | `["priority", hook, current_priority()]`                          |
| `["dump", hook]`                                     |                                                                             | `["dump", hook, [[priority, [[cb, accepted_args]]]]]`             |
| `["append", text]` (body only)                       | `$value .= text`                                                            |                                                                   |
| `["append-apply", hook, value, ...args]` (body only) | `$value .= apply_filters( … )`                                              | `["applied", hook, result]`                                       |
| `["set", value]`, `["set-arg", n]` (body only)       | `$value = value`, `$value = $args[n]`                                       |                                                                   |
| `["once", step]` (body only)                         | runs the step only when this callback is not already running                |                                                                   |

A static callback can be passed to `has`/`remove` as `["cb", "string"]` or `["cb", "array"]` to pick its form. Objects in arguments are written `{"object": "label"}`.

## WordPress quirks the engine reproduces

Each of these is recorded from real WordPress 7.0.9 and 7.1.5. The scenario names are in parentheses.

- **A callback that removes itself can make WordPress skip the next priority.** This happens when it was the only callback at its priority and a lower priority exists. Run 1 of `5, 10 (removes itself), 20, 30` runs 5, 10 and 30 (`self-removal-skips-the-next-priority`). Re-adding a priority in between can skip even more (`self-readd-after-adding-a-priority-in-between`). This is reported in Trac as [#40393](https://core.trac.wordpress.org/ticket/40393), [#40906](https://core.trac.wordpress.org/ticket/40906) and [#60502](https://core.trac.wordpress.org/ticket/60502).
- **Callbacks added or removed at the running priority don't affect the current pass.** PHP's `foreach` walks a copy, so a removed neighbour still runs, and an added one waits for the next run (`callback-manipulation-while-running`).
- **`do_action()` with no arguments passes `''`; `do_action_ref_array()` passes nothing** (`do-action-without-args-passes-an-empty-string`). And `do_action( 'x', array( $object ) )` hands callbacks the object itself, not the array (`do-action-unwraps-a-single-object-in-an-array`).
- **A `do_action()` nested inside a filter on the same hook switches that hook's value passing off.** The rest of the filter chain stops seeing earlier callbacks' results. It stays off until the hook is next fired as an action at the top level (`action-nested-in-a-filter-on-the-same-hook`).
- **`WP_Hook::current_priority()` reports the outermost run's priority, even from inside a nested run** (`current-priority`).
- **If a callback on the `all` hook removes itself, the hook's name is pushed onto `$wp_current_filter` twice.** One copy stays there, so `current_filter()` keeps returning it after the hook has finished (`all-hook-callback-removes-itself`).
- **`accepted_args` of `-1` drops the last argument**, as PHP's `array_slice()` does (`accepted-args`).
