/**
 * Conformance: the TypeScript hook engine must behave exactly like real WordPress.
 *
 * tools/hook-engine/generate.ts ran every scenario in scenarios.json against WordPress's own
 * plugin.php and class-wp-hook.php (checksum-verified) and recorded what happened in
 * expected/<x.y>.json. This test replays the same scenarios on the TypeScript engine, step by
 * step, and compares the two logs. It mirrors conformance-runner.php; keep the two in step.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  closure,
  fn,
  method,
  staticMethod,
  type Callable,
  type CallableRef,
} from "../../src/lib/hook-engine/callable.ts";
import { Hooks } from "../../src/lib/hook-engine/hooks.ts";
import { concat, PHP_INT_MAX, PHP_INT_MIN, PhpObject, type PhpValue } from "../../src/lib/hook-engine/php.ts";
import { scenariosDigest } from "./expected.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const STATIC_CLASS = "HookedStatic";

type Step = ReadonlyArray<unknown>;
const stepSchema: z.ZodType<Step> = z.array(z.unknown()).min(1);
const callbackSchema = z.strictObject({
  kind: z.enum(["function", "closure", "method", "static"]).optional(),
  object: z.string().optional(),
  method: z.string().optional(),
  form: z.enum(["string", "array"]).optional(),
  body: z.array(stepSchema).optional(),
});
type CallbackSpec = z.infer<typeof callbackSchema>;
const scenarioSchema = z.strictObject({
  id: z.string(),
  source: z.string(),
  callbacks: z.record(z.string(), callbackSchema),
  steps: z.array(stepSchema),
});
type Scenario = z.infer<typeof scenarioSchema>;
const recordingSchema = z.strictObject({
  wp: z.string(),
  php: z.string(),
  scenariosSha256: z.string().regex(/^[0-9a-f]{64}$/),
  files: z.record(z.string(), z.string().regex(/^[0-9a-f]{32}$/)),
  scenarios: z.record(z.string(), z.array(z.unknown())),
});

const scenariosText = readFileSync(path.join(HERE, "scenarios.json"), "utf8");
const scenarios = z.object({ scenarios: z.array(scenarioSchema) }).parse(JSON.parse(scenariosText)).scenarios;

const recordings = readdirSync(path.join(HERE, "expected"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({
    version: file.replace(/\.json$/, ""),
    ...recordingSchema.parse(JSON.parse(readFileSync(path.join(HERE, "expected", file), "utf8"))),
  }));

const str = (step: Step, i: number): string => z.string().parse(step[i]);
const has = (step: Step, i: number): boolean => i < step.length;
const int = (value: unknown): number => z.number().int().parse(value);

function priorityIn(value: unknown): number | null {
  if (value === "PHP_INT_MAX") return PHP_INT_MAX;
  if (value === "PHP_INT_MIN") return PHP_INT_MIN;
  return z.number().int().nullable().parse(value);
}

function priorityOut(value: unknown): unknown {
  if (value === PHP_INT_MAX) return "PHP_INT_MAX";
  if (value === PHP_INT_MIN) return "PHP_INT_MIN";
  return value;
}

interface Context {
  readonly step: Step;
  readonly hook: string;
  /** Inside a callback: its working value, replaced by what the handler returns. */
  readonly value: PhpValue;
  readonly args: ReadonlyArray<PhpValue>;
  readonly label?: string;
}

type Handler = (replay: Replay, context: Context) => PhpValue;

/** One handler per step, mirroring Hooked_Conformance::exec() in conformance-runner.php. */
const STEPS: Readonly<Record<string, Handler>> = {
  add: (r, { step, hook, value }) => {
    // PHP may add a static callback in its string form; here the callable carries the body. Same id.
    const priority = has(step, 3) ? priorityIn(step[3]) : 10;
    r.hooks.addFilter(hook, r.callableFor(str(step, 2)), priority, has(step, 4) ? int(step[4]) : 1);
    return value;
  },
  remove: (r, { step, hook, value }) => {
    const removed = r.hooks.removeFilter(hook, r.ref(step[2]), has(step, 3) ? priorityIn(step[3]) : 10);
    r.log.push(["remove", hook, step[2], removed]);
    return value;
  },
  "remove-all": (r, { step, hook, value }) => {
    r.hooks.removeAllFilters(hook, has(step, 2) ? int(step[2]) : false);
    return value;
  },
  apply: (r, context) => {
    r.apply(context);
    return context.value;
  },
  "append-apply": (r, context) => concat(context.value, r.apply(context)),
  "apply-ref": (r, { step, hook, value }) => {
    const result = r.hooks.applyFiltersRefArray(hook, r.list(step[2]));
    r.log.push(["applied", hook, r.exportValue(result)]);
    return value;
  },
  do: (r, { step, hook, value }) => {
    r.log.push(["do", hook]);
    r.hooks.doAction(hook, ...step.slice(2).map((v) => r.hydrate(v)));
    return value;
  },
  "do-ref": (r, { step, hook, value }) => {
    r.log.push(["do", hook]);
    r.hooks.doActionRefArray(hook, r.list(step[2]));
    return value;
  },
  has: (r, { step, hook, value }) => {
    const result =
      step[2] === null
        ? r.hooks.hasFilter(hook)
        : has(step, 3)
          ? r.hooks.hasFilter(hook, r.ref(step[2]), int(step[3]))
          : r.hooks.hasFilter(hook, r.ref(step[2]));
    r.log.push(["has", hook, step[2], priorityOut(result)]);
    return value;
  },
  did: (r, { hook, value }) => {
    r.log.push(["did", hook, r.hooks.didAction(hook), r.hooks.didFilter(hook)]);
    return value;
  },
  state: (r, { value }) => {
    r.log.push(["state", r.hooks.currentFilter(), r.hooks.doingFilter(), [...r.hooks.currentFilterStack()]]);
    return value;
  },
  doing: (r, { hook, value }) => {
    r.log.push(["doing", hook, r.hooks.doingFilter(hook)]);
    return value;
  },
  priority: (r, { hook, value }) => {
    const registered = r.hooks.hook(hook);
    r.log.push(["priority", hook, registered ? priorityOut(registered.currentPriority()) : null]);
    return value;
  },
  dump: (r, { hook, value }) => {
    r.log.push(["dump", hook, r.dump(hook)]);
    return value;
  },
  append: (r, { step, value }) => concat(value, r.hydrate(step[1])),
  set: (r, { step }) => r.hydrate(step[1]),
  "set-arg": (_r, { step, args }) => args[int(step[1])] ?? null,
  once: (r, { step, value, args, label }) =>
    label !== undefined && r.depthOf(label) === 1 ? r.exec(stepSchema.parse(step[1]), value, args, label) : value,
};

/** Replays one scenario on the TypeScript engine, producing the log the PHP runner writes. */
class Replay {
  readonly log: unknown[] = [];
  readonly hooks: Hooks;
  readonly #scenario: Scenario;
  readonly #objects = new Map<string, PhpObject>();
  readonly #objectLabels = new Map<PhpObject, string>();
  readonly #callables = new Map<string, Callable>();
  readonly #callableLabels = new Map<Callable, string>();
  readonly #depth = new Map<string, number>();

  constructor(scenario: Scenario, version: string) {
    this.#scenario = scenario;
    this.hooks = new Hooks({ version });
    for (const [label, spec] of Object.entries(scenario.callbacks)) {
      const callable = this.#make(label, spec);
      this.#callables.set(label, callable);
      this.#callableLabels.set(callable, label);
    }
  }

  run(): unknown[] {
    for (const step of this.#scenario.steps) this.exec(step, null, []);
    return this.log;
  }

  exec(step: Step, value: PhpValue, args: ReadonlyArray<PhpValue>, label?: string): PhpValue {
    const op = str(step, 0);
    const handler = STEPS[op];
    if (!handler) throw new Error(`${this.#scenario.id}: unknown step "${op}"`);
    return handler(this, { step, hook: typeof step[1] === "string" ? step[1] : "", value, args, label });
  }

  apply({ step, hook }: Context): PhpValue {
    const result = this.hooks.applyFilters(hook, this.hydrate(step[2]), ...step.slice(3).map((v) => this.hydrate(v)));
    this.log.push(["applied", hook, this.exportValue(result)]);
    return result;
  }

  depthOf(label: string): number {
    return this.#depth.get(label) ?? 0;
  }

  object(label: string): PhpObject {
    const existing = this.#objects.get(label);
    if (existing) return existing;
    const created = new PhpObject("Hooked_Target");
    this.#objects.set(label, created);
    this.#objectLabels.set(created, label);
    return created;
  }

  /** JSON from the scenario as PHP values; {"object": "label"} is that scenario's object. */
  hydrate(value: unknown): PhpValue {
    if (Array.isArray(value)) return value.map((v) => this.hydrate(v));
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      // PHP decodes {} as an empty array, which this side would keep as an object; refuse it.
      if (Object.keys(record).length === 0) throw new Error(`${this.#scenario.id}: {} is ambiguous in a scenario`);
      if (Object.keys(record).length === 1 && typeof record.object === "string") return this.object(record.object);
      return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, this.hydrate(v)]));
    }
    return z.union([z.string(), z.number(), z.boolean(), z.null()]).parse(value);
  }

  list(value: unknown): PhpValue[] {
    return z
      .array(z.unknown())
      .parse(value)
      .map((v) => this.hydrate(v));
  }

  exportValue(value: PhpValue): unknown {
    if (value instanceof PhpObject) return { object: this.#objectLabels.get(value) };
    if (Array.isArray(value)) return value.map((v: PhpValue) => this.exportValue(v));
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.exportValue(v)]));
    }
    return value;
  }

  callableFor(label: string): Callable {
    const callable = this.#callables.get(label);
    if (!callable) throw new Error(`${this.#scenario.id}: callback "${label}" was never declared`);
    return callable;
  }

  /** What has/remove hand over: the callable, or a static callback's 'Class::method' string. */
  ref(raw: unknown): CallableRef {
    const [label, form] = Array.isArray(raw) ? [str(raw, 0), raw[1]] : [z.string().parse(raw), undefined];
    const { kind, form: declared } = this.#spec(label);
    return kind === "static" && (form ?? declared) === "string" ? `${STATIC_CLASS}::${label}` : this.callableFor(label);
  }

  dump(hook: string): unknown {
    const registered = this.hooks.hook(hook);
    if (!registered) return null;
    return registered
      .callbacks()
      .map(({ priority, entries }) => [
        priorityOut(priority),
        entries.map((entry) => [this.#callableLabels.get(entry.callable), entry.acceptedArgs]),
      ]);
  }

  #spec(label: string): CallbackSpec {
    const found = this.#scenario.callbacks[label];
    if (!found) throw new Error(`${this.#scenario.id}: no callback "${label}"`);
    return found;
  }

  #make(label: string, { kind, object: target, method: name }: CallbackSpec): Callable {
    const body = this.#body(label);
    switch (kind ?? "function") {
      case "closure":
        return closure(body);
      case "method":
        return method(this.object(z.string().parse(target)), name ?? label, body);
      case "static":
        return staticMethod(STATIC_CLASS, label, body);
      default:
        return fn(label, body);
    }
  }

  /** Every callback logs its call, then runs its body steps on a working value that starts as its first argument. */
  #body(label: string) {
    return (...args: PhpValue[]): PhpValue => {
      this.log.push(["call", label, this.exportValue(args)]);
      this.#depth.set(label, this.depthOf(label) + 1);
      let value: PhpValue = args[0] ?? null;
      for (const step of this.#spec(label).body ?? []) value = this.exec(step, value, args, label);
      this.#depth.set(label, this.depthOf(label) - 1);
      return value;
    };
  }
}

describe("hook engine conformance with real WordPress", () => {
  it("has a recording for at least one WordPress version", () => {
    expect(recordings.length).toBeGreaterThan(0);
  });

  for (const recording of recordings) {
    describe(`WordPress ${recording.wp}`, () => {
      it("was recorded from the current scenarios (run pnpm hook-conformance after editing them)", () => {
        expect(recording.scenariosSha256).toBe(scenariosDigest(scenariosText));
        expect(Object.keys(recording.scenarios)).toEqual(scenarios.map((s) => s.id));
      });

      it("ran on WordPress's own hook files", () => {
        expect(Object.keys(recording.files)).toEqual(
          expect.arrayContaining(["wp-includes/plugin.php", "wp-includes/class-wp-hook.php"]),
        );
      });

      for (const scenario of scenarios) {
        it(`${scenario.id} (${scenario.source})`, () => {
          expect(new Replay(scenario, recording.version).run()).toEqual(recording.scenarios[scenario.id]);
        });
      }
    });
  }
});
