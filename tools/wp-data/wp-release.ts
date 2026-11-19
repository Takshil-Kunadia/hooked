/**
 * The exact WordPress release to trace for a major version (7.0 → 7.0.9). Playground resolves a
 * bare "7.0" by prefix against the newest releases and can serve the wrong one, so the pipeline
 * always asks for an exact version.
 */
import { z } from "zod";

const STABLE_CHECK = "https://api.wordpress.org/core/stable-check/1.0/";

/** Version → "latest" | "outdated" | "insecure", for every WordPress release ever made. */
const stableCheckSchema = z.record(z.string(), z.string());

/** The newest x.y.z release of a major version, from a list of release names. */
export function latestPatch(releases: ReadonlyArray<string>, major: string): string | undefined {
  const patch = (version: string): number => {
    if (version === major) return 0;
    const rest = version.startsWith(`${major}.`) ? version.slice(major.length + 1) : "";
    return /^\d+$/.test(rest) ? Number(rest) : -1;
  };
  const best = releases.reduce((top, v) => (patch(v) > patch(top) ? v : top), "");
  return patch(best) >= 0 && best !== "" ? best : undefined;
}

export async function exactRelease(major: string): Promise<string> {
  const response = await fetch(STABLE_CHECK, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`GET ${STABLE_CHECK} → ${response.status}`);
  const releases = Object.keys(stableCheckSchema.parse(await response.json()));
  const exact = latestPatch(releases, major);
  if (!exact) throw new Error(`WordPress ${major} has no stable release yet`);
  return exact;
}
