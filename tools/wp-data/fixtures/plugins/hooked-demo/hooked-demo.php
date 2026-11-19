<?php
/**
 * Plugin Name: Hooked demo
 * Description: Lets the trace show the plugin stage, an AJAX action and a cron event. Made up for Hooked; not part of WordPress.
 * Version: 1.0.0
 * License: GPL-2.0-or-later
 */

defined( 'ABSPATH' ) || exit;

const HOOKED_DEMO_CRON_HOOK = 'hooked_demo_cron';

add_action( 'init', 'hooked_demo_init' );
add_action( 'wp_ajax_hooked_demo', 'hooked_demo_ajax' );
add_action( 'wp_ajax_nopriv_hooked_demo', 'hooked_demo_ajax' );
add_action( HOOKED_DEMO_CRON_HOOK, 'hooked_demo_cron' );
add_filter( 'cron_schedules', 'hooked_demo_cron_schedules' );
register_activation_hook( __FILE__, 'hooked_demo_activate' );

/** A plugin's typical first stop: WordPress is loaded and the user is known. */
function hooked_demo_init(): void {}

/** Answers admin-ajax.php?action=hooked_demo for visitors and logged-in users alike. */
function hooked_demo_ajax(): void {
	wp_send_json_success( array( 'hello' => 'from a plugin' ) );
}

/** The scheduled job; doing nothing is enough for the trace. */
function hooked_demo_cron(): void {}

/**
 * A one-second schedule keeps the demo job due on every wp-cron.php visit.
 *
 * @param array<string, array{interval:int, display:string}> $schedules Registered schedules.
 * @return array<string, array{interval:int, display:string}>
 */
function hooked_demo_cron_schedules( array $schedules ): array {
	return $schedules + array(
		'hooked_every_second' => array(
			'interval' => 1,
			'display'  => 'Every second (Hooked demo)',
		),
	);
}

function hooked_demo_activate(): void {
	if ( ! wp_next_scheduled( HOOKED_DEMO_CRON_HOOK ) ) {
		wp_schedule_event( time(), 'hooked_every_second', HOOKED_DEMO_CRON_HOOK );
	}
}
