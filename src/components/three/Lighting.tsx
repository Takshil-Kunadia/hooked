"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Fog, Object3D, PMREMGenerator, type DirectionalLight, type Scene, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { toneCompensated, type Palette } from "./palette";

/** Round 5's studio light: a soft sky/ground fill and one shadow-casting key from the upper left. */
const HEMI_SKY = "#ffffff";
const HEMI_GROUND = "#d9d4cc";
const KEY_POSITION = [-8, 22, 14] as const;
const KEY_TARGET = [3, 0, 0] as const;
/** Big enough for crisp shadows across the whole map, without the 64 MB cost of 4096². */
const SHADOW_MAP_SIZE = 2048;
const SHADOW_BOUNDS = { left: -30, right: 30, top: 18, bottom: -18, near: 1, far: 80 } as const;
const ENVIRONMENT_BLUR = 0.04;
/** A seamless floor that only catches shadows: no visible table edge. */
const FLOOR_SIZE = 240;

/** Lights the physical materials with a blurred studio room; returns the cleanup. */
function installEnvironment(gl: WebGLRenderer, scene: Scene, invalidate: () => void): () => void {
  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, ENVIRONMENT_BLUR);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  invalidate();
  return () => {
    scene.environment = null;
    environment.dispose();
  };
}

/** Background, fog and environment strength for a tile (round 5's `applyPalette()`, scene part). */
function applySceneLook(scene: Scene, palette: Palette, fogScale: number): void {
  /* tone-compensated so the canvas matches the page background exactly */
  const bg = toneCompensated(palette.bg);
  scene.background = bg;
  scene.fog = new Fog(bg.clone(), palette.fogNear * fogScale, palette.fogFar * fogScale);
  scene.environmentIntensity = palette.env;
}

interface LightingProps {
  readonly palette: Palette;
  /** Fog distances scale with the overview's camera distance (see `fogScale`). */
  readonly fogScale: number;
}

/** Background, fog, environment and lights. */
export function Lighting({ palette, fogScale }: LightingProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const keyTarget = useMemo(() => new Object3D(), []);
  const key = useRef<DirectionalLight>(null);

  /* R3F sets the shadow camera's bounds but doesn't rebuild its projection */
  useLayoutEffect(() => {
    key.current?.shadow.camera.updateProjectionMatrix();
  }, []);

  /* before the first frame, so the porcelain never renders unlit */
  useLayoutEffect(() => installEnvironment(gl, scene, invalidate), [gl, scene, invalidate]);

  useLayoutEffect(() => {
    applySceneLook(scene, palette, fogScale);
    invalidate();
  }, [scene, palette, fogScale, invalidate]);

  return (
    <>
      <hemisphereLight args={[HEMI_SKY, HEMI_GROUND]} intensity={palette.hemi} />
      <primitive object={keyTarget} position={KEY_TARGET} />
      <directionalLight
        ref={key}
        position={KEY_POSITION}
        target={keyTarget}
        color={palette.keyColor}
        intensity={palette.key}
        castShadow
        shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
        shadow-camera-left={SHADOW_BOUNDS.left}
        shadow-camera-right={SHADOW_BOUNDS.right}
        shadow-camera-top={SHADOW_BOUNDS.top}
        shadow-camera-bottom={SHADOW_BOUNDS.bottom}
        shadow-camera-near={SHADOW_BOUNDS.near}
        shadow-camera-far={SHADOW_BOUNDS.far}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <shadowMaterial opacity={palette.shadow} />
      </mesh>
    </>
  );
}
