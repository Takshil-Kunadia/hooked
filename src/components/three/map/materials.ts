import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { DoubleSide, MeshPhysicalMaterial, type MeshPhysicalMaterialParameters } from "three";
import { LINE_COLOURS, ORIGIN_COLOURS } from "@/lib/design/tokens";
import type { Origin } from "@/lib/metro/route";
import type { Palette } from "../palette";

/** Round 5's ink outline and the blue that marks the current stop and the depot's light slits. */
const INK = "#2B2D33";
const ACCENT = "#3858E9";
const STATION_WHITE = "#FFFFFF";
const SLIT_GLOW = 0.3;

/** The shared materials of the map; colours that follow the tile are set by `paintMapMaterials`. */
export interface MapMaterials {
  readonly porcelain: MeshPhysicalMaterial;
  readonly ink: MeshPhysicalMaterial;
  readonly accent: MeshPhysicalMaterial;
  readonly stationWhite: MeshPhysicalMaterial;
  readonly line: MeshPhysicalMaterial;
  readonly spur: MeshPhysicalMaterial;
  readonly slit: MeshPhysicalMaterial;
  readonly origin: Readonly<Record<Origin, MeshPhysicalMaterial>>;
}

/** Round 5's `mat()`: porcelain-like physical material with a soft clearcoat. */
export const physical = (color: string, extra: MeshPhysicalMaterialParameters = {}): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, ...extra });

const ORIGINS = Object.keys(ORIGIN_COLOURS) as Origin[];

function createMapMaterials(): MapMaterials {
  return {
    porcelain: physical("#ffffff"),
    ink: physical(INK, { roughness: 0.35 }),
    accent: physical(ACCENT, { roughness: 0.3, emissive: ACCENT, emissiveIntensity: 0 }),
    stationWhite: physical(STATION_WHITE, { roughness: 0.28, clearcoat: 0.9 }),
    line: physical("#ffffff", { roughness: 0.32, side: DoubleSide }),
    spur: physical(LINE_COLOURS.spur, { roughness: 0.5, side: DoubleSide }),
    slit: physical(ACCENT, { emissive: ACCENT, emissiveIntensity: SLIT_GLOW }),
    origin: Object.fromEntries(
      ORIGINS.map((o) => [o, physical(ORIGIN_COLOURS[o], { roughness: 0.35, side: DoubleSide })]),
    ) as Record<Origin, MeshPhysicalMaterial>,
  };
}

/** Round 5's `applyPalette()`, for the map's materials. */
function paintMapMaterials(m: MapMaterials, palette: Palette): void {
  m.porcelain.color.set(palette.porcelain);
  m.line.color.set(palette.line);
  m.line.emissive.set(palette.line);
  m.line.emissiveIntensity = palette.lineGlow;
}

function disposeMapMaterials(m: MapMaterials): void {
  const { origin, ...rest } = m;
  [...Object.values(rest), ...Object.values(origin)].forEach((material) => material.dispose());
}

/** Creates the map's materials once, repaints them when the tile changes, and frees them on unmount. */
export function useMapMaterials(palette: Palette): MapMaterials {
  const invalidate = useThree((s) => s.invalidate);
  const materials = useMemo(() => createMapMaterials(), []);
  useEffect(() => () => disposeMapMaterials(materials), [materials]);
  useLayoutEffect(() => {
    paintMapMaterials(materials, palette);
    invalidate();
  }, [materials, palette, invalidate]);
  return materials;
}
