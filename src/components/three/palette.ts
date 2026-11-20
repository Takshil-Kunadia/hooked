import { useSyncExternalStore } from "react";
import { Color } from "three";
import { toneCompensate } from "@/lib/design/tone";

type PaletteId = "day" | "dusk";

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
export const PALETTES: Readonly<Record<PaletteId, Palette>> = {
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
};

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
export function toneCompensated(hex: string): Color {
  const goal = new Color(hex);
  const [r, g, b] = toneCompensate([goal.r, goal.g, goal.b]);
  return new Color(r, g, b);
}

/** `toneCompensated` as a CSS colour, for drawing on a 2D canvas that becomes an sRGB texture. */
export function toneCompensatedCss(hex: string): string {
  return `#${toneCompensated(hex).getHexString()}`;
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
  return PALETTES[useSyncExternalStore(subscribe, currentId, serverId)];
}
