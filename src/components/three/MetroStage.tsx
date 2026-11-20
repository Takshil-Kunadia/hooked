"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { NeutralToneMapping } from "three";
import { useStore } from "zustand";
import { CAMERA, shotFor } from "@/lib/story/camera";
import { findBeat, flattenBeats, type BeatSpec, type ChapterSpec } from "@/lib/story/chapter";
import type { LayoutMode } from "@/lib/story/layout";
import { storyStore } from "@/lib/story/store";
import { Effects } from "./Effects";
import { Lighting } from "./Lighting";
import { MetroMap, OVERVIEW_FOCUS } from "./map/MetroMap";
import { fogScale, usePalette } from "./palette";

const FOV = 30;
const NEAR = 0.1;
/** Beyond the farthest fog (the tablet overview's), so the fog, not the far plane, ends the map. */
const FAR = 200;
/** The composer's target has MSAA; the canvas itself only receives the output pass. */
const GL_OPTIONS = {
  antialias: false,
  alpha: true,
  powerPreference: "high-performance",
  toneMapping: NeutralToneMapping,
} as const;
const CAMERA_OPTIONS = { fov: FOV, near: NEAR, far: FAR } as const;
/** The canvas is fixed, so it needn't re-measure on scroll. */
const RESIZE_OPTIONS = { scroll: false } as const;
/** Round 5 caps phones at 1.5× so MSAA ×4 and the post passes stay smooth. */
const MAX_DPR: Readonly<Record<LayoutMode, number>> = { stacked: 1.5, tablet: 2, desktop: 2, wide: 2 };

interface OverviewCameraProps {
  readonly layout: LayoutMode;
}

/** A still camera on the layout's overview shot; Task 10's CameraRig takes over from here. */
function OverviewCamera({ layout }: OverviewCameraProps) {
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = width > 0 && height > 0 ? width / height : 1;

  useLayoutEffect(() => {
    const shot = shotFor("overview", layout, aspect);
    camera.position.set(...shot.position);
    camera.lookAt(...shot.lookAt);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, layout, aspect, invalidate]);
  return null;
}

/** The chapter's current beat, or null without a chapter (the hero overview). */
function useCurrentBeat(chapter: ChapterSpec | undefined): BeatSpec | null {
  const flat = useMemo(() => (chapter ? flattenBeats(chapter) : []), [chapter]);
  const actId = useStore(storyStore, (s) => s.actId);
  const beat = useStore(storyStore, (s) => s.beat);
  return findBeat(flat, actId, beat)?.spec ?? null;
}

/** Requests a frame whenever the story moves or the layout changes (the canvas renders on demand). */
function useInvalidateOnStory(): void {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(
    () =>
      storyStore.subscribe((s, prev) => {
        if (s.actId !== prev.actId || s.beat !== prev.beat || s.layout !== prev.layout) invalidate();
      }),
    [invalidate],
  );
}

interface StageSceneProps {
  readonly chapter?: ChapterSpec;
}

function StageScene({ chapter }: StageSceneProps) {
  const palette = usePalette();
  const layout = useStore(storyStore, (s) => s.layout);
  const beat = useCurrentBeat(chapter);
  useInvalidateOnStory();

  return (
    <>
      <OverviewCamera layout={layout} />
      <Lighting palette={palette} fogScale={fogScale(CAMERA[layout].overview.dist)} />
      <MetroMap focus={beat?.focus ?? OVERVIEW_FOCUS} current={beat?.station ?? null} palette={palette} />
      <Effects bloom={palette.bloom} ambientOcclusion={layout !== "stacked"} />
    </>
  );
}

interface MetroStageProps {
  /** The story's chapter; without one the stage shows the hero overview. */
  readonly chapter?: ChapterSpec;
}

/**
 * The metro map. It renders on demand rather than 60 times a second: the scene requests
 * a frame when the story, the tile or the viewport changes.
 */
export default function MetroStage({ chapter }: MetroStageProps) {
  const layout = useStore(storyStore, (s) => s.layout);
  return (
    <Canvas
      frameloop="demand"
      shadows="percentage"
      dpr={[1, MAX_DPR[layout]]}
      gl={GL_OPTIONS}
      camera={CAMERA_OPTIONS}
      resize={RESIZE_OPTIONS}
    >
      <StageScene chapter={chapter} />
    </Canvas>
  );
}
