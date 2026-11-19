/**
 * Records how real WordPress hook code behaves in every conformance scenario, for each WordPress
 * version in content/versions, into tools/hook-engine/expected/<x.y>.json.
 *
 *   pnpm hook-conformance
 *
 * It downloads wp-includes/plugin.php and the files it requires from the WordPress/WordPress
 * mirror at that exact release, checks each one against the official checksums from
 * api.wordpress.org, and runs tools/hook-engine/conformance-runner.php on them with the local
 * `php`. The TypeScript engine is then tested against those recordings, so CI needs neither PHP
 * nor WordPress.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import { readIndex, readMeta } from "../../src/lib/wp-data/files.ts";
import { VERSION } from "../../src/lib/wp-data/schema.ts";
import { CONTENT_DIR } from "../wp-data/config.ts";
import { formatExpected, requiredFiles, scenariosDigest } from "./expected.ts";

const run = promisify(execFile);
const HERE = fileURLToPath(new URL(".", import.meta.url));
const SCENARIOS = path.join(HERE, "scenarios.json");
const RELEASE = /^\d+\.\d+(\.\d+)?$/;

const checksumsSchema = z.object({ checksums: z.record(z.string(), z.string().regex(/^[0-9a-f]{32}$/)) });
const recordingSchema = z.record(z.string(), z.array(z.array(z.unknown())));

const say = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`GET ${url} → ${response.status} ${response.statusText}`);
  return response;
}

async function officialChecksums(release: string): Promise<Readonly<Record<string, string>>> {
  const url = `https://api.wordpress.org/core/checksums/1.0/?version=${release}&locale=en_US`;
  return checksumsSchema.parse(await (await fetchOk(url)).json()).checksums;
}

/** Downloads one wp-includes file and refuses it unless its bytes match the official checksum. */
async function verifiedFile(release: string, file: string, checksums: Readonly<Record<string, string>>) {
  const name = `wp-includes/${file}`;
  const expected = checksums[name];
  if (expected === undefined) throw new Error(`WordPress ${release} has no checksum for ${name}`);
  const url = `https://raw.githubusercontent.com/WordPress/WordPress/${release}/${name}`;
  const bytes = Buffer.from(await (await fetchOk(url)).arrayBuffer());
  if (createHash("md5").update(bytes).digest("hex") !== expected) {
    throw new Error(`${name} from ${url} does not match WordPress ${release}'s checksum`);
  }
  return { name, bytes, md5: expected };
}

/** Runs every scenario on one release's hook code; returns the logs and the files they ran on. */
async function record(release: string) {
  if (!RELEASE.test(release)) throw new Error(`Not a WordPress release number: ${release}`);
  const checksums = await officialChecksums(release);
  const dir = await mkdtemp(path.join(os.tmpdir(), "hooked-hooks-"));
  try {
    const plugin = await verifiedFile(release, "plugin.php", checksums);
    const files = [plugin];
    for (const file of requiredFiles(plugin.bytes.toString("utf8")))
      files.push(await verifiedFile(release, file, checksums));
    for (const file of files) await writeFile(path.join(dir, path.basename(file.name)), file.bytes);
    const { stdout } = await run("php", [path.join(HERE, "conformance-runner.php"), dir, SCENARIOS], {
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      scenarios: recordingSchema.parse(JSON.parse(stdout)),
      files: Object.fromEntries(files.map((file) => [file.name, file.md5])),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The scenarios file's fingerprint, after checking it has no duplicate ids (PHP would keep only the last). */
async function checkedScenarios(): Promise<string> {
  const text = await readFile(SCENARIOS, "utf8");
  const ids = z
    .object({ scenarios: z.array(z.object({ id: z.string() })) })
    .parse(JSON.parse(text))
    .scenarios.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error("scenarios.json has duplicate scenario ids");
  return scenariosDigest(text);
}

async function main(): Promise<void> {
  const scenariosSha256 = await checkedScenarios();
  const { stdout: php } = await run("php", ["-r", "echo PHP_VERSION;"]);
  const index = await readIndex(CONTENT_DIR);
  for (const version of index.versions) {
    if (!VERSION.test(version)) throw new Error(`Not a major.minor version in index.json: ${version}`);
    const { wp } = await readMeta(CONTENT_DIR, version);
    say(`WordPress ${wp}: running the scenarios against its hook code on PHP ${php}…`);
    const { scenarios, files } = await record(wp);
    const file = path.join(HERE, "expected", `${version}.json`);
    await writeFile(file, formatExpected({ wp, php, scenariosSha256, files, scenarios }));
    say(`  ${Object.keys(scenarios).length} scenarios → ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((error: unknown) => {
  say(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
