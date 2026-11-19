/**
 * Pinned inputs for a data run. Change these deliberately: a different Playground or PHP version
 * can change the traces, so regenerate every kept WordPress version after bumping one.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SiteId } from "../../src/lib/wp-data/scenarios.ts";

export const TOOL_DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.resolve(TOOL_DIR, "../..");
export const CONTENT_DIR = path.join(ROOT, "content", "versions");
export const CACHE_DIR = path.join(ROOT, ".cache", "wp-data");

export const PLAYGROUND_CLI = { name: "@wp-playground/cli", version: "3.1.65" } as const;
export const PHP_VERSION = "8.3";
export const CATALOG_PACKAGE = "@wp-hooks/wordpress-core";

/** How each traced site differs; tools/wp-data/blueprints.ts turns this into a Playground blueprint. */
export interface SiteSpec {
  /** A child theme of Twenty Twenty-One instead of the default block theme. */
  readonly classicTheme: boolean;
  /** Requests carry an administrator's auth cookies. */
  readonly loggedIn: boolean;
}

export const SITES: Readonly<Record<SiteId, SiteSpec>> = {
  block: { classicTheme: false, loggedIn: false },
  classic: { classicTheme: true, loggedIn: false },
  admin: { classicTheme: false, loggedIn: true },
};

/** The classic site's active theme. The other sites run whatever default theme WordPress ships. */
export const CLASSIC_CHILD_THEME = "hooked-child";

/** [path under tools/wp-data, path inside Playground]. The trace output folder is added per run. */
export const MOUNTS: ReadonlyArray<readonly [string, string]> = [
  ["tracer/hooked-tracer.php", "/internal/shared/preload/zz-hooked-tracer.php"],
  ["fixtures/mu-plugins", "/wordpress/wp-content/mu-plugins"],
  ["fixtures/plugins/hooked-demo", "/wordpress/wp-content/plugins/hooked-demo"],
  ["fixtures/themes/hooked-child", "/wordpress/wp-content/themes/hooked-child"],
  ["fixtures/advanced-cache.php", "/wordpress/wp-content/advanced-cache.php"],
];

export const TRACE_OUT_VFS = "/hooked-out";
