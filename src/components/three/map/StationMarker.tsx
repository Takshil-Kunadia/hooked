"use client";

import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import type { MapMaterials } from "./materials";

/** Round 5's marker: a white pill on a slightly larger ink pill, laid across the line. */
const DEFAULT_LEN = 1.05;
const WIDTH = 0.46;
const RIM = 0.2;
const RIM_DEPTH = 0.2;
const FACE_DEPTH = 0.27;
const BEVEL = { bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 32 };

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
  readonly materials: MapMaterials;
}

export function StationMarker({ x, z, len = DEFAULT_LEN, yaw, current, materials }: StationMarkerProps) {
  const rim = useMemo(() => pill(len + RIM, WIDTH + RIM, RIM_DEPTH), [len]);
  const face = useMemo(() => pill(len, WIDTH, FACE_DEPTH), [len]);
  useEffect(() => () => rim.dispose(), [rim]);
  useEffect(() => () => face.dispose(), [face]);

  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <mesh
        geometry={rim}
        material={current ? materials.accent : materials.ink}
        rotation-x={-Math.PI / 2}
        castShadow
        receiveShadow
      />
      <mesh geometry={face} material={materials.stationWhite} rotation-x={-Math.PI / 2} castShadow receiveShadow />
    </group>
  );
}
