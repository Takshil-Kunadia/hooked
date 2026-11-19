/**
 * The requests the pipeline traces for every WordPress version. They define what the data calls
 * "true", so changing one is a content decision: regenerate every kept version afterwards.
 *
 * Sites (Playground setups, see tools/wp-data/blueprints.ts):
 * - block:   Twenty Twenty-Five, the default story path
 * - classic: a child theme of Twenty Twenty-One, so "child first, then parent" is real
 * - admin:   the block site, with an administrator's auth cookies on every request
 * Every site also runs a demo must-use plugin, a demo plugin and a do-nothing advanced-cache.php
 * drop-in, so those loading stages appear in the trace.
 */

export type SiteId = "block" | "classic" | "admin";

export interface Scenario {
  readonly id: string;
  readonly site: SiteId;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly body?: string;
  /** Pause between the warm-up and the traced request (lets the one-second demo cron job fall due again). */
  readonly settleMs?: number;
  /** A trace is only accepted with this HTTP status… */
  readonly expectedStatus: number;
  /** …and when these hooks fired (proof the request reached the part of WordPress it is about). */
  readonly mustFire: ReadonlyArray<string>;
  readonly summary: string;
}

const PAGES = [
  ["single", "/hello-world/", "A single blog post"],
  ["home", "/", "The home page (latest posts)"],
  ["page", "/sample-page/", "A page"],
  ["category", "/category/uncategorized/", "A category archive"],
  ["search", "/?s=hello", "Search results"],
  ["404", "/no-such-page/", "A page that does not exist"],
] as const;

const THEMES = [
  ["block", "block theme"],
  ["classic", "classic theme"],
] as const;

export const SCENARIOS: ReadonlyArray<Scenario> = [
  ...THEMES.flatMap(([site, label]) =>
    PAGES.map(([key, path, summary]): Scenario => ({
      id: `${site}-${key}`,
      site,
      method: "GET",
      path,
      expectedStatus: key === "404" ? 404 : 200,
      mustFire: ["template_include", "wp_footer"],
      summary: `${summary}, ${label}`,
    })),
  ),
  {
    id: "rest-posts",
    site: "block",
    method: "GET",
    path: "/wp-json/wp/v2/posts",
    expectedStatus: 200,
    mustFire: ["rest_api_init"],
    summary: "A REST API request",
  },
  {
    id: "ajax-nopriv",
    site: "block",
    method: "POST",
    path: "/wp-admin/admin-ajax.php",
    body: "action=hooked_demo",
    expectedStatus: 200,
    mustFire: ["wp_ajax_nopriv_hooked_demo"],
    summary: "An admin-ajax.php request from a visitor",
  },
  {
    id: "cron",
    site: "block",
    method: "GET",
    path: "/wp-cron.php",
    settleMs: 1500,
    expectedStatus: 200,
    mustFire: ["hooked_demo_cron"],
    summary: "A wp-cron.php run with one job due",
  },
  {
    id: "admin-dashboard",
    site: "admin",
    method: "GET",
    path: "/wp-admin/",
    expectedStatus: 200,
    mustFire: ["admin_init", "admin_footer"],
    summary: "The admin dashboard, logged in",
  },
];

/** Hooks and callbacks our demo fixtures add. They are not part of WordPress. */
const DEMO_PREFIXES = ["hooked_demo", "hooked_child"] as const;

export const isDemoName = (name: string): boolean => DEMO_PREFIXES.some((prefix) => name.startsWith(prefix));
