import { Vector3, type CurvePath } from "three";
import { buildTransitPath, extendStart } from "@/lib/geometry/transit";
import { MAIN_LINE, type LineSpec } from "@/lib/metro/route";

/**
 * `browser` sits on the main line's very first point. Starting the drawn line a little earlier
 * keeps its marker on the line instead of hanging past the rounded end (the data stays put).
 */
const MAIN_START_EXTENSION = 0.6;

export const linePoints = (spec: LineSpec): Vector3[] => spec.points.map(([x, z]) => new Vector3(x, 0, z));

let mainPath: CurvePath<Vector3> | null = null;

/**
 * The main line as drawn. The map sweeps its ribbon along it and the train rides it, so the two
 * always agree. Built once: it is plain curve data, with no GPU resources to free.
 */
export function mainLinePath(): CurvePath<Vector3> {
  mainPath ??= buildTransitPath(extendStart(linePoints(MAIN_LINE), MAIN_START_EXTENSION), MAIN_LINE.cornerRadius);
  return mainPath;
}
