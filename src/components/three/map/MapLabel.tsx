"use client";

import { useEffect, useMemo } from "react";
import { PlaneGeometry } from "three";
import { LABEL_ASPECT, LABEL_LAYER, LABEL_WORLD_WIDTH, TILT, labelTexture, type LabelStyle } from "./labels";

/** Lifts the label's bottom edge just clear of the floor. */
const FLOOR_CLEARANCE = 0.02;
/** Drawn after the lines and markers, like round 5. */
const LABEL_RENDER_ORDER = 3;

interface MapLabelProps {
  readonly title: string;
  readonly sub: string;
  /** Where the label's centre stands on the floor. */
  readonly x: number;
  readonly z: number;
  readonly size?: number;
  readonly style: LabelStyle;
  /** Focus mode hides labels outright rather than dimming them. */
  readonly visible: boolean;
}

/** Typography printed on the map, leaning towards the camera. Unlit, so the ink stays exact. */
export function MapLabel({ title, sub, x, z, size = 1, style, visible }: MapLabelProps) {
  const width = LABEL_WORLD_WIDTH * size;
  const height = width * LABEL_ASPECT;
  const geometry = useMemo(() => new PlaneGeometry(width, height), [width, height]);
  const texture = useMemo(() => labelTexture(title, sub, style), [title, sub, style]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh
      geometry={geometry}
      position={[x, FLOOR_CLEARANCE + (height / 2) * Math.sin(TILT), z]}
      rotation-x={-Math.PI / 2 + TILT}
      renderOrder={LABEL_RENDER_ORDER}
      layers={LABEL_LAYER}
      visible={visible}
    >
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
