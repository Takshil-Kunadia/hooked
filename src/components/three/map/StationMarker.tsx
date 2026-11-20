"use client";

import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import { PICKABLE_LAYERS } from "../usePicking";
import type { MapMaterials } from "./materials";

/** Round 5's marker: a white pill on a slightly larger ink pill, laid across the line. */
const DEFAULT_LEN = 1.05;
const WIDTH = 0.46;
const RIM = 0.2;
const RIM_DEPTH = 0.2;
const FACE_DEPTH = 0.27;
const BEVEL = { bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 32 };
/** Two-way hover linking: a highlighted station grows a little, outlined in blue (like round 5's passes). */
const HIGHLIGHT_SCALE = 1.1;

function pillShape(len: number, wid: number): Shape {
  const r = wid / 2;
  const s = new Shape();
  s.moveTo(-len / 2 + r, -r);
  s.lineTo(len / 2 - r, -r);
  s.absarc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-len / 2 + r, r);
  s.absarc(-len / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

const pill = (len: number, wid: number, depth: number): ExtrudeGeometry =>
  new ExtrudeGeometry(pillShape(len, wid), { depth, ...BEVEL });

interface StationMarkerProps {
  readonly x: number;
  readonly z: number;
  /** Platform length across the line. */
  readonly len?: number;
  /** Yaw that lays the pill across the line at this point. */
  readonly yaw: number;
  /** The current stop is outlined in blue instead of ink. */
  readonly current: boolean;
  /** Named by the hover/pinned card (from the map or the copy): outlined in blue and lifted. */
  readonly highlighted: boolean;
  /** The station's hover card name, found by picking. */
  readonly card: string;
  readonly materials: MapMaterials;
}

export function StationMarker({
  x,
  z,
  len = DEFAULT_LEN,
  yaw,
  current,
  highlighted,
  card,
  materials,
}: StationMarkerProps) {
  const rim = useMemo(() => pill(len + RIM, WIDTH + RIM, RIM_DEPTH), [len]);
  const face = useMemo(() => pill(len, WIDTH, FACE_DEPTH), [len]);
  const userData = useMemo(() => ({ card }), [card]);
  useEffect(() => () => rim.dispose(), [rim]);
  useEffect(() => () => face.dispose(), [face]);

  return (
    <group position={[x, 0, z]} rotation-y={yaw} scale={highlighted ? HIGHLIGHT_SCALE : 1} userData={userData}>
      <mesh
        geometry={rim}
        material={current || highlighted ? materials.accent : materials.ink}
        rotation-x={-Math.PI / 2}
        layers={PICKABLE_LAYERS}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={face}
        material={materials.stationWhite}
        rotation-x={-Math.PI / 2}
        layers={PICKABLE_LAYERS}
        castShadow
        receiveShadow
      />
    </group>
  );
}
