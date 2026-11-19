/** Pure helpers for picking and unpacking a catalog release (tested in catalog-release.test.ts). */

interface Versioned {
  readonly version: string;
}

/** Stable releases only, newest first by semver. */
export function newestFirst<T extends Versioned>(releases: ReadonlyArray<T>): T[] {
  const parts = (v: string): number[] => v.split(".").map(Number);
  return releases
    .filter((r) => /^\d+\.\d+\.\d+$/.test(r.version))
    .sort((a, b) => {
      const [pa, pb] = [parts(a.version), parts(b.version)];
      return (pb[0] ?? 0) - (pa[0] ?? 0) || (pb[1] ?? 0) - (pa[1] ?? 0) || (pb[2] ?? 0) - (pa[2] ?? 0);
    });
}

/** The WordPress version a release's readme says it documents. */
export function coveredVersion(readme: string): string | undefined {
  return /Last updated for WordPress (\d+\.\d+)/i.exec(readme)?.[1];
}
