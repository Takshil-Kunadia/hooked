<?php
/**
 * Runs the hook-engine conformance scenarios against real WordPress hook code.
 *
 *   php tools/hook-engine/conformance-runner.php <dir holding wp-includes/plugin.php> <scenarios.json>
 *
 * Prints {"<scenario id>": [log entry, …], …} as JSON on stdout. The TypeScript port must record
 * exactly the same log for every scenario (tools/hook-engine/conformance.test.ts). The step
 * language is documented in docs/hook-engine.md.
 *
 * Any PHP warning or notice aborts the run: real WordPress code should never raise one here, and a
 * scenario that makes it do so needs a closer look rather than a recorded answer.
 */

if ( 3 !== $argc ) {
	fwrite( STDERR, "Usage: php conformance-runner.php <wp-includes dir> <scenarios.json>\n" );
	exit( 2 );
}

set_error_handler(
	static function ( $severity, $message, $file, $line ) {
		throw new ErrorException( $message, 0, $severity, $file, $line );
	}
);

require rtrim( $argv[1], '/' ) . '/plugin.php';

/** An object that answers any method call, so `array( $object, 'name' )` callbacks can be recorded. */
final class Hooked_Target {
	public function __construct( public readonly string $label ) {}

	public function __call( $method, $args ) {
		return Hooked_Conformance::invoke( Hooked_Conformance::method_label( $this, $method ), $args );
	}
}

/** Static callbacks: `array( 'HookedStatic', 'label' )` or the string `'HookedStatic::label'`. */
final class HookedStatic {
	public static function __callStatic( $method, $args ) {
		return Hooked_Conformance::invoke( $method, $args );
	}
}

final class Hooked_Conformance {
	private const LABEL            = '/^[a-z][a-z0-9_]*$/D';
	private const FUNCTION_PREFIX  = 'hooked_cb_';
	private const STATIC_PREFIX    = 'HookedStatic::';

	/** @var list<array> */
	private static array $log = array();
	/** @var array<string, array> */
	private static array $specs = array();
	/** @var array<string, int> */
	private static array $depth = array();
	/** @var array<string, Hooked_Target> */
	private static array $objects = array();
	/** @var array<string, Closure> */
	private static array $closures = array();
	/** @var array<string, string> object label + "\0" + method => callback label */
	private static array $methods = array();

	public static function run( array $scenario ): array {
		global $wp_filter, $wp_actions, $wp_filters, $wp_current_filter;
		$wp_filter         = array();
		$wp_actions        = array();
		$wp_filters        = array();
		$wp_current_filter = array();

		self::$log      = array();
		self::$specs    = $scenario['callbacks'] ?: array();
		self::$depth    = array();
		self::$objects  = array();
		self::$closures = array();
		self::$methods  = array();

		foreach ( self::$specs as $label => $spec ) {
			self::declare_callback( (string) $label, $spec );
		}
		foreach ( $scenario['steps'] as $step ) {
			self::exec( $step, null, null );
		}
		return self::$log;
	}

	private static function declare_callback( string $label, array $spec ): void {
		if ( ! preg_match( self::LABEL, $label ) ) {
			throw new InvalidArgumentException( "Bad callback label: $label" );
		}
		switch ( $spec['kind'] ?? 'function' ) {
			case 'function':
				if ( ! function_exists( self::FUNCTION_PREFIX . $label ) ) {
					// The label is checked against self::LABEL above, so this defines a plain dispatcher.
					eval( sprintf( 'function %s%s( ...$args ) { return Hooked_Conformance::invoke( %s, $args ); }', self::FUNCTION_PREFIX, $label, var_export( $label, true ) ) );
				}
				break;
			case 'closure':
				self::$closures[ $label ] = static function ( ...$args ) use ( $label ) {
					return Hooked_Conformance::invoke( $label, $args );
				};
				break;
			case 'method':
				$key = $spec['object'] . "\0" . ( $spec['method'] ?? $label );
				if ( isset( self::$methods[ $key ] ) ) {
					throw new InvalidArgumentException( "Two callbacks share the method $key" );
				}
				self::$methods[ $key ] = $label;
				break;
			case 'static':
				break;
			default:
				throw new InvalidArgumentException( "Unknown callback kind for $label" );
		}
	}

	public static function method_label( Hooked_Target $target, string $method ): string {
		return self::$methods[ $target->label . "\0" . $method ];
	}

	private static function object( string $label ): Hooked_Target {
		return self::$objects[ $label ] ??= new Hooked_Target( $label );
	}

	/** The PHP callable for a callback label, optionally forcing a static callback's string or array form. */
	private static function callable( $ref ) {
		[ $label, $form ] = is_array( $ref ) ? $ref : array( $ref, null );
		$spec             = self::$specs[ $label ];
		switch ( $spec['kind'] ?? 'function' ) {
			case 'function':
				return self::FUNCTION_PREFIX . $label;
			case 'closure':
				return self::$closures[ $label ];
			case 'method':
				return array( self::object( $spec['object'] ), $spec['method'] ?? $label );
			default:
				return 'string' === ( $form ?? $spec['form'] ?? 'array' ) ? self::STATIC_PREFIX . $label : array( 'HookedStatic', $label );
		}
	}

	private static function label_of( $callback ): string {
		if ( is_string( $callback ) ) {
			return str_starts_with( $callback, self::FUNCTION_PREFIX )
				? substr( $callback, strlen( self::FUNCTION_PREFIX ) )
				: substr( $callback, strlen( self::STATIC_PREFIX ) );
		}
		if ( $callback instanceof Closure ) {
			return (string) array_search( $callback, self::$closures, true );
		}
		return $callback[0] instanceof Hooked_Target ? self::method_label( $callback[0], $callback[1] ) : $callback[1];
	}

	public static function invoke( string $label, array $args ) {
		self::$log[]           = array( 'call', $label, self::export( $args ) );
		self::$depth[ $label ] = ( self::$depth[ $label ] ?? 0 ) + 1;
		$value                 = $args[0] ?? null;
		foreach ( self::$specs[ $label ]['body'] ?? array() as $step ) {
			$value = self::exec( $step, $value, $args, $label );
		}
		--self::$depth[ $label ];
		return $value;
	}

	private static function priority( $value ) {
		return match ( $value ) {
			'PHP_INT_MAX' => PHP_INT_MAX,
			'PHP_INT_MIN' => PHP_INT_MIN,
			default       => $value,
		};
	}

	/** JSON cannot carry PHP_INT_MAX exactly, so the extremes are written as their names. */
	private static function export_priority( $value ) {
		return match ( $value ) {
			PHP_INT_MAX => 'PHP_INT_MAX',
			PHP_INT_MIN => 'PHP_INT_MIN',
			default     => $value,
		};
	}

	/** Turns {"object": "label"} into that scenario's object; everything else stays as decoded. */
	private static function hydrate( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		if ( array( 'object' ) === array_keys( $value ) ) {
			return self::object( $value['object'] );
		}
		return array_map( array( self::class, 'hydrate' ), $value );
	}

	private static function export( $value ) {
		if ( $value instanceof Hooked_Target ) {
			return array( 'object' => $value->label );
		}
		return is_array( $value ) ? array_map( array( self::class, 'export' ), $value ) : $value;
	}

	private static function dump( string $hook ): ?array {
		global $wp_filter;
		if ( ! isset( $wp_filter[ $hook ] ) ) {
			return null;
		}
		$out = array();
		foreach ( $wp_filter[ $hook ]->callbacks as $priority => $callbacks ) {
			$row = array();
			foreach ( $callbacks as $callback ) {
				$row[] = array( self::label_of( $callback['function'] ), $callback['accepted_args'] );
			}
			$out[] = array( self::export_priority( $priority ), $row );
		}
		return $out;
	}

	private static function rest( array $step, int $from ): array {
		return array_map( array( self::class, 'hydrate' ), array_slice( $step, $from ) );
	}

	/** Step name => handler method. Each mirrors a handler in conformance.test.ts. */
	private const STEPS = array(
		'add'          => 'step_add',
		'remove'       => 'step_remove',
		'remove-all'   => 'step_remove_all',
		'apply'        => 'step_apply',
		'append-apply' => 'step_append_apply',
		'apply-ref'    => 'step_apply_ref',
		'do'           => 'step_do',
		'do-ref'       => 'step_do_ref',
		'has'          => 'step_has',
		'did'          => 'step_did',
		'state'        => 'step_state',
		'doing'        => 'step_doing',
		'priority'     => 'step_priority',
		'dump'         => 'step_dump',
		'append'       => 'step_append',
		'set'          => 'step_set',
		'set-arg'      => 'step_set_arg',
		'once'         => 'step_once',
	);

	/**
	 * Runs one step. Inside a callback, $value is the callback's working value and the return value
	 * replaces it; at the top level both are null.
	 */
	private static function exec( array $step, $value, ?array $args, ?string $label = null ) {
		$handler = self::STEPS[ $step[0] ] ?? throw new InvalidArgumentException( "Unknown step: {$step[0]}" );
		return self::$handler( $step, $value, $args, $label );
	}

	private static function has( array $step, int $i ): bool {
		return array_key_exists( $i, $step );
	}

	private static function step_add( array $step, $value ) {
		$priority = self::has( $step, 3 ) ? self::priority( $step[3] ) : 10;
		add_filter( $step[1], self::callable( $step[2] ), $priority, self::has( $step, 4 ) ? $step[4] : 1 );
		return $value;
	}

	private static function step_remove( array $step, $value ) {
		$removed     = remove_filter( $step[1], self::callable( $step[2] ), self::has( $step, 3 ) ? self::priority( $step[3] ) : 10 );
		self::$log[] = array( 'remove', $step[1], $step[2], $removed );
		return $value;
	}

	private static function step_remove_all( array $step, $value ) {
		remove_all_filters( $step[1], self::has( $step, 2 ) ? $step[2] : false );
		return $value;
	}

	private static function apply( array $step ) {
		$result      = apply_filters( $step[1], self::hydrate( $step[2] ), ...self::rest( $step, 3 ) );
		self::$log[] = array( 'applied', $step[1], self::export( $result ) );
		return $result;
	}

	private static function step_apply( array $step, $value ) {
		self::apply( $step );
		return $value;
	}

	private static function step_append_apply( array $step, $value ) {
		return $value . self::apply( $step );
	}

	private static function step_apply_ref( array $step, $value ) {
		$result      = apply_filters_ref_array( $step[1], self::hydrate( $step[2] ) );
		self::$log[] = array( 'applied', $step[1], self::export( $result ) );
		return $value;
	}

	private static function step_do( array $step, $value ) {
		self::$log[] = array( 'do', $step[1] );
		do_action( $step[1], ...self::rest( $step, 2 ) );
		return $value;
	}

	private static function step_do_ref( array $step, $value ) {
		self::$log[] = array( 'do', $step[1] );
		do_action_ref_array( $step[1], self::hydrate( $step[2] ) );
		return $value;
	}

	private static function step_has( array $step, $value ) {
		if ( null === $step[2] ) {
			$result = has_filter( $step[1] );
		} elseif ( self::has( $step, 3 ) ) {
			$result = has_filter( $step[1], self::callable( $step[2] ), $step[3] );
		} else {
			$result = has_filter( $step[1], self::callable( $step[2] ) );
		}
		self::$log[] = array( 'has', $step[1], $step[2], self::export_priority( $result ) );
		return $value;
	}

	private static function step_did( array $step, $value ) {
		self::$log[] = array( 'did', $step[1], did_action( $step[1] ), did_filter( $step[1] ) );
		return $value;
	}

	private static function step_state( array $step, $value ) {
		global $wp_current_filter;
		self::$log[] = array( 'state', current_filter(), doing_filter(), $wp_current_filter );
		return $value;
	}

	private static function step_doing( array $step, $value ) {
		self::$log[] = array( 'doing', $step[1], doing_filter( $step[1] ) );
		return $value;
	}

	private static function step_priority( array $step, $value ) {
		global $wp_filter;
		$priority    = isset( $wp_filter[ $step[1] ] ) ? $wp_filter[ $step[1] ]->current_priority() : null;
		self::$log[] = array( 'priority', $step[1], self::export_priority( $priority ) );
		return $value;
	}

	private static function step_dump( array $step, $value ) {
		self::$log[] = array( 'dump', $step[1], self::dump( $step[1] ) );
		return $value;
	}

	private static function step_append( array $step, $value ) {
		return $value . $step[1];
	}

	private static function step_set( array $step ) {
		return self::hydrate( $step[1] );
	}

	private static function step_set_arg( array $step, $value, ?array $args ) {
		return $args[ $step[1] ] ?? null;
	}

	private static function step_once( array $step, $value, ?array $args, ?string $label ) {
		return 1 === self::$depth[ $label ] ? self::exec( $step[1], $value, $args, $label ) : $value;
	}
}

$scenarios = json_decode( file_get_contents( $argv[2] ), true, 512, JSON_THROW_ON_ERROR )['scenarios'];
$results   = array();
foreach ( $scenarios as $scenario ) {
	$results[ $scenario['id'] ] = Hooked_Conformance::run( $scenario );
}
echo json_encode( $results, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ), "\n";
