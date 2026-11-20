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
    [-21, -3],
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

export type StationId =
  | "browser"
  | "server"
  | "php"
  | "index"
  | "config"
  | "settings"
  | "init"
  | "query"
  | "template"
  | "the_title"
  | "response";

export interface Station {
  readonly id: StationId;
  readonly title: string;
  readonly sub: string;
  readonly x: number;
  readonly z: number;
  /** Which side of the line the label sits on (-1 behind it, 1 in front). */
  readonly labelSide: -1 | 1;
  /** Platform length, when it differs from the default. */
  readonly len?: number;
  readonly featured?: boolean;
  /** The explainer name a hover card looks up. */
  readonly card: string;
}

/** Every station, in travel order. */
export const STATIONS: ReadonlyArray<Station> = [
  {
    id: "browser",
    title: "your browser",
    sub: "start & finish",
    x: -21,
    z: -3,
    labelSide: -1,
    len: 1.3,
    card: "browser",
  },
  { id: "server", title: "web server", sub: "nginx or Apache", x: -18, z: -3, labelSide: 1, card: "web server" },
  { id: "php", title: "PHP", sub: "runs the code", x: -15, z: -3, labelSide: -1, card: "PHP" },
  { id: "index", title: "index.php", sub: "front door", x: -12, z: -3, labelSide: 1, card: "index.php" },
  { id: "config", title: "wp-config.php", sub: "control room", x: -9, z: -3, labelSide: -1, card: "wp-config.php" },
  {
    id: "settings",
    title: "wp-settings.php",
    sub: "interchange",
    x: -3.3,
    z: 0,
    labelSide: -1,
    len: 1.5,
    card: "wp-settings.php",
  },
  {
    id: "init",
    title: "init",
    sub: "do_action( 'init' )",
    x: 0.8,
    z: 0,
    labelSide: -1,
    featured: true,
    card: "init",
  },
  { id: "query", title: "WP_Query", sub: "to the depot", x: 4.4, z: 0, labelSide: -1, card: "WP_Query" },
  { id: "template", title: "template", sub: "junction", x: 10.6, z: -3, labelSide: 1, card: "template" },
  { id: "the_title", title: "the_title", sub: "filter workshop", x: 13.2, z: -3, labelSide: -1, card: "the_title" },
  {
    id: "response",
    title: "200 OK",
    sub: "back to your browser",
    x: 22.4,
    z: -3,
    labelSide: -1,
    len: 1.3,
    card: "200 OK",
  },
];

export function stationById(id: StationId): Station {
  const station = STATIONS.find((s) => s.id === id);
  if (!station) throw new RangeError(`Unknown station: ${id}`);
  return station;
}

/** Where the depot (the database vault) stands, at the end of the WP_Query spur. */
export const DEPOT = { x: 4.4, z: 4.6 } as const;

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
    id: "mu",
    kind: "feeder",
    origin: "mu",
    points: [
      [-6.1, 5.4],
      [-6.1, 1.8],
      [-4.5, 0.45],
    ],
    cornerRadius: 0.7,
    width: 0.32,
    segments: 160,
  },
  {
    id: "dropins",
    kind: "feeder",
    origin: "dropin",
    points: [
      [-0.5, 5.4],
      [-0.5, 1.8],
      [-2.1, 0.45],
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
