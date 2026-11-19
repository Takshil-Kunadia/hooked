<?php
/**
 * Child themes load first, so this runs before Twenty Twenty-One's own setup on the same hook.
 *
 * @license GPL-2.0-or-later
 */

defined( 'ABSPATH' ) || exit;

add_action( 'after_setup_theme', 'hooked_child_setup' );

function hooked_child_setup(): void {}
