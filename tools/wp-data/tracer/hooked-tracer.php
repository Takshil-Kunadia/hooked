<?php
/**
 * Hooked tracer.
 *
 * Runs before WordPress: Playground preloads it through PHP's auto_prepend_file. For a request
 * that carries an `X-Hooked-Trace: <scenario>` header it records every action and filter
 * WordPress fires, in order, with the file and line that fired it, plus the callbacks that were
 * listening the first time each hook fired. At the very end of the request it writes
 * /hooked-out/<scenario>.json. Requests without the header are left alone.
 *
 * It listens on the special `all` hook by pre-seeding the $wp_filter global. WordPress turns
 * pre-seeded entries into real hooks when plugin.php loads (WP_Hook::build_preinitialized_hooks),
 * so even the hooks that fire before must-use plugins load are captured.
 *
 * Part of Hooked's data pipeline (tools/wp-data). It only ever runs inside a throwaway Playground.
 *
 * @license GPL-2.0-or-later
 */

final class Hooked_Tracer {
	/** Where dumps go inside Playground (tests point HOOKED_TRACE_OUT_DIR somewhere else). */
	const OUT_DIR = '/hooked-out';

	/** Functions that fire hooks, and the kind of hook each one fires. */
	const FIRERS = array(
		'do_action'                => 'action',
		'do_action_ref_array'      => 'action',
		'do_action_deprecated'     => 'action',
		'apply_filters'            => 'filter',
		'apply_filters_ref_array'  => 'filter',
		'apply_filters_deprecated' => 'filter',
	);

	/** @var string */
	private static $scenario = '';

	/** @var list<array{0:string,1:string,2:?string,3:?int}> [hook, type, call-site file, line] */
	private static $events = array();

	/** @var array<string, list<array{0:string,1:int|string,2:int,3:?string}>> hook => [callback, priority, accepted args, file] */
	private static $listeners = array();

	/** @var bool */
	private static $done = false;

	public static function start( string $scenario ): void {
		self::$scenario = $scenario;

		$GLOBALS['wp_filter']['all'][ PHP_INT_MIN ][] = array(
			'function'      => array( self::class, 'record' ),
			'accepted_args' => 1,
		);

		// A shutdown function added during shutdown runs last, after WordPress's own `shutdown` action.
		register_shutdown_function(
			static function (): void {
				register_shutdown_function( array( self::class, 'write' ) );
			}
		);
	}

	/**
	 * Called by WordPress before every hook it fires.
	 *
	 * @param mixed $hook_name The hook being fired.
	 */
	public static function record( $hook_name ): void {
		if ( self::$done || ! is_string( $hook_name ) ) {
			return;
		}

		$type   = null;
		$file   = null;
		$line   = null;
		$frames = debug_backtrace( DEBUG_BACKTRACE_IGNORE_ARGS, 16 );
		foreach ( $frames as $i => $frame ) {
			$function = $frame['function'];
			if ( isset( $frame['class'] ) || ! isset( self::FIRERS[ $function ] ) ) {
				continue;
			}
			$type = self::FIRERS[ $function ];
			$file = isset( $frame['file'] ) ? self::relative( $frame['file'] ) : null;
			$line = $frame['line'] ?? null;
			// do_action_deprecated() and apply_filters_deprecated() call the plain firers from plugin.php:
			// in that case the real call site belongs to the wrapper, one frame further out.
			$outer = $frames[ $i + 1 ]['function'] ?? '';
			$is_wrapped = 'wp-includes/plugin.php' === $file && in_array( $outer, array( 'do_action_deprecated', 'apply_filters_deprecated' ), true );
			if ( ! $is_wrapped ) {
				break;
			}
		}

		self::$events[] = array( $hook_name, $type ?? 'unknown', $file, $line );

		if ( ! array_key_exists( $hook_name, self::$listeners ) ) {
			self::$listeners[ $hook_name ] = self::listeners( $hook_name );
		}
	}

	public static function write(): void {
		self::$done = true;

		$payload = array(
			'scenario'  => self::$scenario,
			'wp'        => isset( $GLOBALS['wp_version'] ) ? (string) $GLOBALS['wp_version'] : null,
			'php'       => PHP_VERSION,
			'theme'     => function_exists( 'get_stylesheet' ) ? get_stylesheet() : null,
			'events'    => self::$events,
			'listeners' => (object) self::$listeners,
		);

		$json = json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE );
		$dir  = defined( 'HOOKED_TRACE_OUT_DIR' ) ? HOOKED_TRACE_OUT_DIR : self::OUT_DIR;
		$path = $dir . '/' . self::$scenario . '.json';
		if ( false === $json || false === file_put_contents( $path . '.tmp', $json ) || ! rename( $path . '.tmp', $path ) ) {
			error_log( 'Hooked tracer: could not write ' . $path );
		}
	}

	/** @return list<array{0:string,1:int|string,2:int,3:?string}> */
	private static function listeners( string $hook_name ): array {
		$hook = $GLOBALS['wp_filter'][ $hook_name ] ?? null;
		if ( ! $hook instanceof WP_Hook ) {
			return array();
		}
		$out = array();
		foreach ( $hook->callbacks as $priority => $callbacks ) {
			foreach ( $callbacks as $callback ) {
				list( $name, $file ) = self::describe( $callback['function'] );
				$out[]               = array( $name, self::priority( (int) $priority ), (int) $callback['accepted_args'], $file );
			}
		}
		return $out;
	}

	/**
	 * A readable name for a callback and the file it is defined in (null for built-in PHP functions).
	 *
	 * @param mixed $callback Anything add_filter() accepted.
	 * @return array{0:string,1:?string}
	 */
	private static function describe( $callback ): array {
		try {
			if ( $callback instanceof Closure ) {
				return array( '{closure}', self::file_of( new ReflectionFunction( $callback ) ) );
			}
			if ( is_string( $callback ) && false !== strpos( $callback, '::' ) ) {
				list( $class, $method ) = explode( '::', $callback, 2 );
				return array( $callback, self::file_of( new ReflectionMethod( $class, $method ) ) );
			}
			if ( is_string( $callback ) ) {
				return array( $callback, self::file_of( new ReflectionFunction( $callback ) ) );
			}
			if ( is_array( $callback ) && 2 === count( $callback ) ) {
				list( $target, $method ) = array_values( $callback );
				$class                   = self::class_name( is_object( $target ) ? get_class( $target ) : (string) $target );
				$separator               = is_object( $target ) ? '->' : '::';
				return array( $class . $separator . $method, self::file_of( new ReflectionMethod( $target, (string) $method ) ) );
			}
			if ( is_object( $callback ) ) {
				return array( self::class_name( get_class( $callback ) ) . '->__invoke', self::file_of( new ReflectionMethod( $callback, '__invoke' ) ) );
			}
		} catch ( ReflectionException $e ) {
			return array( is_string( $callback ) ? $callback : '{unknown}', null );
		}
		return array( '{unknown}', null );
	}

	/** @param ReflectionFunctionAbstract $reflection */
	private static function file_of( $reflection ): ?string {
		$file = $reflection->getFileName();
		return false === $file ? null : self::relative( $file );
	}

	/** JSON numbers lose precision past 2^53, so the PHP_INT_* extremes travel as their names. */
	private static function priority( int $priority ) {
		if ( PHP_INT_MAX === $priority ) {
			return 'PHP_INT_MAX';
		}
		if ( PHP_INT_MIN === $priority ) {
			return 'PHP_INT_MIN';
		}
		return $priority;
	}

	/** Anonymous classes carry a NUL byte and a path in their name: keep it readable. */
	private static function class_name( string $class ): string {
		return false !== strpos( $class, '@anonymous' ) ? 'class@anonymous' : $class;
	}

	private static function relative( string $path ): string {
		$root = defined( 'ABSPATH' ) ? ABSPATH : '/wordpress/';
		return 0 === strpos( $path, $root ) ? substr( $path, strlen( $root ) ) : $path;
	}
}

$hooked_scenario = isset( $_SERVER['HTTP_X_HOOKED_TRACE'] ) ? (string) $_SERVER['HTTP_X_HOOKED_TRACE'] : '';
if ( 1 === preg_match( '/^[a-z0-9][a-z0-9-]{0,63}$/D', $hooked_scenario ) ) {
	Hooked_Tracer::start( $hooked_scenario );
}
unset( $hooked_scenario );
