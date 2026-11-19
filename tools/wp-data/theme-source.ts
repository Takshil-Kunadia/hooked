/**
 * Twenty Twenty-One is no longer bundled with WordPress. The classic site mounts a pinned release:
 * downloaded once from wordpress.org, checked against its SHA-256 and unpacked into the cache, so
 * the throwaway site itself needs no network access.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { checkZipEntries } from "./archive.ts";

const run = promisify(execFile);

export const CLASSIC_PARENT = {
  slug: "twentytwentyone",
  version: "2.9",
  sha256: "51d4ac1dcaef18b0e35a1a313bce8115d3aa4ff315bb1143f95c223c38817d8b",
} as const;

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

async function verifiedZip(file: string): Promise<void> {
  const cached = await readFile(file).catch(() => null);
  if (cached && sha256(cached) === CLASSIC_PARENT.sha256) return;
  const url = `https://downloads.wordpress.org/theme/${CLASSIC_PARENT.slug}.${CLASSIC_PARENT.version}.zip`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`GET ${url} → ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== CLASSIC_PARENT.sha256) {
    throw new Error(`${CLASSIC_PARENT.slug} ${CLASSIC_PARENT.version}: checksum mismatch, refusing to use it`);
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.part`, bytes);
  await rename(`${file}.part`, file);
}

/** The unpacked parent theme folder, ready to mount. */
export async function classicParentTheme(cacheDir: string): Promise<string> {
  const base = path.join(cacheDir, "themes", `${CLASSIC_PARENT.slug}-${CLASSIC_PARENT.version}`);
  const themeDir = path.join(base, CLASSIC_PARENT.slug);
  const ready = await access(path.join(themeDir, "style.css")).then(
    () => true,
    () => false,
  );
  if (ready) return themeDir;

  const zip = `${base}.zip`;
  await verifiedZip(zip);
  const { stdout } = await run("unzip", ["-Z1", zip], { maxBuffer: 16 * 1024 * 1024 });
  checkZipEntries(stdout, CLASSIC_PARENT.slug);
  const scratch = await mkdtemp(path.join(os.tmpdir(), "hooked-theme-"));
  try {
    await run("unzip", ["-q", zip, "-d", scratch]);
    await rm(base, { recursive: true, force: true });
    await mkdir(base, { recursive: true });
    await rename(path.join(scratch, CLASSIC_PARENT.slug), themeDir);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  return themeDir;
}
