import { useSyncExternalStore } from "react";
import { Color, SRGBColorSpace } from "three";
import { toneCompensate } from "@/lib/design/tone";

type PaletteId = "day" | "dusk";
type MoodId = PaletteId | "mist" | "core";

/** One tile's scene look (round 5's PALETTES, plus the ink its labels are printed in). */
export interface Palette {
  readonly bg: string;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly table: string;
  readonly porcelain: string;
  readonly line: string;
  readonly lineGlow: number;
  readonly env: number;
  readonly key: number;
  readonly keyColor: string;
  readonly hemi: number;
  readonly shadow: number;
  readonly bloom: boolean;
  readonly waiting: string;
  readonly ring: string;
  readonly head: number;
  readonly labelInk: string;
  readonly labelMuted: string;
}

/** Round 5's values, verbatim. Fog distances are for its 52-unit desktop overview (see `fogScale`). */
const PALETTES: Readonly<Record<MoodId, Palette>> = {
  day: {
    bg: "#F5F5F7",
    fogNear: 50,
    fogFar: 110,
    table: "#FFFFFF",
    porcelain: "#F1EFEA",
    line: "#3858E9",
    lineGlow: 0,
    env: 0.85,
    key: 2.5,
    keyColor: "#ffffff",
    hemi: 0.55,
    shadow: 0.16,
    bloom: false,
    waiting: "#AEB3BE",
    ring: "#3858E9",
    head: 0.0,
    labelInk: "#1d1d1f",
    labelMuted: "#6e6e73",
  },
  dusk: {
    bg: "#0E1117",
    fogNear: 40,
    fogFar: 95,
    table: "#161B24",
    porcelain: "#D7DCE5",
    line: "#5B79FF",
    lineGlow: 0.55,
    env: 0.3,
    key: 1.15,
    keyColor: "#A8BBFF",
    hemi: 0.22,
    shadow: 0.42,
    bloom: true,
    waiting: "#4C5466",
    ring: "#8AA4FF",
    head: 1.6,
    labelInk: "#E6E9EF",
    labelMuted: "#8F949D",
  },
  /** The lighting narrative between Day and Dusk: a misty blue morning, so the blend never goes grey. */
  mist: {
    bg: "#CBD5E6",
    fogNear: 46,
    fogFar: 106,
    table: "#E4E9F2",
    porcelain: "#F3F4F8",
    line: "#3858E9",
    lineGlow: 0.12,
    env: 0.72,
    key: 2.1,
    keyColor: "#EEF2FF",
    hemi: 0.46,
    shadow: 0.24,
    bloom: false,
    waiting: "#97A0B3",
    ring: "#3858E9",
    head: 0.4,
    labelInk: "#1d1d1f",
    labelMuted: "#4a5263",
  },
  /** The lighting narrative's dark core (the database, the query): deeper than Dusk, the line glowing. */
  core: {
    bg: "#06070B",
    fogNear: 36,
    fogFar: 90,
    table: "#0B0E14",
    porcelain: "#C4CBD8",
    line: "#6F8BFF",
    lineGlow: 0.9,
    env: 0.2,
    key: 0.85,
    keyColor: "#8EA1FF",
    hemi: 0.14,
    shadow: 0.5,
    bloom: true,
    waiting: "#3A4152",
    ring: "#9DB2FF",
    head: 2.0,
    labelInk: "#E6E9EF",
    labelMuted: "#8F949D",
  },
};

const NUMERIC_KEYS = ["fogNear", "fogFar", "lineGlow", "env", "key", "hemi", "shadow", "head"] as const;
const COLOUR_KEYS = [
  "bg",
  "table",
  "porcelain",
  "line",
  "keyColor",
  "waiting",
  "ring",
  "labelInk",
  "labelMuted",
] as const;

const mixColour = (a: string, b: string, t: number): string => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;

/** A palette `t` of the way from `a` to `b`; bloom switches at the halfway point. */
export function mixPalettes(a: Palette, b: Palette, t: number): Palette {
  const k = Math.min(1, Math.max(0, t));
  const numbers = Object.fromEntries(NUMERIC_KEYS.map((key) => [key, a[key] + (b[key] - a[key]) * k]));
  const colours = Object.fromEntries(COLOUR_KEYS.map((key) => [key, mixColour(a[key], b[key], k)]));
  return { ...a, ...numbers, ...colours, bloom: k < 0.5 ? a.bloom : b.bloom } as Palette;
}

/** The lighting narrative's stops: Day, a misty morning, Dusk, then the dark core. */
const MOOD_STOPS: ReadonlyArray<readonly [number, Palette]> = [
  [0, PALETTES.day],
  [0.25, PALETTES.mist],
  [0.5, PALETTES.dusk],
  [1, PALETTES.core],
];
/** Bloom only once it is dark enough for glow to read as light, not glare. */
const BLOOM_FROM = 0.6;

/** The lighting narrative: 0 is Day, 0.25 mist, 0.5 Dusk and 1 the dark core, with blends between. */
export function moodPalette(mood: number): Palette {
  const m = Math.min(1, Math.max(0, mood));
  let k = 1;
  while (k < MOOD_STOPS.length - 1 && m > MOOD_STOPS[k]![0]) k++;
  const [m0, a] = MOOD_STOPS[k - 1]!;
  const [m1, b] = MOOD_STOPS[k]!;
  return { ...mixPalettes(a, b, (m - m0) / (m1 - m0)), bloom: m >= BLOOM_FROM };
}

/** A soft sky for a palette: its background at the top, tinted towards its line colour lower down. */
export function skyColours(palette: Palette): readonly [top: string, bottom: string] {
  return [palette.bg, mixColour(palette.bg, palette.line, 0.16)];
}

/** Round 5's desktop overview distance, which its fog distances were tuned for. */
const ROUND_5_OVERVIEW_DIST = 52;

/** Scales the fog with the overview distance so the longer line's far end isn't washed out. */
export function fogScale(overviewDist: number): number {
  return overviewDist / ROUND_5_OVERVIEW_DIST;
}

/**
 * The colour to give three.js so that, after the output pass tone-maps it, it shows as `hex`
 * exactly. Used for the background (to match the page) and the ink printed on the map.
 */
export function toneCompensated(hex: string, ceiling = Infinity): Color {
  const goal = new Color(hex);
  const [r, g, b] = toneCompensate([goal.r, goal.g, goal.b], ceiling);
  return new Color(r, g, b);
}

/** A canvas channel can't go above 1, so canvas colours are compensated within that. */
const CANVAS_CEILING = 1;

/**
 * `toneCompensated` as a CSS colour, for drawing on a 2D canvas that becomes an sRGB texture.
 * With an `alpha` below 1 it is an `rgba()` colour.
 */
export function toneCompensatedCss(hex: string, alpha = 1): string {
  const colour = toneCompensated(hex, CANVAS_CEILING);
  if (alpha >= 1) return `#${colour.getHexString()}`;
  const { r, g, b } = colour.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const byte = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${alpha})`;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const currentId = (): PaletteId => (window.matchMedia(DARK_QUERY).matches ? "dusk" : "day");
const serverId = (): PaletteId => "day";

/** Day in a light colour scheme, Dusk in a dark one; follows the system setting live. */
export function usePalette(): Palette {
  return PALETTES[usePaletteId()];
}

/** Whether the system asks for a dark colour scheme ("dusk") or a light one ("day"). */
export function usePaletteId(): PaletteId {
  return useSyncExternalStore(subscribe, currentId, serverId);
}
