"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { NeutralToneMapping } from "three";
import { useStore } from "zustand";
import { CAMERA } from "@/lib/story/camera";
import { findBeat, flattenBeats, type BeatSpec, type ChapterSpec, type FlatBeat } from "@/lib/story/chapter";
import { cueIndices } from "@/lib/story/cues";
import type { Ticket } from "@/lib/story/facts";
import type { LayoutMode } from "@/lib/story/layout";
import { storyStore } from "@/lib/story/store";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Lighting } from "./Lighting";
import { InitPlatform } from "./map/InitPlatform";
import { MetroMap, OVERVIEW_FOCUS } from "./map/MetroMap";
import { fogScale, usePalette } from "./palette";
import { Train } from "./Train";
import { usePicking } from "./usePicking";

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
const NO_BEATS: ReadonlyArray<FlatBeat> = [];

/** The chapter's current beat, or null without a chapter (the hero overview). */
function useCurrentBeat(flat: ReadonlyArray<FlatBeat>): BeatSpec | null {
  const actId = useStore(storyStore, (s) => s.actId);
  const beat = useStore(storyStore, (s) => s.beat);
  return findBeat(flat, actId, beat)?.spec ?? null;
}

/**
 * Requests a frame on any story change (beat, layout, hover, reduced motion); the train, camera and
 * platform then keep requesting frames for as long as they move.
 */
function useInvalidateOnStory(): void {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => storyStore.subscribe(() => invalidate()), [invalidate]);
}

/** Ticket faces follow focus mode: shown at the init stop and in the overview, hidden elsewhere. */
const showsTicketFaces = (beat: BeatSpec | null): boolean =>
  beat === null || beat.shot === "overview" || beat.focus.includes("init");

interface StageSceneProps {
  readonly chapter?: ChapterSpec;
  readonly tickets?: ReadonlyArray<Ticket>;
}

function StageScene({ chapter, tickets }: StageSceneProps) {
  const palette = usePalette();
  const layout = useStore(storyStore, (s) => s.layout);
  const highlighted = useStore(storyStore, (s) => s.pinned ?? s.hovered);
  const flat = useMemo(() => (chapter ? flattenBeats(chapter) : NO_BEATS), [chapter]);
  const cues = useMemo(() => cueIndices(flat), [flat]);
  const beat = useCurrentBeat(flat);
  useInvalidateOnStory();
  usePicking();

  return (
    <>
      <CameraRig beat={beat} layout={layout} />
      <Lighting palette={palette} fogScale={fogScale(CAMERA[layout].overview.dist)} />
      <MetroMap
        focus={beat?.focus ?? OVERVIEW_FOCUS}
        current={beat?.station ?? null}
        highlighted={highlighted}
        palette={palette}
      />
      {/* without a chapter the train idles at the start of the line */}
      <Train station={beat?.station ?? "browser"} palette={palette} />
      {chapter && tickets && tickets.length > 0 && (
        <InitPlatform tickets={tickets} cues={cues} facesVisible={showsTicketFaces(beat)} palette={palette} />
      )}
      <Effects bloom={palette.bloom} ambientOcclusion={layout !== "stacked"} />
    </>
  );
}

interface MetroStageProps {
  /** The story's chapter; without one the stage shows the hero overview. */
  readonly chapter?: ChapterSpec;
  /** `StoryData.tickets.shown`: the init platform's passes. None without a chapter. */
  readonly tickets?: ReadonlyArray<Ticket>;
}

/**
 * The metro map. It renders on demand rather than 60 times a second: a story change requests a
 * frame, and the train, camera and init platform request more only while they move.
 */
export default function MetroStage({ chapter, tickets }: MetroStageProps) {
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
      <StageScene chapter={chapter} tickets={tickets} />
    </Canvas>
  );
}
