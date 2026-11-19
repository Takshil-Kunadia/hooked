/**
 * The few PHP value semantics the hook engine needs: what a value looks like, how PHP turns it
 * into a string, and PHP's fatal errors.
 */

/** A PHP object. Identity matters (closures and `array( $object, 'method' )` callbacks are keyed by it). */
export class PhpObject {
  readonly className: string;

  constructor(className: string) {
    this.className = className;
  }
}

interface PhpAssoc {
  readonly [key: string]: PhpValue;
}

/** Lists are PHP indexed arrays, plain objects are associative arrays. */
export type PhpValue = string | number | boolean | null | PhpObject | ReadonlyArray<PhpValue> | PhpAssoc;

/**
 * Stand-ins for PHP's integer extremes, used as hook priorities. The real values do not fit in a
 * JavaScript number; these keep their order and stay distinct from their neighbours.
 */
export const PHP_INT_MAX = Number.MAX_SAFE_INTEGER;
export const PHP_INT_MIN = Number.MIN_SAFE_INTEGER;

/** A PHP error that would end the request, e.g. ArgumentCountError. */
export class PhpError extends Error {
  readonly phpClass: string;

  constructor(phpClass: string, message: string) {
    super(message);
    this.name = phpClass;
    this.phpClass = phpClass;
  }
}

/** A finite, non-zero double's exact value as decimal digits: value = digits × 10^-scale. */
function exactDecimal(magnitude: number): { digits: string; scale: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, magnitude);
  const bits = view.getBigUint64(0);
  const biased = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
  const power = biased === 0 ? -1074 : biased - 1075;
  if (power >= 0) return { digits: (mantissa << BigInt(power)).toString(), scale: 0 };
  return { digits: (mantissa * 5n ** BigInt(-power)).toString(), scale: -power };
}

const PRECISION = 14;

/** Rounds to PRECISION significant digits, ties to even (PHP's correctly rounded dtoa). */
function significant(magnitude: number): { digits: string; exponent: number } {
  const { digits, scale } = exactDecimal(magnitude);
  let exponent = digits.length - 1 - scale;
  let head = digits.slice(0, PRECISION);
  const rest = digits.slice(PRECISION);
  const tie = rest.startsWith("5") && /^0*$/.test(rest.slice(1));
  // `rest` is a digit string, so comparing it with "5" as text compares it as a number below one.
  const roundUp = tie ? Number(head.at(-1)) % 2 === 1 : rest > "5";
  if (roundUp) {
    head = (BigInt(head) + 1n).toString();
    if (head.length > PRECISION) {
      head = head.slice(0, PRECISION);
      exponent += 1;
    }
  }
  return { digits: head.replace(/0+$/, "") || "0", exponent };
}

/** PHP's float to string (precision=14): scientific below 1e-4 and from 1e14, like "1.0E+25". */
function floatToString(value: number): string {
  if (Number.isNaN(value)) return "NAN";
  if (!Number.isFinite(value)) return value > 0 ? "INF" : "-INF";
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";
  const sign = value < 0 ? "-" : "";
  const { digits, exponent } = significant(Math.abs(value));
  if (exponent < -4 || exponent >= PRECISION) {
    return `${sign}${digits[0] ?? "0"}.${digits.slice(1) || "0"}E${exponent < 0 ? "-" : "+"}${Math.abs(exponent)}`;
  }
  if (exponent < 0) return `${sign}0.${"0".repeat(-exponent - 1)}${digits}`;
  const whole = digits.slice(0, exponent + 1).padEnd(exponent + 1, "0");
  const decimals = digits.slice(exponent + 1);
  return `${sign}${whole}${decimals ? `.${decimals}` : ""}`;
}

/**
 * PHP's (string) cast. Whole numbers in the safe integer range count as PHP ints, other numbers as
 * floats. Arrays become "Array" (PHP also warns); objects without __toString are fatal.
 */
export function toPhpString(value: PhpValue): string {
  if (value === null || value === false) return "";
  if (value === true) return "1";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    // PHP ints have no -0, so -0 can only be a float.
    return Number.isSafeInteger(value) && !Object.is(value, -0) ? String(value) : floatToString(value);
  }
  if (value instanceof PhpObject) {
    throw new PhpError("Error", `Object of class ${value.className} could not be converted to string`);
  }
  return "Array";
}

/** PHP's `.` operator. */
export const concat = (left: PhpValue, right: PhpValue): string => toPhpString(left) + toPhpString(right);
