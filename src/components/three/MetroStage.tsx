"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { NeutralToneMapping, Vector3 } from "three";
import { LINE_COLOURS, ORIGIN_COLOURS } from "@/lib/design/tokens";
import { buildTransitPath, ribbonGeometry } from "@/lib/geometry/transit";
import { FEEDER_LINES, MAIN_LINE, type LineSpec } from "@/lib/metro/route";

const LINE_HEIGHT = 0.12;
/** Big enough for crisp shadows across the whole map, without the 64 MB cost of 4096². */
const SHADOW_MAP_SIZE = 2048;
const OVERVIEW_POSITION = [3.6, 31.3, 42.4] as const;
const OVERVIEW_LOOK = [4.2, -6.8, 1] as const;

function colourFor(spec: LineSpec): string {
  if (spec.kind === "main") return LINE_COLOURS.main;
  if (spec.kind === "feeder" && spec.origin) return ORIGIN_COLOURS[spec.origin];
  return LINE_COLOURS.spur;
}

interface CameraRigProps {
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
}

function CameraRig({ position, lookAt }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...lookAt);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, position, lookAt]);
  return null;
}

interface MetroLineProps {
  readonly spec: LineSpec;
}

function MetroLine({ spec }: MetroLineProps) {
  const geometry = useMemo(() => {
    const path = buildTransitPath(
      spec.points.map(([x, z]) => new Vector3(x, 0, z)),
      spec.cornerRadius,
    );
    return ribbonGeometry(path, { width: spec.width, height: LINE_HEIGHT, segments: spec.segments });
  }, [spec]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial color={colourFor(spec)} roughness={0.32} clearcoat={0.5} clearcoatRoughness={0.3} />
    </mesh>
  );
}

/**
 * Overview of the metro map. The scene is static for now, so it renders on demand
 * instead of 60 times a second; the story's animations will call invalidate().
 */
export default function MetroStage() {
  return (
    <Canvas
      frameloop="demand"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, toneMapping: NeutralToneMapping }}
      camera={{ fov: 30, near: 0.1, far: 200 }}
    >
      <CameraRig position={OVERVIEW_POSITION} lookAt={OVERVIEW_LOOK} />
      <hemisphereLight args={["#ffffff", "#d9d4cc", 0.55]} />
      <directionalLight
        position={[-8, 22, 14]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-left={-22}
        shadow-camera-right={28}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0003}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <shadowMaterial opacity={0.16} />
      </mesh>
      <MetroLine spec={MAIN_LINE} />
      {FEEDER_LINES.map((spec) => (
        <MetroLine key={spec.id} spec={spec} />
      ))}
    </Canvas>
  );
}
