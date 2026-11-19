<?php
/**
 * Plugin Name: Hooked demo (must-use)
 * Description: Lets the trace show the must-use plugin stage. Made up for Hooked; not part of WordPress.
 * License: GPL-2.0-or-later
 */

defined( 'ABSPATH' ) || exit;

add_action( 'muplugins_loaded', 'hooked_demo_mu_ready' );

/** Runs once every must-use plugin has loaded. */
function hooked_demo_mu_ready(): void {}
