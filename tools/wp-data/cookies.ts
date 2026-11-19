/** A minimal cookie jar for one throwaway site: name → value, updated from Set-Cookie headers. */
export function keepCookies(jar: Map<string, string>, setCookieHeaders: ReadonlyArray<string>): void {
  for (const header of setCookieHeaders) {
    const pair = header.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = /;\s*max-age=0\b/i.test(header) || value === "" || value === "%20" || value === "deleted";
    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
}
