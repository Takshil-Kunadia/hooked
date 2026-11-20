"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { DEPOT } from "@/lib/metro/route";
import { PICKABLE_LAYERS } from "../usePicking";
import { MapLabel } from "./MapLabel";
import type { LabelStyle } from "./labels";
import type { MapMaterials } from "./materials";

/** Round 5's data vault: a porcelain block with three blue light slits on its front. */
const VAULT = { w: 1.9, h: 1.15, d: 1.35, segments: 6, radius: 0.22 } as const;
const SLIT = { w: 1.36, h: 0.055, d: 0.04, segments: 2, radius: 0.02 } as const;
const SLIT_HEIGHTS = [0.36, 0.58, 0.8] as const;
/** Round 5's vault centre height: its base clears the floor by 0.005. */
const VAULT_Y = 0.58;
/** Sits the slits just proud of the vault's front face, so the two surfaces never coincide. */
const SLIT_Z = 0.69;
const LABEL_Z_OFFSET = 1.8;
const LABEL_SIZE = 0.8;

/** The name the depot's hover card looks up, found by picking. */
const DEPOT_CARD = "database";
const DEPOT_USER_DATA = { card: DEPOT_CARD } as const;
/** Two-way hover linking: the highlighted vault grows a little and its slits brighten. */
const SLIT_GLOW = { rest: 0.3, highlighted: 1 } as const;
const HIGHLIGHT_SCALE = 1.08;

/** Sets the slits' glow; the slit material is the depot's own. */
function glowSlits(materials: MapMaterials, on: boolean): void {
  materials.slit.emissiveIntensity = on ? SLIT_GLOW.highlighted : SLIT_GLOW.rest;
}

interface DepotProps {
  readonly materials: MapMaterials;
  readonly labelStyle: LabelStyle | null;
  readonly labelVisible: boolean;
  /** The card name the hover/pinned card shows, if any. */
  readonly highlighted: string | null;
}

/** The database, drawn as a depot at the end of WP_Query's spur. */
export function Depot({ materials, labelStyle, labelVisible, highlighted }: DepotProps) {
  const invalidate = useThree((s) => s.invalidate);
  const vault = useMemo(() => new RoundedBoxGeometry(VAULT.w, VAULT.h, VAULT.d, VAULT.segments, VAULT.radius), []);
  const slit = useMemo(() => new RoundedBoxGeometry(SLIT.w, SLIT.h, SLIT.d, SLIT.segments, SLIT.radius), []);
  const lit = highlighted === DEPOT_CARD;
  useEffect(() => () => vault.dispose(), [vault]);
  useEffect(() => () => slit.dispose(), [slit]);
  useLayoutEffect(() => {
    glowSlits(materials, lit);
    invalidate();
  }, [materials, lit, invalidate]);

  return (
    <>
      <group position={[DEPOT.x, 0, DEPOT.z]} scale={lit ? HIGHLIGHT_SCALE : 1} userData={DEPOT_USER_DATA}>
        <mesh
          geometry={vault}
          material={materials.porcelain}
          position-y={VAULT_Y}
          layers={PICKABLE_LAYERS}
          castShadow
          receiveShadow
        />
        {SLIT_HEIGHTS.map((y) => (
          <mesh
            key={y}
            geometry={slit}
            material={materials.slit}
            position={[0, y, SLIT_Z]}
            layers={PICKABLE_LAYERS}
            receiveShadow
          />
        ))}
      </group>
      {labelStyle && (
        <MapLabel
          title="database"
          sub="the depot"
          x={DEPOT.x}
          z={DEPOT.z + LABEL_Z_OFFSET}
          size={LABEL_SIZE}
          style={labelStyle}
          visible={labelVisible}
        />
      )}
    </>
  );
}
