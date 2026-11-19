/** Safety checks for downloaded archives, which are untrusted until proven otherwise. */

const escapes = (member: string, root: string): boolean =>
  !member.startsWith(`${root}/`) || member.split("/").includes("..");

/**
 * Member paths from `tar -tvzf` output, after refusing anything that is not a plain file or folder
 * inside the root folder (links could point anywhere on disk; absolute or ../ paths could escape).
 */
export function checkArchiveListing(listing: string, root = "package"): string[] {
  const lines = listing.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => {
    const kind = line[0];
    const member = line.trim().split(/\s+/).at(-1) ?? "";
    if (kind !== "-" && kind !== "d") throw new Error(`Refusing archive member that is not a plain file: ${line}`);
    if (escapes(member, root)) {
      throw new Error(`Refusing archive member outside ${root}/: ${member}`);
    }
    return member;
  });
}

/** Entry names from `unzip -Z1`, after refusing any that would land outside `root/`. */
export function checkZipEntries(listing: string, root: string): string[] {
  const entries = listing.split("\n").filter((line) => line.trim() !== "");
  for (const entry of entries) {
    if (escapes(entry, root)) throw new Error(`Refusing zip entry outside ${root}/: ${entry}`);
  }
  return entries;
}
