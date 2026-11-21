/**
 * The stages of a request, as the lifecycle map groups its hooks. A stage starts where a marker
 * hook first fires (or just after it), so the grouping comes from the trace, not from a list of
 * hook names. A stage whose marker never fired (a REST request has no template) is left out.
 */

export type StageId = "boot" | "init" | "main" | "template" | "render" | "shutdown";

export interface StageDef {
  readonly id: StageId;
  readonly title: string;
  /** Where in WordPress it happens. */
  readonly where: string;
  /** One plain-English line for beginners. */
  readonly what: string;
  /** The hook whose first call starts the stage; null for the first stage. */
  readonly marker: string | null;
  /** 0: the stage starts with the marker's call. 1: just after it. */
  readonly offset: 0 | 1;
  /** The lighting narrative: 0 is daylight, 0.5 dusk, 1 the dark core. */
  readonly mood: number;
}

const STAGES: ReadonlyArray<StageDef> = [
  {
    id: "boot",
    title: "Loading WordPress",
    where: "wp-settings.php",
    what: "Core files, drop-ins, must-use plugins, plugins and the theme load, in that order.",
    marker: null,
    offset: 0,
    mood: 0.25,
  },
  {
    id: "init",
    title: "init",
    where: "do_action( 'init' )",
    what: "Everything has loaded. Plugins and the theme set themselves up: post types, blocks, scripts.",
    marker: "init",
    offset: 0,
    mood: 0.5,
  },
  {
    id: "main",
    title: "WP::main()",
    where: "wp-includes/class-wp.php",
    what: "WordPress reads the address, works out what you asked for and fetches it from the database.",
    marker: "wp_loaded",
    offset: 1,
    mood: 1,
  },
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
  {
    id: "shutdown",
    title: "shutdown",
    where: "do_action( 'shutdown' )",
    what: "The page has been sent. PHP is about to stop.",
    marker: "shutdown",
    offset: 0,
    mood: 0,
  },
];

interface FiredHook {
  readonly name: string;
  readonly firstIndex: number;
}

export interface StageStart {
  readonly stage: StageDef;
  /** The call index the stage starts at. */
  readonly start: number;
}

/** Where each stage starts in this trace, in order; stages whose marker never fired are dropped. */
export function stageStarts(hooks: ReadonlyArray<FiredHook>): StageStart[] {
  const first = new Map(hooks.map((h) => [h.name, h.firstIndex]));
  return STAGES.flatMap((stage) => {
    if (stage.marker === null) return [{ stage, start: 0 }];
    const at = first.get(stage.marker);
    return at === undefined ? [] : [{ stage, start: at + stage.offset }];
  }).sort((a, b) => a.start - b.start);
}

/** The stage a call index falls in: the last stage that started at or before it. */
export function stageAt(starts: ReadonlyArray<StageStart>, index: number): StageDef {
  let found = starts[0]?.stage;
  for (const s of starts) if (s.start <= index) found = s.stage;
  if (!found) throw new RangeError("No stages to place a hook in");
  return found;
}
