"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { NeutralToneMapping, Vector3 } from "three";
import { buildTransitPath } from "@/lib/geometry/transit";
import { DEFAULT_LAYOUT } from "@/lib/lifecycle/layout";
import type { LifecycleMap } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";
import { MAP_FOV, overviewPose, viewMood } from "@/lib/lifecycle/view";
import { Effects } from "../three/Effects";
import { Lighting } from "../three/Lighting";
import { MapLabel } from "../three/map/MapLabel";
import { MetroLine } from "../three/map/MetroLine";
import { LABEL_LAYER, LABEL_WORLD_WIDTH, useLabelFonts } from "../three/map/labels";
import { useMapMaterials } from "../three/map/materials";
import { fogScale, moodPalette, toneCompensatedCss, usePaletteId } from "../three/palette";
import { LabelLayer } from "./LabelLayer";
import { MapCamera } from "./MapCamera";
import { RideTrain } from "./RideTrain";
import { Stops } from "./Stops";

const GL_OPTIONS = {
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
  toneMapping: NeutralToneMapping,
} as const;
const CAMERA_OPTIONS = { fov: MAP_FOV, near: 0.1, far: 700 } as const;
const LINE_WIDTH = 0.42;
/** Sweep resolution per unit of line: the turns are the only curves. */
const SEGMENTS_PER_UNIT = 4;
/** The lighting changes in steps this small, so it never rebuilds the scene every frame. */
const MOOD_STEP = 0.04;
const MOOD_RATE = 1.6;
const STAGE_LABEL_SIZE = 1.9;
const SETTLE_FRAMES = 30;
/** Fog tuned for the map's far overview. */
const MAP_FOG_DIST = 95;

interface SceneProps {
  readonly map: LifecycleMap;
  readonly overlay: RefObject<HTMLDivElement | null>;
  readonly pill: RefObject<HTMLDivElement | null>;
  readonly reducedMotion: boolean;
  readonly onMood: (mood: number) => void;
}

function Scene({ map, overlay, pill, reducedMotion, onMood }: SceneProps) {
  const paletteId = usePaletteId();
  const dark = paletteId === "dusk";
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const [mood, setMood] = useState(() => (dark ? 0.5 : 0));
  const palette = useMemo(() => moodPalette(mood), [mood]);
  const materials = useMapMaterials(palette);
  const fonts = useLabelFonts();
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const rowGapPx = useRef(0);
  const probe = useMemo(() => ({ a: new Vector3(), b: new Vector3() }), []);
  const smoothMood = useRef(mood);
  const train = useRef({ x: 0, z: 0 });

  const home = useMemo(() => overviewPose(map.bounds, size.width / Math.max(1, size.height)), [map.bounds, size]);
  const path = useMemo(
    () =>
      buildTransitPath(
        map.path.map(([x, z]) => new Vector3(x, 0, z)),
        DEFAULT_LAYOUT.rowGap / 2,
      ),
    [map.path],
  );
  const segments = useMemo(() => Math.ceil(path.getLength() * SEGMENTS_PER_UNIT), [path]);
  const labelStyle = useMemo(
    () =>
      fonts
        ? {
            ink: toneCompensatedCss(palette.labelInk),
            muted: toneCompensatedCss(palette.labelMuted),
            fonts,
            anisotropy,
          }
        : null,
    [fonts, palette.labelInk, palette.labelMuted, anisotropy],
  );
  const centre = useMemo(
    () => ({
      x: (map.bounds.minX + map.bounds.maxX) / 2,
      z: (map.bounds.minZ + map.bounds.maxZ) / 2,
      half: Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) / 2 + 6,
    }),
    [map.bounds],
  );

  useEffect(() => {
    camera.layers.enable(LABEL_LAYER);
  }, [camera]);

  /* a few frames after mounting, while the post-processing and the fonts settle */
  useEffect(() => {
    let frames = SETTLE_FRAMES;
    let id = 0;
    const tick = (): void => {
      invalidate();
      if (--frames > 0) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [invalidate, labelStyle]);
  useEffect(() => onMood(mood), [mood, onMood]);

  const onLook = (x: number, z: number, dist: number): void => {
    camera.updateMatrixWorld();
    probe.a.set(x, 0, z).project(camera);
    probe.b.set(x, 0, z - DEFAULT_LAYOUT.rowGap).project(camera);
    rowGapPx.current = (Math.abs(probe.a.y - probe.b.y) / 2) * size.height;
    const goal = viewMood(map.stages, z, dist, dark);
    const k = reducedMotion ? 1 : 0.05 * MOOD_RATE;
    smoothMood.current += (goal - smoothMood.current) * k;
    const stepped = Math.round(smoothMood.current / MOOD_STEP) * MOOD_STEP;
    if (Math.abs(stepped - mood) > MOOD_STEP / 2) setMood(stepped);
    /* keep easing the light after the camera has stopped */
    if (Math.abs(goal - smoothMood.current) > MOOD_STEP / 4) invalidate();
  };

  return (
    <>
      <MapCamera home={home} train={train} reducedMotion={reducedMotion} onLook={onLook} />
      <Lighting palette={palette} fogScale={fogScale(Math.max(MAP_FOG_DIST, home.dist * 1.2))} area={centre} sky />
      <MetroLine path={path} width={LINE_WIDTH} segments={segments} material={materials.line} />
      <Stops stops={map.stops} materials={materials} />
      {labelStyle &&
        map.stages.map((s, i) => (
          <MapLabel
            key={s.id}
            title={`${i + 1} · ${s.title}`}
            sub={`${s.count} hooks · ${s.where}`}
            x={s.label[0] + (s.label[0] > centre.x ? -1 : 1) * ((LABEL_WORLD_WIDTH * STAGE_LABEL_SIZE) / 2 - 0.4)}
            z={s.label[1]}
            size={STAGE_LABEL_SIZE}
            style={labelStyle}
            visible
          />
        ))}
      <RideTrain
        path={path}
        stops={map.stops}
        palette={palette}
        pill={pill}
        onTrain={(x, z) => {
          train.current = { x, z };
        }}
      />
      <LabelLayer stops={map.stops} overlay={overlay} rowGapPx={rowGapPx} />
      <Effects bloom={palette.bloom} ambientOcclusion={size.width > 760} />
    </>
  );
}

interface LifecycleStageProps {
  readonly map: LifecycleMap;
  readonly overlay: RefObject<HTMLDivElement | null>;
  readonly pill: RefObject<HTMLDivElement | null>;
  readonly reducedMotion: boolean;
  readonly onMood: (mood: number) => void;
}

/** The whole request as one metro line: renders on demand, while something moves. */
export default function LifecycleStage({ map, overlay, pill, reducedMotion, onMood }: LifecycleStageProps) {
  return (
    <Canvas
      frameloop="demand"
      shadows="percentage"
      dpr={[1, 2]}
      gl={GL_OPTIONS}
      camera={CAMERA_OPTIONS}
      onPointerMissed={() => lifecycleStore.getState().select(null)}
    >
      <Scene map={map} overlay={overlay} pill={pill} reducedMotion={reducedMotion} onMood={onMood} />
    </Canvas>
  );
}
