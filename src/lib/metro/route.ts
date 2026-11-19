/**
 * The metro map layout (world units, x→right, z→towards the viewer).
 * Kept as plain data so scenes, tests and future chapters share one source.
 */

type XZ = readonly [x: number, z: number];

/** Who added the code: drives the origin colour of feeder lines, tickets and portals. */
export type Origin = "core" | "plugin" | "theme" | "mu" | "dropin";

/** What a line is on the map: the trunk, a feeder line joining it, or a short spur. */
type LineKind = "main" | "feeder" | "spur";

export interface LineSpec {
  readonly id: string;
  readonly kind: LineKind;
  /** Only feeder lines carry an origin colour. */
  readonly origin?: Origin;
  readonly points: ReadonlyArray<XZ>;
  readonly cornerRadius: number;
  readonly width: number;
  /** Sweep resolution along the path; long, curvy lines need more. */
  readonly segments: number;
}

export const MAIN_LINE: LineSpec = {
  id: "main",
  kind: "main",
  points: [
    [-15, -3],
    [-8, -3],
    [-5, 0],
    [6.5, 0],
    [9.5, -3],
    [24, -3],
  ],
  cornerRadius: 1.4,
  width: 0.5,
  segments: 1100,
};

export const FEEDER_LINES: ReadonlyArray<LineSpec> = [
  {
    id: "plugins",
    kind: "feeder",
    origin: "plugin",
    points: [
      [-4.9, 5.4],
      [-4.9, 1.8],
      [-3.7, 0.45],
    ],
    cornerRadius: 0.7,
    width: 0.32,
    segments: 160,
  },
  {
    id: "theme",
    kind: "feeder",
    origin: "theme",
    points: [
      [-1.7, 5.4],
      [-1.7, 1.8],
      [-2.9, 0.45],
    ],
    cornerRadius: 0.7,
    width: 0.32,
    segments: 160,
  },
  {
    id: "depot",
    kind: "spur",
    points: [
      [4.4, 0.3],
      [4.4, 3.6],
    ],
    cornerRadius: 0.5,
    width: 0.26,
    segments: 40,
  },
];
