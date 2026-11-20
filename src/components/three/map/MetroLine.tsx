"use client";

import { useEffect, useMemo } from "react";
import type { CurvePath, Material, Vector3 } from "three";
import { endCapGeometry, ribbonGeometry } from "@/lib/geometry/transit";

/** Height of every line on the map (round 5's LINE_H). */
export const LINE_HEIGHT = 0.12;

interface MetroLineProps {
  readonly path: CurvePath<Vector3>;
  readonly width: number;
  readonly segments: number;
  readonly material: Material;
}

interface CapPose {
  readonly position: readonly [number, number, number];
  /** Turns the cap's +x bulge to face out of the line. */
  readonly rotationY: number;
}

function capPose(path: CurvePath<Vector3>, u: 0 | 1): CapPose {
  const p = path.getPointAt(u);
  const t = path.getTangentAt(u);
  const out = u === 0 ? -1 : 1;
  return { position: [p.x, 0, p.z], rotationY: Math.atan2(-t.z * out, t.x * out) };
}

/** A transit line: the rounded bar swept along its path, closed with rounded half-caps. */
export function MetroLine({ path, width, segments, material }: MetroLineProps) {
  const ribbon = useMemo(() => ribbonGeometry(path, { width, height: LINE_HEIGHT, segments }), [path, width, segments]);
  const cap = useMemo(() => endCapGeometry({ width, height: LINE_HEIGHT }), [width]);
  const caps = useMemo(() => [capPose(path, 0), capPose(path, 1)], [path]);
  useEffect(() => () => ribbon.dispose(), [ribbon]);
  useEffect(() => () => cap.dispose(), [cap]);

  return (
    <group>
      <mesh geometry={ribbon} material={material} castShadow receiveShadow />
      {caps.map((pose, i) => (
        <mesh
          key={i}
          geometry={cap}
          material={material}
          position={pose.position}
          rotation-y={pose.rotationY}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
