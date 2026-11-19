/** Pure helpers for tools/hook-engine/generate.ts (tested in expected.test.ts). */
import { createHash } from "node:crypto";

const REQUIRE = /^\s*require(?:_once)?\s+__DIR__\s*\.\s*'\/([a-z0-9-]+\.php)'\s*;/gm;

/** The files plugin.php requires from its own folder, e.g. class-wp-hook.php. */
export function requiredFiles(pluginSource: string): string[] {
  return [...pluginSource.matchAll(REQUIRE)].map((match) => match[1] ?? "");
}

/**
 * A fingerprint of the scenarios a recording was made from. It ignores formatting and the
 * `$comment`, so reformatting scenarios.json does not make the recordings stale.
 */
export function scenariosDigest(scenariosJson: string): string {
  const { scenarios } = JSON.parse(scenariosJson) as { scenarios: unknown };
  return createHash("sha256").update(JSON.stringify(scenarios)).digest("hex");
}

export interface Recording {
  /** The exact WordPress release whose hook code ran. */
  readonly wp: string;
  /** The full PHP version it ran on. */
  readonly php: string;
  /** scenariosDigest() of the scenarios.json it ran. */
  readonly scenariosSha256: string;
  /** Each WordPress file used, with its official md5 from api.wordpress.org. */
  readonly files: Readonly<Record<string, string>>;
  readonly scenarios: Readonly<Record<string, ReadonlyArray<unknown>>>;
}

/** One recorded step per line, so a regenerated file's diff shows exactly which behaviour changed. */
export function formatExpected({ wp, php, scenariosSha256, files, scenarios }: Recording): string {
  const scenario = ([id, steps]: [string, ReadonlyArray<unknown>]): string =>
    steps.length === 0
      ? `    ${JSON.stringify(id)}: []`
      : `    ${JSON.stringify(id)}: [\n${steps.map((s) => `      ${JSON.stringify(s)}`).join(",\n")}\n    ]`;
  return [
    "{",
    `  "wp": ${JSON.stringify(wp)},`,
    `  "php": ${JSON.stringify(php)},`,
    `  "scenariosSha256": ${JSON.stringify(scenariosSha256)},`,
    `  "files": ${JSON.stringify(files)},`,
    '  "scenarios": {',
    Object.entries(scenarios).map(scenario).join(",\n"),
    "  }",
    "}",
    "",
  ].join("\n");
}
