import { describe, expect, it } from "vitest";
import { checkArchiveListing, checkZipEntries } from "./archive";

describe("checkArchiveListing", () => {
  const file = (name: string): string => `-rw-r--r--  0 0      0        1234 Oct 26  1985 ${name}`;

  it("returns the member paths of a normal npm tarball (BSD and GNU tar formats)", () => {
    const gnu = "-rw-r--r-- 0/0    99 1985-10-26 08:15 package/hooks/filters.json";
    expect(checkArchiveListing([file("package/readme.md"), gnu, ""].join("\n"))).toEqual([
      "package/readme.md",
      "package/hooks/filters.json",
    ]);
  });

  it.each([
    ["a symlink", "lrwxr-xr-x  0 0 0 0 Oct 26  1985 package/hooks -> /etc"],
    ["a hard link", "hrw-r--r--  0 0 0 0 Oct 26  1985 package/x link to /etc/passwd"],
    ["a path outside package/", file("etc/passwd")],
    ["a path that climbs out", file("package/../../etc/passwd")],
  ])("refuses %s", (_, line) => {
    expect(() => checkArchiveListing(line)).toThrow(/Refusing/);
  });
});

describe("checkZipEntries", () => {
  it("accepts entries inside the theme folder", () => {
    expect(checkZipEntries("twentytwentyone/\ntwentytwentyone/style.css\n", "twentytwentyone")).toHaveLength(2);
  });

  it.each(["/etc/passwd", "twentytwentyone/../../x.php", "other/style.css"])("refuses %s", (entry) => {
    expect(() => checkZipEntries(`twentytwentyone/style.css\n${entry}`, "twentytwentyone")).toThrow(/Refusing/);
  });
});
