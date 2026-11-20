import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import {
  buildTransitPath,
  endCapGeometry,
  extendStart,
  nearestParam,
  ribbonGeometry,
  roundedBarProfile,
} from "./transit";

describe("roundedBarProfile", () => {
  const profile = roundedBarProfile({ width: 0.5, height: 0.12, radius: 0.06, arcSegments: 6 });

  it("starts at the bottom-left and ends at the bottom-right", () => {
    expect(profile[0]).toEqual([-0.25, 0]);
    expect(profile[profile.length - 1]).toEqual([0.25, 0]);
  });

  it("never goes above the bar height", () => {
    const maxY = Math.max(...profile.map(([, y]) => y));
    expect(maxY).toBeCloseTo(0.12);
  });

  it("is mirror-symmetric", () => {
    const n = profile.length;
    profile.forEach(([x, y], i) => {
      const [mx, my] = profile[n - 1 - i] ?? [Number.NaN, Number.NaN];
      expect(x).toBeCloseTo(-mx);
      expect(y).toBeCloseTo(my);
    });
  });

  it("caps the corner radius so it fits the bar", () => {
    const tight = roundedBarProfile({ width: 0.1, height: 0.04, radius: 1, arcSegments: 4 });
    expect(Math.max(...tight.map(([, y]) => y))).toBeCloseTo(0.04);
    expect(tight[0]).toEqual([-0.05, 0]);
  });
});

describe("buildTransitPath", () => {
  const points = [new Vector3(0, 0, 0), new Vector3(4, 0, 0), new Vector3(7, 0, 3)];
  const path = buildTransitPath(points, 1);

  it("passes through the first and last points", () => {
    expect(path.getPointAt(0).distanceTo(points[0]!)).toBeLessThan(1e-6);
    expect(path.getPointAt(1).distanceTo(points[2]!)).toBeLessThan(1e-6);
  });

  it("rounds corners, so it is shorter than the raw polyline", () => {
    const polyline = points[0]!.distanceTo(points[1]!) + points[1]!.distanceTo(points[2]!);
    expect(path.getLength()).toBeLessThan(polyline);
    expect(path.getLength()).toBeGreaterThan(polyline * 0.95);
  });

  it("rejects fewer than two points", () => {
    expect(() => buildTransitPath([new Vector3()], 1)).toThrow(/at least two points/);
  });
});

describe("ribbonGeometry", () => {
  const path = buildTransitPath([new Vector3(0, 0, 0), new Vector3(10, 0, 0)], 1);
  const geo = ribbonGeometry(path, { width: 0.5, height: 0.12, segments: 20, arcSegments: 4 });

  it("creates one ring of profile vertices per segment boundary", () => {
    const profileLength = roundedBarProfile({ width: 0.5, height: 0.12, radius: 0.07, arcSegments: 4 }).length;
    expect(geo.getAttribute("position").count).toBe(21 * profileLength);
  });

  it("has an upward-facing top surface", () => {
    const pos = geo.getAttribute("position");
    const normal = geo.getAttribute("normal");
    let checked = 0;
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getY(i) - 0.12) < 1e-6) {
        expect(normal.getY(i)).toBeGreaterThan(0.9);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("has outward-facing side walls", () => {
    const pos = geo.getAttribute("position");
    const normal = geo.getAttribute("normal");
    for (let i = 0; i < pos.count; i += 1) {
      if (pos.getY(i) === 0) expect(Math.sign(normal.getZ(i))).toBe(Math.sign(pos.getZ(i)));
    }
  });
});

describe("input guards", () => {
  it("rejects a profile without arc segments or with negative sizes", () => {
    expect(() => roundedBarProfile({ width: 0.5, height: 0.1, radius: 0.05, arcSegments: 0 })).toThrow(RangeError);
    expect(() => roundedBarProfile({ width: -1, height: 0.1, radius: 0.05, arcSegments: 4 })).toThrow(RangeError);
    expect(() => roundedBarProfile({ width: 0.5, height: 0.1, radius: -0.05, arcSegments: 4 })).toThrow(RangeError);
  });

  it("rejects a ribbon with no segments", () => {
    const path = buildTransitPath([new Vector3(0, 0, 0), new Vector3(1, 0, 0)], 1);
    expect(() => ribbonGeometry(path, { width: 0.5, height: 0.1, segments: 0 })).toThrow(RangeError);
  });

  it("ignores repeated points instead of producing NaN tangents", () => {
    const path = buildTransitPath(
      [new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(3, 0, 0), new Vector3(3, 0, 0), new Vector3(3, 0, 3)],
      1,
    );
    for (let u = 0; u <= 1; u += 0.1) {
      const t = path.getTangentAt(u);
      expect(Number.isFinite(t.x) && Number.isFinite(t.z)).toBe(true);
    }
  });

  it("rejects a path whose points all coincide", () => {
    expect(() => buildTransitPath([new Vector3(1, 0, 1), new Vector3(1, 0, 1)], 1)).toThrow(/at least two points/);
  });
});

describe("nearestParam", () => {
  const straight = buildTransitPath([new Vector3(0, 0, 0), new Vector3(10, 0, 0)], 1);
  it("returns 0, 0.5 and 1 along a straight path", () => {
    expect(nearestParam(straight, 0, 0)).toBeCloseTo(0, 3);
    expect(nearestParam(straight, 5, 1)).toBeCloseTo(0.5, 3);
    expect(nearestParam(straight, 10, 0)).toBeCloseTo(1, 3);
  });
  it("is monotonic along a bent path", () => {
    const bent = buildTransitPath([new Vector3(0, 0, 0), new Vector3(5, 0, 0), new Vector3(8, 0, 3)], 1);
    let last = -1;
    for (let i = 0; i <= 20; i += 1) {
      const p = bent.getPointAt(i / 20);
      const u = nearestParam(bent, p.x, p.z);
      expect(u).toBeGreaterThanOrEqual(last);
      last = u;
    }
  });
});

describe("extendStart", () => {
  it("moves the first point back along the first segment", () => {
    const out = extendStart([new Vector3(-21, 0, -3), new Vector3(-8, 0, -3), new Vector3(-5, 0, 0)], 0.6);
    expect(out[0]!.x).toBeCloseTo(-21.6, 9);
    expect(out[0]!.z).toBeCloseTo(-3, 9);
    expect(out[1]!.toArray()).toEqual([-8, 0, -3]);
  });

  it("follows a diagonal first segment", () => {
    const [first] = extendStart([new Vector3(0, 0, 0), new Vector3(3, 0, 4)], 5);
    expect(first!.x).toBeCloseTo(-3, 9);
    expect(first!.z).toBeCloseTo(-4, 9);
  });

  it("returns new vectors and leaves the input alone", () => {
    const input = [new Vector3(0, 0, 0), new Vector3(1, 0, 0)];
    const out = extendStart(input, 1);
    expect(out[0]).not.toBe(input[0]);
    expect(out[1]).not.toBe(input[1]);
    expect(input[0]!.toArray()).toEqual([0, 0, 0]);
  });

  it("rejects fewer than two points or a negative length", () => {
    expect(() => extendStart([new Vector3()], 1)).toThrow(RangeError);
    expect(() => extendStart([new Vector3(), new Vector3(1, 0, 0)], -1)).toThrow(RangeError);
  });

  it("rejects a zero-length first segment", () => {
    expect(() => extendStart([new Vector3(), new Vector3()], 1)).toThrow(RangeError);
  });
});

describe("endCapGeometry", () => {
  const cap = endCapGeometry({ width: 0.5, height: 0.12 });
  const position = cap.getAttribute("position");

  it("is a half dome that only bulges towards +x", () => {
    for (let i = 0; i < position.count; i += 1) expect(position.getX(i)).toBeGreaterThanOrEqual(-1e-9);
  });

  it("matches the ribbon's half-width and height", () => {
    let maxRadius = 0;
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < position.count; i += 1) {
      maxRadius = Math.max(maxRadius, Math.hypot(position.getX(i), position.getZ(i)));
      maxY = Math.max(maxY, position.getY(i));
      minY = Math.min(minY, position.getY(i));
    }
    expect(maxRadius).toBeCloseTo(0.25, 6);
    expect(maxY).toBeCloseTo(0.12, 6);
    expect(minY).toBeCloseTo(0, 6);
  });

  it("has normals that face out of the dome, so it shades like the ribbon", () => {
    const normal = cap.getAttribute("normal");
    for (let i = 0; i < position.count; i += 1) {
      const outward = position.getX(i) * normal.getX(i) + position.getZ(i) * normal.getZ(i);
      expect(normal.getY(i) >= -1e-6 && outward >= -1e-6).toBe(true);
    }
  });
});
