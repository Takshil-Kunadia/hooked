import { describe, expect, it } from "vitest";
import { concat, PhpError, PhpObject, toPhpString } from "./php.ts";

describe("toPhpString", () => {
  it.each([
    [null, ""],
    [true, "1"],
    [false, ""],
    [5, "5"],
    [-12, "-12"],
    [1.5, "1.5"],
    ["café", "café"],
    [["a"], "Array"],
    [{ key: "v" }, "Array"],
  ] as const)("casts %j like PHP's (string) cast", (value, expected) => {
    expect(toPhpString(value)).toBe(expected);
  });

  it.each([
    [0.1 + 0.2, "0.3"],
    [1 / 3, "0.33333333333333"],
    [1e25, "1.0E+25"],
    [1.5e-7, "1.5E-7"],
    [0.0001, "0.0001"],
    [0.00001, "1.0E-5"],
    [123456.789, "123456.789"],
    [1e13 + 0.5, "10000000000000"],
    [99.99 * 3, "299.97"],
    [7e-10, "7.0E-10"],
    [10000000000001.5, "10000000000002"],
    [10000000000002.5, "10000000000002"],
    [0.000099999999999999999, "0.0001"],
    [99999999999999.99, "1.0E+14"],
    [5e-324, "4.9406564584125E-324"],
    [1.7976931348623157e308, "1.7976931348623E+308"],
    [-123.456, "-123.456"],
    [-0, "-0"],
    [Number.POSITIVE_INFINITY, "INF"],
    [Number.NEGATIVE_INFINITY, "-INF"],
    [Number.NaN, "NAN"],
  ])("casts the float %s like PHP (14 significant digits)", (value, expected) => {
    expect(toPhpString(value)).toBe(expected);
  });

  it("treats whole numbers in the safe integer range as PHP ints", () => {
    expect(toPhpString(2.5e15)).toBe("2500000000000000");
  });

  it("refuses objects, like PHP does for objects without __toString", () => {
    expect(() => toPhpString(new PhpObject("WP_Post"))).toThrow(
      new PhpError("Error", "Object of class WP_Post could not be converted to string"),
    );
  });
});

describe("concat", () => {
  it("joins like PHP's . operator, so null and false vanish and true becomes 1", () => {
    expect(concat(null, "x")).toBe("x");
    expect(concat("a", null)).toBe("a");
    expect(concat(5, true)).toBe("51");
    expect(concat(false, 0)).toBe("0");
  });
});

describe("PhpError", () => {
  it("carries the PHP error class so the Lab can show a real fatal error", () => {
    const error = new PhpError("ArgumentCountError", "strtoupper() expects exactly 1 argument, 2 given");
    expect(error).toBeInstanceOf(Error);
    expect(error.phpClass).toBe("ArgumentCountError");
    expect(error.name).toBe("ArgumentCountError");
    expect(error.message).toBe("strtoupper() expects exactly 1 argument, 2 given");
  });
});
