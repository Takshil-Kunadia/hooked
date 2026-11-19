/**
 * Reading the generated data in content/versions. Every file is validated on the way in, so the
 * site and the integrity tests never work with a malformed file.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import {
  catalogFileSchema,
  changesFileSchema,
  indexFileSchema,
  metaFileSchema,
  SCENARIO_ID,
  traceFileSchema,
  VERSION,
  type CatalogFile,
  type ChangesFile,
  type IndexFile,
  type MetaFile,
  type TraceFile,
} from "./schema.ts";

/** Newest first: "7.10" sorts above "7.9". */
export function compareVersions(a: string, b: string): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return bMajor - aMajor || bMinor - aMinor;
}

function assertVersion(version: string): void {
  if (!VERSION.test(version)) throw new Error(`Not a WordPress major version: "${version}" (expected e.g. 7.1)`);
}

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const text = await readFile(file, "utf8");
  const result = schema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`${file} is not valid: ${result.error.message}`);
  return result.data;
}

export const versionDir = (root: string, version: string): string => {
  assertVersion(version);
  return path.join(root, version);
};

export async function readIndex(root: string): Promise<IndexFile> {
  return readJson(path.join(root, "index.json"), indexFileSchema);
}

export async function readMeta(root: string, version: string): Promise<MetaFile> {
  return readJson(path.join(versionDir(root, version), "meta.json"), metaFileSchema);
}

export async function readCatalog(root: string, version: string): Promise<CatalogFile> {
  return readJson(path.join(versionDir(root, version), "catalog.json"), catalogFileSchema);
}

export async function readChanges(root: string, version: string): Promise<ChangesFile> {
  return readJson(path.join(versionDir(root, version), "changes.json"), changesFileSchema);
}

export async function readTrace(root: string, version: string, scenario: string): Promise<TraceFile> {
  if (!SCENARIO_ID.test(scenario)) throw new Error(`Not a scenario id: "${scenario}"`);
  return readJson(path.join(versionDir(root, version), "traces", `${scenario}.json`), traceFileSchema);
}
