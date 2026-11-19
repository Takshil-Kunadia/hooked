/**
 * Playground blueprints for the traced sites, built from one definition so the sites differ only
 * where they are meant to: the theme, and whether an administrator is logged in.
 */
import { TRACE_OUT_VFS, type SiteSpec } from "./config.ts";

/** Repeatable runs: no update checks, no cron spawns, no outbound HTTP. WP_CACHE loads the demo drop-in. */
const CONSTANTS = {
  step: "defineWpConfigConsts",
  consts: { WP_CACHE: true, DISABLE_WP_CRON: true, AUTOMATIC_UPDATER_DISABLED: true, WP_HTTP_BLOCK_EXTERNAL: true },
};

const PREPARE = `<?php
require '/wordpress/wp-load.php';
// Playground listens on every network interface while a run lasts: replace its well-known admin
// password so nobody else can log in. Our admin trace uses minted cookies instead.
wp_set_password( wp_generate_password( 40, true, true ), 1 );
global $wp_rewrite;
$wp_rewrite->set_permalink_structure( '/%postname%/' );
flush_rewrite_rules();
// A cron spawn during install can leave this lock behind, and wp-cron.php would then skip its jobs.
delete_transient( 'doing_cron' );`;

/**
 * Logs the administrator in the way a browser would be: WordPress's own auth cookies, minted inside
 * this throwaway site and written where the pipeline can read them.
 */
const MINT_ADMIN_COOKIES = `<?php
require '/wordpress/wp-load.php';
$expires = time() + DAY_IN_SECONDS;
$token   = WP_Session_Tokens::get_instance( 1 )->create( $expires );
file_put_contents(
	'${TRACE_OUT_VFS}/admin-cookies.json',
	wp_json_encode(
		array(
			AUTH_COOKIE      => wp_generate_auth_cookie( 1, $expires, 'auth', $token ),
			LOGGED_IN_COOKIE => wp_generate_auth_cookie( 1, $expires, 'logged_in', $token ),
		)
	)
);`;

export const ADMIN_COOKIES_FILE = "admin-cookies.json";

export interface Versions {
  /** An exact release, such as 7.0.9. */
  readonly wp: string;
  readonly php: string;
}

/**
 * The versions go in the blueprint itself: with a blueprint, Playground boots the blueprint's
 * preferredVersions (default "latest") and its --wp flag only changes what it prints.
 */
export function blueprintFor(spec: SiteSpec, versions: Versions): Readonly<Record<string, unknown>> {
  // The parent theme is mounted (tools/wp-data/theme-source.ts); only the switch happens here.
  const classicTheme = spec.classicTheme ? [{ step: "activateTheme", themeFolderName: "hooked-child" }] : [];
  const admin = spec.loggedIn ? [{ step: "runPHP", code: MINT_ADMIN_COOKIES }] : [];
  return {
    $schema: "https://playground.wordpress.net/blueprint-schema.json",
    preferredVersions: { wp: versions.wp, php: versions.php },
    steps: [
      CONSTANTS,
      ...classicTheme,
      { step: "activatePlugin", pluginPath: "hooked-demo/hooked-demo.php" },
      { step: "runPHP", code: PREPARE },
      ...admin,
    ],
  };
}
