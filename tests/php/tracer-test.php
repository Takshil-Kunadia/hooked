<?php
/**
 * Tests for tools/wp-data/tracer/hooked-tracer.php against a tiny stand-in for WordPress's hook API.
 * Run: php tests/php/tracer-test.php (exits non-zero on failure).
 *
 * @license GPL-2.0-or-later
 */

// realpath: PHP reports resolved paths (macOS's /var is a link to /private/var).
$root = realpath( sys_get_temp_dir() ) . '/hooked-tracer-test-' . getmypid() . '/';
@mkdir( $root . 'wp-includes', 0777, true );
@mkdir( $root . 'wp-content/plugins/demo', 0777, true );
define( 'ABSPATH', $root );
define( 'HOOKED_TRACE_OUT_DIR', $root );

// A stand-in for wp-includes/plugin.php: same function names and the same call shapes as core.
file_put_contents(
	$root . 'wp-includes/plugin.php',
	<<<'PHP'
<?php
final class WP_Hook {
	public $callbacks = array();
	public static function build_preinitialized_hooks( $filters ) {
		$out = array();
		foreach ( $filters as $name => $groups ) {
			$hook = new WP_Hook();
			foreach ( $groups as $priority => $callbacks ) {
				foreach ( $callbacks as $cb ) {
					$hook->callbacks[ $priority ][] = $cb;
				}
			}
			$out[ $name ] = $hook;
		}
		return $out;
	}
	public function do_all_hook( &$args ) {
		foreach ( $this->callbacks as $callbacks ) {
			foreach ( $callbacks as $cb ) {
				call_user_func_array( $cb['function'], $args );
			}
		}
	}
	public function run( $args ) {
		$value = $args[0] ?? null;
		foreach ( $this->callbacks as $callbacks ) {
			foreach ( $callbacks as $cb ) {
				$value = call_user_func_array( $cb['function'], array_slice( array_merge( array( $value ), array_slice( $args, 1 ) ), 0, $cb['accepted_args'] ) );
			}
		}
		return $value;
	}
}
function add_filter( $name, $fn, $priority = 10, $accepted_args = 1 ) {
	global $wp_filter;
	if ( ! isset( $wp_filter[ $name ] ) ) {
		$wp_filter[ $name ] = new WP_Hook();
	}
	$wp_filter[ $name ]->callbacks[ $priority ][] = array( 'function' => $fn, 'accepted_args' => $accepted_args );
	ksort( $wp_filter[ $name ]->callbacks );
}
function _wp_call_all_hook( $args ) {
	global $wp_filter;
	$wp_filter['all']->do_all_hook( $args );
}
function _fire( $name, $args ) {
	global $wp_filter;
	return isset( $wp_filter[ $name ] ) ? $wp_filter[ $name ]->run( $args ) : ( $args[0] ?? null );
}
function do_action( $name, ...$arg ) {
	_wp_call_all_hook( func_get_args() );
	_fire( $name, $arg );
}
function do_action_ref_array( $name, $args ) {
	_wp_call_all_hook( array_merge( array( $name ), $args ) );
	_fire( $name, $args );
}
function apply_filters( $name, $value, ...$arg ) {
	_wp_call_all_hook( func_get_args() );
	return _fire( $name, array_merge( array( $value ), $arg ) );
}
function do_action_deprecated( $name, $args, $version ) {
	do_action_ref_array( $name, $args );
}
global $wp_filter;
$wp_filter = WP_Hook::build_preinitialized_hooks( $wp_filter );
PHP
);

// A plugin that fires hooks from known lines.
file_put_contents(
	$root . 'wp-content/plugins/demo/demo.php',
	<<<'PHP'
<?php
function demo_upper( $title ) { return strtoupper( $title ); }
function demo_fire_all() {
	do_action( 'demo_action' );
	$title = apply_filters( 'the_title', 'hello' );
	do_action_deprecated( 'demo_old', array(), '1.0' );
	return $title;
}
function demo_nested() { do_action( 'demo_inner' ); }
function demo_fire_outer() { do_action( 'demo_outer' ); }
PHP
);

$_SERVER['HTTP_X_HOOKED_TRACE'] = 'php-test';
require __DIR__ . '/../../tools/wp-data/tracer/hooked-tracer.php';
require $root . 'wp-includes/plugin.php';
require $root . 'wp-content/plugins/demo/demo.php';

add_filter( 'the_title', 'demo_upper', 20 );
add_filter( 'the_title', 'trim', PHP_INT_MAX );
add_filter( 'demo_outer', 'demo_nested' );
$title = demo_fire_all();
demo_fire_outer();
Hooked_Tracer::write();

$dump     = json_decode( (string) file_get_contents( $root . 'php-test.json' ), true );
$failures = array();
$check    = static function ( string $label, $actual, $expected ) use ( &$failures ): void {
	if ( $actual !== $expected ) {
		$failures[] = $label . "\n    expected " . json_encode( $expected ) . "\n    actual   " . json_encode( $actual );
	}
};

$plugin = 'wp-content/plugins/demo/demo.php';
$check( 'filters still return their value', $title, 'HELLO' );
$check(
	'every hook, in order, with its type and the line that fired it',
	$dump['events'],
	array(
		array( 'demo_action', 'action', $plugin, 4 ),
		array( 'the_title', 'filter', $plugin, 5 ),
		array( 'demo_old', 'action', $plugin, 6 ),
		array( 'demo_outer', 'action', $plugin, 10 ),
		array( 'demo_inner', 'action', $plugin, 9 ),
	)
);
$check(
	'listeners when the hook first fired, with files and PHP_INT_MAX by name',
	$dump['listeners']['the_title'],
	array( array( 'demo_upper', 20, 1, $plugin ), array( 'trim', 'PHP_INT_MAX', 1, null ) )
);
$check( 'hooks without listeners get an empty list', $dump['listeners']['demo_action'], array() );
$check( 'the scenario is recorded', $dump['scenario'], 'php-test' );

array_map( 'unlink', glob( $root . '{,*/,*/*/,*/*/*/}*.*', GLOB_BRACE ) ?: array() );
if ( $failures ) {
	fwrite( STDERR, "✗ tracer tests failed:\n  " . implode( "\n  ", $failures ) . "\n" );
	exit( 1 );
}
echo "✓ tracer: 5 checks passed\n";
