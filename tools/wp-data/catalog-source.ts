/**
 * Finds the @wp-hooks/wordpress-core release that documents a given WordPress version, downloads
 * it straight from the npm registry, checks it against the registry's sha512 and unpacks only the
 * files we read. The tarball is treated as untrusted: no links, no paths outside the package.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { RawCatalogHook } from "../../src/lib/wp-data/catalog.ts";
import { compareVersions } from "../../src/lib/wp-data/files.ts";
import { rawCatalogFileSchema } from "../../src/lib/wp-data/schema.ts";
import { CATALOG_PACKAGE } from "./config.ts";
import { checkArchiveListing } from "./archive.ts";
import { coveredVersion, newestFirst } from "./catalog-release.ts";

const run = promisify(execFile);

/** The package is a few MB; anything far bigger is not what we expect. */
const MAX_TARBALL_BYTES = 50 * 1024 * 1024;
const HOOK_FILES = ["package/hooks/actions.json", "package/hooks/filters.json"] as const;

const packumentSchema = z.object({
  versions: z.record(
    z.string(),
    z.object({
      version: z.string(),
      dist: z.object({ tarball: z.url(), integrity: z.string().startsWith("sha512-") }),
    }),
  ),
});
type Release = z.infer<typeof packumentSchema>["versions"][string];

export interface CatalogSource {
  readonly packageVersion: string;
  readonly hooks: ReadonlyArray<RawCatalogHook>;
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`GET ${url} → ${response.status} ${response.statusText}`);
  return response;
}

const sha512 = (bytes: Uint8Array): string => `sha512-${createHash("sha512").update(bytes).digest("base64")}`;

async function fetchTarball(release: Release): Promise<Buffer> {
  const response = await fetchOk(release.dist.tarball);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_TARBALL_BYTES) throw new Error(`${release.version}: tarball is ${length} bytes, too large`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_TARBALL_BYTES) throw new Error(`${release.version}: tarball too large`);
  return bytes;
}

/** A verified copy of the release's tarball, from the cache when it is intact. */
async function download(release: Release, cacheDir: string): Promise<string> {
  const file = path.join(cacheDir, "catalog", `${release.version}.tgz`);
  const cached = await readFile(file).catch(() => null);
  if (cached && sha512(cached) === release.dist.integrity) return file;

  const bytes = await fetchTarball(release);
  if (sha512(bytes) !== release.dist.integrity) {
    throw new Error(`${CATALOG_PACKAGE}@${release.version}: checksum mismatch, refusing to use it`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.part`, bytes);
  await rename(`${file}.part`, file);
  return file;
}

/** Unpacks the readme and hook files into a fresh, empty folder and returns that folder. */
async function unpack(tarball: string, dir: string): Promise<string[]> {
  const { stdout } = await run("tar", ["-tvzf", tarball], { maxBuffer: 16 * 1024 * 1024 });
  const members = checkArchiveListing(stdout);
  const readme = members.find((m) => /^package\/readme(\.md)?$/i.test(m));
  const wanted = [...HOOK_FILES, ...(readme ? [readme] : [])];
  await run("tar", ["-xzf", tarball, "-C", dir, "--no-same-owner", "--no-same-permissions", ...wanted]);
  return wanted;
}

async function readHooks(dir: string): Promise<RawCatalogHook[]> {
  const parts = await Promise.all(
    HOOK_FILES.map(async (member) => {
      const text = await readFile(path.join(dir, member), "utf8");
      return rawCatalogFileSchema.parse(JSON.parse(text)).hooks;
    }),
  );
  return parts.flat();
}

/** Which WordPress version a release documents, plus its hooks when that is the one we want. */
async function inspect(release: Release, cacheDir: string, wanted: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "hooked-catalog-"));
  try {
    const members = await unpack(await download(release, cacheDir), dir);
    const readme = members.find((m) => !HOOK_FILES.includes(m as (typeof HOOK_FILES)[number]));
    const covers = readme ? coveredVersion(await readFile(path.join(dir, readme), "utf8")) : undefined;
    return { covers, hooks: covers === wanted ? await readHooks(dir) : undefined };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function resolveCatalog(wpVersion: string, cacheDir: string): Promise<CatalogSource> {
  const url = `https://registry.npmjs.org/${CATALOG_PACKAGE.replace("/", "%2F")}`;
  const packument = packumentSchema.parse(await (await fetchOk(url)).json());
  const releases = newestFirst(Object.values(packument.versions));

  for (const release of releases) {
    const { covers, hooks } = await inspect(release, cacheDir, wpVersion);
    if (hooks) return { packageVersion: release.version, hooks };
    // Releases only move forward: once they document an older WordPress, nothing further back will match.
    if (covers !== undefined && compareVersions(covers, wpVersion) > 0) break;
  }
  throw new Error(
    `No ${CATALOG_PACKAGE} release documents WordPress ${wpVersion} (its readme's "Last updated for WordPress x.y" line). ` +
      "Release candidates and trunk need wp-hooks-generator; see docs/data-pipeline.md.",
  );
}
