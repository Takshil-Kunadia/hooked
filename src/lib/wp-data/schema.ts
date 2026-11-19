/**
 * Schemas for everything the data pipeline reads or writes. External input (the npm catalog, the
 * tracer's dumps) is validated before use; committed files are validated again when read.
 */
import { z } from "zod";

export const VERSION = /^\d+\.\d+$/;
export const SCENARIO_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

const hookType = z.enum(["action", "filter"]);
const file = z.string().min(1).nullable();

const prioritySchema = z.union([z.number(), z.literal("PHP_INT_MAX"), z.literal("PHP_INT_MIN")]);

/** [callback, priority, accepted args, file the callback is defined in]. */
const rawListenerSchema = z.tuple([z.string().min(1), prioritySchema, z.number().int(), file]);

/** [hook, type, call-site file, line]. */
const rawEventSchema = z.tuple([z.string().min(1), hookType, file, z.number().int().positive().nullable()]);

/* ---------- external input ---------- */

/** One entry of @wp-hooks/wordpress-core's hooks/actions.json or hooks/filters.json. */
const rawCatalogHookSchema = z.object({
  name: z.string().min(1),
  file: z.string().min(1),
  type: z.enum(["action", "filter", "action_reference", "filter_reference", "action_deprecated", "filter_deprecated"]),
  doc: z.object({
    description: z.string(),
    long_description: z.string(),
    tags: z.array(
      z.object({
        name: z.string(),
        content: z.string().optional(),
        types: z.array(z.string()).optional(),
        variable: z.string().optional(),
      }),
    ),
  }),
  args: z.number().int().nonnegative(),
});

export const rawCatalogFileSchema = z.object({ hooks: z.array(rawCatalogHookSchema) });

/** What tools/wp-data/tracer/hooked-tracer.php writes for one request. */
export const tracerDumpSchema = z.object({
  scenario: z.string().regex(SCENARIO_ID),
  wp: z.string().regex(/^\d+\.\d+(\.\d+)?(-[\w.-]+)?$/),
  php: z.string().min(1),
  theme: z.string().nullable(),
  events: z.array(rawEventSchema).min(1),
  listeners: z.record(z.string(), z.array(rawListenerSchema)),
});
export type TracerDump = z.infer<typeof tracerDumpSchema>;

/* ---------- committed files (content/versions) ---------- */

const catalogHookSchema = z.object({
  name: z.string().min(1),
  type: hookType,
  file: z.string().min(1),
  since: z.string().optional(),
  description: z.string(),
  params: z.array(z.object({ name: z.string(), types: z.array(z.string()), description: z.string() })),
  args: z.number().int().nonnegative(),
  dynamic: z.boolean(),
  deprecated: z.boolean(),
});

export const catalogFileSchema = z.object({
  package: z.string().min(1),
  version: z.string().min(1),
  hooks: z.array(catalogHookSchema),
});
export type CatalogFile = z.infer<typeof catalogFileSchema>;

export const traceFileSchema = z
  .object({
    scenario: z.string().regex(SCENARIO_ID),
    request: z.object({ method: z.enum(["GET", "POST"]), path: z.string().startsWith("/") }),
    status: z.number().int().min(100).max(599),
    theme: z.string().nullable(),
    hooks: z.array(
      z.object({
        name: z.string().min(1),
        type: hookType,
        file,
        line: z.number().int().positive().nullable(),
        count: z.number().int().positive(),
        firstIndex: z.number().int().nonnegative(),
      }),
    ),
    /** Listeners when each hook first fired, in run order; hooks nobody listened to are left out. */
    listeners: z.record(z.string(), z.array(rawListenerSchema)),
    /** Every hook call in order, as indexes into `hooks`. */
    sequence: z.array(z.number().int().nonnegative()),
  })
  .superRefine((trace, ctx) => {
    if (trace.sequence.some((i) => i >= trace.hooks.length)) {
      ctx.addIssue({ code: "custom", message: "sequence points past the hooks list" });
    }
    const total = trace.hooks.reduce((sum, h) => sum + h.count, 0);
    if (total !== trace.sequence.length) {
      ctx.addIssue({
        code: "custom",
        message: `hook counts add up to ${total}, sequence has ${trace.sequence.length}`,
      });
    }
    const names = new Set(trace.hooks.map((h) => h.name));
    const stray = Object.keys(trace.listeners).filter((name) => !names.has(name));
    if (stray.length > 0) ctx.addIssue({ code: "custom", message: `listeners for hooks that never fired: ${stray}` });
  });
export type TraceFile = z.infer<typeof traceFileSchema>;

export const metaFileSchema = z.object({
  version: z.string().regex(VERSION),
  wp: z.string().min(1),
  php: z.string().min(1),
  playground: z.string().min(1),
  catalog: z.object({ package: z.string().min(1), version: z.string().min(1) }),
  scenarios: z.array(z.string().regex(SCENARIO_ID)).min(1),
});
export type MetaFile = z.infer<typeof metaFileSchema>;

export const indexFileSchema = z
  .object({ latest: z.string().regex(VERSION), versions: z.array(z.string().regex(VERSION)).min(1) })
  .refine((index) => index.versions.includes(index.latest), { message: "latest must be one of versions" });
export type IndexFile = z.infer<typeof indexFileSchema>;

const listenerChangeSchema = z.object({
  hook: z.string(),
  callback: z.string(),
  change: z.enum(["added", "removed", "priority"]),
  from: prioritySchema.nullable(),
  to: prioritySchema.nullable(),
});

export const changesFileSchema = z.object({
  from: z.string().regex(VERSION),
  to: z.string().regex(VERSION),
  catalog: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
    deprecated: z.array(z.string()),
    argsChanged: z.array(z.object({ name: z.string(), from: z.number(), to: z.number() })),
  }),
  scenarios: z.array(
    z.object({
      scenario: z.string().regex(SCENARIO_ID),
      firedAdded: z.array(z.string()),
      firedRemoved: z.array(z.string()),
      moved: z.array(z.string()),
      listeners: z.array(listenerChangeSchema),
    }),
  ),
});
export type ChangesFile = z.infer<typeof changesFileSchema>;
