import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { MeshBasicMaterial, SphereGeometry, type MeshPhysicalMaterial } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LINE_COLOURS } from "@/lib/design/tokens";
import { physical } from "./map/materials";
import type { Palette } from "./palette";

/*
 * Round 5's `makeCar`: a porcelain body, a continuous glass band with slim window pillars, a blue
 * sill stripe, and on the lead car a dark windscreen with twin headlights. Each part stands a hair
 * proud of the body (0.002–0.015), so no two surfaces coincide.
 */
export const BODY = { w: 0.74, h: 0.62, d: 1.94, segments: 12, radius: 0.3, y: 0.33 } as const;
const GLASS = { w: 0.752, h: 0.2, d: 1.74, segments: 10, radius: 0.1 } as const;
const PILLAR = { w: 0.756, h: 0.196, d: 0.022, segments: 2, radius: 0.008 } as const;
const STRIPE = { w: 0.748, h: 0.032, d: 1.86, segments: 3, radius: 0.016 } as const;
const WINDSCREEN = { w: 0.58, h: 0.24, d: 0.06, segments: 6, radius: 0.06 } as const;
const LAMP = { radius: 0.035, widthSegments: 20, heightSegments: 14 } as const;

/** Where the parts sit inside a car (its origin is on the line, at the car's centre). */
export const CAR_LAYOUT = {
  glassY: 0.44,
  pillarZ: [-0.69, -0.345, 0, 0.345, 0.69],
  stripeY: 0.165,
  windscreenZ: 0.955,
  lamps: [
    [-0.21, 0.2, 0.97],
    [0.21, 0.2, 0.97],
  ],
} as const;

const BODY_WHITE = "#FBFBFC";
const GLASS_TINT = "#1A1E2A";
const LAMP_GLOW = "#fff4cf";

export interface TrainParts {
  readonly body: RoundedBoxGeometry;
  readonly glass: RoundedBoxGeometry;
  readonly pillar: RoundedBoxGeometry;
  readonly stripe: RoundedBoxGeometry;
  readonly windscreen: RoundedBoxGeometry;
  readonly lamp: SphereGeometry;
  readonly bodyMaterial: MeshPhysicalMaterial;
  readonly glassMaterial: MeshPhysicalMaterial;
  readonly stripeMaterial: MeshPhysicalMaterial;
  readonly lampMaterial: MeshBasicMaterial;
}

const box = (b: { w: number; h: number; d: number; segments: number; radius: number }): RoundedBoxGeometry =>
  new RoundedBoxGeometry(b.w, b.h, b.d, b.segments, b.radius);

function createTrainParts(): TrainParts {
  return {
    body: box(BODY),
    glass: box(GLASS),
    pillar: box(PILLAR),
    stripe: box(STRIPE),
    windscreen: box(WINDSCREEN),
    lamp: new SphereGeometry(LAMP.radius, LAMP.widthSegments, LAMP.heightSegments),
    bodyMaterial: physical(BODY_WHITE, { roughness: 0.28, clearcoat: 1 }),
    glassMaterial: physical(GLASS_TINT, { roughness: 0.12, clearcoat: 1 }),
    stripeMaterial: physical(LINE_COLOURS.main, { roughness: 0.3, emissive: LINE_COLOURS.main, emissiveIntensity: 0 }),
    lampMaterial: new MeshBasicMaterial({ color: LAMP_GLOW }),
  };
}

function disposeTrainParts(parts: TrainParts): void {
  Object.values(parts).forEach((part) => part.dispose());
}

/** The stripe glows with the line in Dusk (round 5's `applyPalette`). */
function paintTrainParts(parts: TrainParts, palette: Palette): void {
  parts.stripeMaterial.emissiveIntensity = palette.lineGlow;
}

/** The train's shared geometry and materials: built once, repainted per tile, freed on unmount. */
export function useTrainParts(palette: Palette): TrainParts {
  const invalidate = useThree((s) => s.invalidate);
  const parts = useMemo(() => createTrainParts(), []);
  useEffect(() => () => disposeTrainParts(parts), [parts]);
  useLayoutEffect(() => {
    paintTrainParts(parts, palette);
    invalidate();
  }, [parts, palette, invalidate]);
  return parts;
}
