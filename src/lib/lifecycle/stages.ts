/**
 * The stages of a request, as the lifecycle map groups its hooks. A stage starts where a marker
 * hook first fires (or just after it), so the grouping comes from the trace, not from a list of
 * hook names. Every request loads WordPress the same way; what happens after `wp_loaded` depends
 * on the door it came in by: the front end, the REST API, the admin, admin-ajax.php or wp-cron.php.
 */

export type StageId =
  | "boot"
  | "init"
  | "main"
  | "template"
  | "render"
  | "rest"
  | "admin"
  | "screen"
  | "ajax"
  | "action"
  | "cron"
  | "shutdown";

/** Which door the request came in by. */
export type EntryKind = "front" | "rest" | "admin" | "ajax" | "cron";

export interface StageDef {
  readonly id: StageId;
  readonly title: string;
  /** Where in WordPress it happens. */
  readonly where: string;
  /** One plain-English line for beginners. */
  readonly what: string;
  /** The hook whose first call starts the stage (a pattern: the first hook matching it); null for the first stage. */
  readonly marker: string | RegExp | null;
  /** 0: the stage starts with the marker's call. 1: just after it. */
  readonly offset: 0 | 1;
  /** The lighting narrative: 0 is daylight, 0.5 dusk, 1 the dark core. */
  readonly mood: number;
}

const BOOT: StageDef = {
  id: "boot",
  title: "Loading WordPress",
  where: "wp-settings.php",
  what: "Core files, drop-ins, must-use plugins, plugins and the theme load, in that order.",
  marker: null,
  offset: 0,
  mood: 0.25,
};

const INIT: StageDef = {
  id: "init",
  title: "init",
  where: "do_action( 'init' )",
  what: "Everything has loaded. Plugins and the theme set themselves up: post types, blocks, scripts.",
  marker: "init",
  offset: 0,
  mood: 0.5,
};

const SHUTDOWN: StageDef = {
  id: "shutdown",
  title: "shutdown",
  where: "do_action( 'shutdown' )",
  what: "The response has been sent. PHP is about to stop.",
  marker: "shutdown",
  offset: 0,
  mood: 0,
};

const MAIN: StageDef = {
  id: "main",
  title: "WP::main()",
  where: "wp-includes/class-wp.php",
  what: "WordPress reads the address, works out what you asked for and fetches it from the database.",
  marker: "wp_loaded",
  offset: 1,
  mood: 1,
};

const AFTER_LOADING: Readonly<Record<EntryKind, ReadonlyArray<StageDef>>> = {
  front: [
    MAIN,
    {
      id: "template",
      title: "Choosing the template",
      where: "wp-includes/template-loader.php",
      what: "WordPress picks the theme file that will draw this page.",
      marker: "template_redirect",
      offset: 0,
      mood: 0.75,
    },
    {
      id: "render",
      title: "Rendering the page",
      where: "the theme's template",
      what: "The template runs: blocks, the title, the content, the head and the footer become HTML.",
      marker: "template_include",
      offset: 1,
      mood: 0.25,
    },
  ],
  rest: [
    {
      ...MAIN,
      what: "WordPress reads the address and sees /wp-json/: the REST API takes the request from here.",
    },
    {
      id: "rest",
      title: "The REST API",
      where: "wp-includes/rest-api.php",
      what: "Routes are registered, the request is matched to one, and the answer goes back as JSON.",
      marker: "rest_api_init",
      offset: 0,
      mood: 0.75,
    },
  ],
  admin: [
    {
      id: "admin",
      title: "admin.php",
      where: "wp-admin/admin.php",
      what: "WordPress checks you are logged in, builds the admin menu, runs admin_init and sets up the screen.",
      marker: "wp_loaded",
      offset: 1,
      mood: 1,
    },
    {
      id: "screen",
      title: "Drawing the screen",
      where: "wp-admin/admin-header.php",
      what: "The dashboard's HTML: the head, the menu, the widgets and the footer.",
      marker: "admin_head",
      offset: 0,
      mood: 0.25,
    },
  ],
  ajax: [
    {
      id: "ajax",
      title: "admin-ajax.php",
      where: "wp-admin/admin-ajax.php",
      what: "WordPress runs admin_init, then looks up the action the request named.",
      marker: "wp_loaded",
      offset: 1,
      mood: 1,
    },
    {
      id: "action",
      title: "The AJAX action",
      where: "do_action( 'wp_ajax_nopriv_{$action}' )",
      what: "The callback a plugin added for this action runs and sends its answer.",
      marker: /^wp_ajax_/,
      offset: 0,
      mood: 0.5,
    },
  ],
  cron: [
    {
      id: "cron",
      title: "wp-cron.php",
      where: "wp-cron.php",
      what: "WordPress takes the cron lock and runs every scheduled event that is due.",
      marker: "wp_loaded",
      offset: 1,
      mood: 1,
    },
  ],
};

/** The door a request came in by, from its address. */
export function entryKind(path: string): EntryKind {
  if (path.startsWith("/wp-admin/admin-ajax.php")) return "ajax";
  if (path.startsWith("/wp-admin/")) return "admin";
  if (path.startsWith("/wp-json/")) return "rest";
  if (path.startsWith("/wp-cron.php")) return "cron";
  return "front";
}

/** Every stage a request of this kind can have, in order. */
function stagesFor(kind: EntryKind): ReadonlyArray<StageDef> {
  return [BOOT, INIT, ...AFTER_LOADING[kind], SHUTDOWN];
}

interface FiredHook {
  readonly name: string;
  readonly firstIndex: number;
}

export interface StageStart {
  readonly stage: StageDef;
  /** The call index the stage starts at. */
  readonly start: number;
}

function markerAt(hooks: ReadonlyArray<FiredHook>, marker: string | RegExp): number | undefined {
  const fired = hooks.filter((h) => (typeof marker === "string" ? h.name === marker : marker.test(h.name)));
  return fired.length === 0 ? undefined : Math.min(...fired.map((h) => h.firstIndex));
}

/** Where each stage starts in this trace, in order; stages whose marker never fired are dropped. */
export function stageStarts(hooks: ReadonlyArray<FiredHook>, kind: EntryKind = "front"): StageStart[] {
  return stagesFor(kind)
    .flatMap((stage) => {
      if (stage.marker === null) return [{ stage, start: 0 }];
      const at = markerAt(hooks, stage.marker);
      return at === undefined ? [] : [{ stage, start: at + stage.offset }];
    })
    .sort((a, b) => a.start - b.start);
}

/** The stage a call index falls in: the last stage that started at or before it. */
export function stageAt(starts: ReadonlyArray<StageStart>, index: number): StageDef {
  let found = starts[0]?.stage;
  for (const s of starts) if (s.start <= index) found = s.stage;
  if (!found) throw new RangeError("No stages to place a hook in");
  return found;
}
