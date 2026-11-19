/**
 * Generates the data for one WordPress version into content/versions/<x.y>.
 *
 *   pnpm wp-data 7.1          trace WordPress 7.1 in Playground and write its data
 *   pnpm wp-data --changes    only recompute index.json and every changes.json
 *
 * Every run rewrites index.json and every changes.json, so adding an older version later also
 * fills in the comparison for the version after it.
 */
import { access, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { createHookMatcher, normalizeCatalog, type CatalogHook } from "../../src/lib/wp-data/catalog.ts";
import { buildTraceFile } from "../../src/lib/wp-data/build.ts";
import { diffCatalogs, diffTraces } from "../../src/lib/wp-data/diff.ts";
import { compareVersions, readCatalog, readMeta, readTrace, versionDir } from "../../src/lib/wp-data/files.ts";
import { toDataJson } from "../../src/lib/wp-data/json.ts";
import { SCENARIOS, type SiteId } from "../../src/lib/wp-data/scenarios.ts";
import {
  catalogFileSchema,
  traceFileSchema,
  VERSION,
  type ChangesFile,
  type MetaFile,
  type TraceFile,
} from "../../src/lib/wp-data/schema.ts";
import { resolveCatalog } from "./catalog-source.ts";
import { CACHE_DIR, CATALOG_PACKAGE, CLASSIC_CHILD_THEME, CONTENT_DIR, PLAYGROUND_CLI, SITES } from "./config.ts";
import { applyAdminCookies, startSite, traceScenario, type Mounts } from "./playground.ts";
import { CLASSIC_PARENT, classicParentTheme } from "./theme-source.ts";
import { exactRelease } from "./wp-release.ts";

interface SiteResult {
  readonly trace: TraceFile;
  readonly wp: string;
  readonly php: string;
}

const say = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

/** Locale-independent ordering, so generated files are byte-identical on every machine. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const writeData = async (file: string, value: Readonly<Record<string, unknown>>): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, toDataJson(value));
};

function checkTheme(site: SiteId, scenario: string, theme: string | null): void {
  const classic = SITES[site].classicTheme;
  if (classic ? theme !== CLASSIC_CHILD_THEME : theme === null || theme === CLASSIC_CHILD_THEME) {
    throw new Error(`${scenario}: served by theme "${theme}", which is not the ${site} site's theme`);
  }
}

async function traceSite(release: string, site: SiteId, outDir: string, isCoreHook: (name: string) => boolean) {
  const spec = SITES[site];
  const mounts: Mounts = spec.classicTheme
    ? [[await classicParentTheme(CACHE_DIR), `/wordpress/wp-content/themes/${CLASSIC_PARENT.slug}`]]
    : [];
  say(`· ${site}: starting WordPress ${release} in Playground…`);
  const log = path.join(CACHE_DIR, "logs", `${release}-${site}.log`);
  const running = await startSite(release, spec, outDir, log, mounts);
  try {
    if (spec.loggedIn) await applyAdminCookies(running, outDir);
    const results: SiteResult[] = [];
    for (const scenario of SCENARIOS.filter((s) => s.site === site)) {
      const { status, dump } = await traceScenario(running, scenario, outDir);
      checkTheme(site, scenario.id, dump.theme);
      const request = { scenario: scenario.id, method: scenario.method, path: scenario.path, status };
      const trace = traceFileSchema.parse(buildTraceFile(dump, request, isCoreHook));
      say(`  ${scenario.id.padEnd(18)} ${status}  ${trace.sequence.length} hook calls, ${trace.hooks.length} hooks`);
      results.push({ trace, wp: dump.wp, php: dump.php });
    }
    return results;
  } finally {
    await running.stop();
  }
}

async function traceAll(release: string, hooks: ReadonlyArray<CatalogHook>): Promise<SiteResult[]> {
  const matcher = createHookMatcher(hooks);
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hooked-trace-"));
  const results: SiteResult[] = [];
  try {
    for (const site of Object.keys(SITES) as SiteId[]) {
      results.push(...(await traceSite(release, site, outDir, (name) => matcher(name) !== undefined)));
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
  return results;
}

/** Writes the version into a scratch folder first, then swaps it in, so a failed run leaves no half version. */
async function writeVersion(version: string, files: ReadonlyMap<string, Readonly<Record<string, unknown>>>) {
  const dir = versionDir(CONTENT_DIR, version);
  const scratch = `${dir}.tmp-${process.pid}`;
  await rm(scratch, { recursive: true, force: true });
  for (const [name, value] of files) await writeData(path.join(scratch, name), value);
  await rm(dir, { recursive: true, force: true });
  await rename(scratch, dir);
}

async function generate(version: string): Promise<void> {
  say(`Catalog: finding the ${CATALOG_PACKAGE} release for WordPress ${version}…`);
  const source = await resolveCatalog(version, CACHE_DIR);
  const hooks = normalizeCatalog(source.hooks).sort((a, b) => byCodeUnit(a.name, b.name) || byCodeUnit(a.file, b.file));
  const catalog = catalogFileSchema.parse({ package: CATALOG_PACKAGE, version: source.packageVersion, hooks });
  say(`  ${CATALOG_PACKAGE}@${source.packageVersion}: ${hooks.length} hooks`);

  const release = await exactRelease(version);
  await mkdir(path.join(CACHE_DIR, "logs"), { recursive: true });
  const results = await traceAll(release, hooks);

  const served = new Set(results.map((r) => r.wp));
  const [wp] = served;
  if (served.size !== 1 || wp !== release) {
    throw new Error(`Expected WordPress ${release} in every run, Playground served: ${[...served].join(", ")}`);
  }
  const meta: MetaFile = {
    version,
    wp,
    php: results[0]?.php ?? "",
    playground: PLAYGROUND_CLI.version,
    catalog: { package: CATALOG_PACKAGE, version: source.packageVersion },
    scenarios: results.map((r) => r.trace.scenario),
  };
  const files = new Map<string, Readonly<Record<string, unknown>>>([
    ["meta.json", meta],
    ["catalog.json", catalog],
    ...results.map(({ trace }) => [`traces/${trace.scenario}.json`, trace] as const),
  ]);
  await writeVersion(version, files);
  say(`Wrote ${path.relative(process.cwd(), versionDir(CONTENT_DIR, version))} (WordPress ${wp})`);
}

/** Version folders with a meta.json, newest first; anything else (scratch folders, partial copies) is ignored. */
async function keptVersions(): Promise<string[]> {
  const entries = await readdir(CONTENT_DIR, { withFileTypes: true }).catch(() => []);
  const candidates = entries.filter((e) => e.isDirectory() && VERSION.test(e.name)).map((e) => e.name);
  const complete = await Promise.all(
    candidates.map((v) =>
      access(path.join(CONTENT_DIR, v, "meta.json")).then(
        () => v,
        () => null,
      ),
    ),
  );
  return complete.filter((v): v is string => v !== null).sort(compareVersions);
}

async function compare(from: string, to: string): Promise<ChangesFile> {
  const [prevCatalog, nextCatalog, prevMeta, nextMeta] = await Promise.all([
    readCatalog(CONTENT_DIR, from),
    readCatalog(CONTENT_DIR, to),
    readMeta(CONTENT_DIR, from),
    readMeta(CONTENT_DIR, to),
  ]);
  const shared = nextMeta.scenarios.filter((s) => prevMeta.scenarios.includes(s));
  const scenarios = await Promise.all(
    shared.map(async (id) => diffTraces(await readTrace(CONTENT_DIR, from, id), await readTrace(CONTENT_DIR, to, id))),
  );
  return { from, to, catalog: diffCatalogs(prevCatalog.hooks, nextCatalog.hooks), scenarios };
}

async function writeIndexAndChanges(): Promise<void> {
  const versions = await keptVersions();
  const [latest] = versions;
  if (latest === undefined) throw new Error(`No generated versions in ${CONTENT_DIR}`);
  await writeData(path.join(CONTENT_DIR, "index.json"), { latest, versions });
  for (const [i, to] of versions.entries()) {
    const file = path.join(versionDir(CONTENT_DIR, to), "changes.json");
    const from = versions[i + 1];
    if (from === undefined) {
      await rm(file, { force: true });
      continue;
    }
    const changes = await compare(from, to);
    await writeData(file, changes);
    say(`Changes ${from} → ${to}: +${changes.catalog.added.length} / −${changes.catalog.removed.length} hooks`);
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { changes: { type: "boolean" } } });
  if (!values.changes) {
    const [version] = positionals;
    if (positionals.length !== 1 || version === undefined || !VERSION.test(version)) {
      throw new Error("Usage: pnpm wp-data <major.minor>   (for example: pnpm wp-data 7.1)");
    }
    await generate(version);
  }
  await writeIndexAndChanges();
}

main().catch((error: unknown) => {
  say(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
