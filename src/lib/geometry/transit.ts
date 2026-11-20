import {
  BufferGeometry,
  CurvePath,
  Float32BufferAttribute,
  LatheGeometry,
  LineCurve3,
  QuadraticBezierCurve3,
  Vector2,
  type Vector3,
} from "three";

/** A 2D profile point: [offset across the line, height]. */
export type ProfilePoint = readonly [x: number, y: number];

export interface BarProfileOptions {
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly arcSegments: number;
}

/**
 * Cross-section of a transit line: a bar with rounded top corners.
 * Runs from the bottom-left, over the top, to the bottom-right.
 */
export function roundedBarProfile({ width, height, radius, arcSegments }: BarProfileOptions): ProfilePoint[] {
  if (!(width > 0) || !(height > 0)) throw new RangeError("roundedBarProfile() needs a positive width and height");
  if (!(radius >= 0)) throw new RangeError("roundedBarProfile() needs a radius of 0 or more");
  if (!Number.isInteger(arcSegments) || arcSegments < 1) {
    throw new RangeError("roundedBarProfile() needs at least one arc segment");
  }
  const hw = width / 2;
  const r = Math.min(radius, height * 0.62, hw * 0.5);
  const left: ProfilePoint[] = [];
  const right: ProfilePoint[] = [];
  for (let k = 0; k <= arcSegments; k += 1) {
    const a = Math.PI - (k / arcSegments) * (Math.PI / 2);
    left.push([-hw + r + Math.cos(a) * r, height - r + Math.sin(a) * r]);
  }
  for (let k = 0; k <= arcSegments; k += 1) {
    const a = Math.PI / 2 - (k / arcSegments) * (Math.PI / 2);
    right.push([hw - r + Math.cos(a) * r, height - r + Math.sin(a) * r]);
  }
  return [[-hw, 0], ...left, ...right, [hw, 0]];
}

/** A polyline with rounded corners, the way transit maps draw their lines. */
export function buildTransitPath(input: ReadonlyArray<Vector3>, cornerRadius: number): CurvePath<Vector3> {
  /* repeated points would create zero-length curves (and NaN tangents), so drop them */
  const points = input.filter((p, i) => i === 0 || p.distanceToSquared(input[i - 1]!) > 1e-12);
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length < 2 || !first || !last) throw new RangeError("buildTransitPath() needs at least two points");
  const path = new CurvePath<Vector3>();
  let prev = first.clone();
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const inDir = b.clone().sub(a).normalize();
    const outDir = c.clone().sub(b).normalize();
    const r = Math.min(cornerRadius, b.distanceTo(a) / 2, c.distanceTo(b) / 2);
    const p1 = b.clone().addScaledVector(inDir, -r);
    const p2 = b.clone().addScaledVector(outDir, r);
    path.add(new LineCurve3(prev, p1));
    path.add(new QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  path.add(new LineCurve3(prev, last.clone()));
  return path;
}

/**
 * Copies the points with the first one moved back `by` units along the first segment.
 * The scene uses it so a marker at the very start of a line sits on the line, not past its end.
 */
export function extendStart(points: ReadonlyArray<Vector3>, by: number): Vector3[] {
  const [first, second] = points;
  if (!first || !second) throw new RangeError("extendStart() needs at least two points");
  if (!(by >= 0)) throw new RangeError("extendStart() needs a length of 0 or more");
  const back = first.clone().sub(second);
  if (back.lengthSq() < 1e-12) throw new RangeError("extendStart() needs a first segment with a length");
  const start = first.clone().addScaledVector(back.normalize(), by);
  return [start, ...points.slice(1).map((p) => p.clone())];
}

export interface RibbonOptions {
  readonly width: number;
  readonly height: number;
  readonly segments: number;
  readonly arcSegments?: number;
  readonly cornerRadius?: number;
}

/** Sweeps the rounded bar profile along a flat path; vertices are shared so the edges shade smoothly. */
export function ribbonGeometry(path: CurvePath<Vector3>, options: RibbonOptions): BufferGeometry {
  const { width, height, segments, arcSegments = 7, cornerRadius = 0.07 } = options;
  if (!Number.isInteger(segments) || segments < 1) throw new RangeError("ribbonGeometry() needs at least one segment");
  const profile = roundedBarProfile({ width, height, radius: cornerRadius, arcSegments });
  const ring = profile.length;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const p = path.getPointAt(u);
    const t = path.getTangentAt(u);
    const len = Math.hypot(t.z, t.x) || 1;
    const sideX = -t.z / len;
    const sideZ = t.x / len;
    for (const [offset, y] of profile) positions.push(p.x + sideX * offset, y, p.z + sideZ * offset);
  }
  for (let i = 0; i < segments; i += 1) {
    for (let k = 0; k < ring - 1; k += 1) {
      const a = i * ring + k;
      const b = a + 1;
      const c = a + ring;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface EndCapOptions {
  readonly width: number;
  readonly height: number;
  readonly arcSegments?: number;
  readonly cornerRadius?: number;
  readonly radialSegments?: number;
}

/**
 * A rounded end cap for a ribbon: the right half of the bar profile turned half a revolution,
 * so it bulges towards +x only and never overlaps the ribbon it closes.
 */
export function endCapGeometry(options: EndCapOptions): LatheGeometry {
  const { width, height, arcSegments = 7, cornerRadius = 0.07, radialSegments = 28 } = options;
  const profile = roundedBarProfile({ width, height, radius: cornerRadius, arcSegments });
  /* LatheGeometry wants its outline from bottom to top, or its normals point inwards */
  const rightHalf = profile.filter(([x]) => x > 0).reverse();
  const outline = [...rightHalf.map(([x, y]) => new Vector2(x, y)), new Vector2(0, height)];
  return new LatheGeometry(outline, radialSegments, 0, Math.PI);
}

/**
 * Where along a path (0..1 by arc length) the point (x, z) is closest.
 * Sampled, so it is exact to about one sample's spacing.
 */
export function nearestParam(path: CurvePath<Vector3>, x: number, z: number, samples = 2400): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= samples; i += 1) {
    const p = path.getPointAt(i / samples);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  }
  return best / samples;
}
