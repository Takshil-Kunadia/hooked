"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Vector3, type Camera } from "three";
import { useStore } from "zustand";
import { shotFor, subjectFor } from "@/lib/story/camera";
import type { BeatSpec } from "@/lib/story/chapter";
import type { LayoutMode } from "@/lib/story/layout";
import { storyStore } from "@/lib/story/store";

/** Round 5's camera damping: each second closes all but e^-2.6 (≈ 7%) of the gap to the shot. */
const DAMPING_PER_S = 2.6;
/** Round 5's cap on one frame's step, for slow frames. */
const MAX_STEP_S = 0.05;
/** The first step after a rest follows an idle gap of any length, so it is one 60 Hz frame long. */
const FIRST_STEP_S = 1 / 60;
/** Close enough to call the shot reached (world units). */
const SETTLED = 1e-3;
/** Runs before the train and the platform, so they project against this frame's camera. */
const CAMERA_PRIORITY = -1;

interface Rig {
  readonly position: Vector3;
  readonly lookAt: Vector3;
  readonly goalPosition: Vector3;
  readonly goalLookAt: Vector3;
  /** False until the first shot is applied: that one is a cut, never a glide in from elsewhere. */
  placed: boolean;
  /** True while gliding toward the goal. */
  moving: boolean;
}

const createRig = (): Rig => ({
  position: new Vector3(),
  lookAt: new Vector3(),
  goalPosition: new Vector3(),
  goalLookAt: new Vector3(),
  placed: false,
  moving: false,
});

function applyRig(rig: Rig, camera: Camera): void {
  camera.position.copy(rig.position);
  camera.lookAt(rig.lookAt);
  camera.updateMatrixWorld();
}

/** Aims at a new shot; cuts straight to it on first paint and under reduced motion. */
function aimRig(rig: Rig, camera: Camera, shot: ReturnType<typeof shotFor>, cut: boolean): void {
  rig.goalPosition.set(...shot.position);
  rig.goalLookAt.set(...shot.lookAt);
  if (!cut && rig.placed) return;
  rig.position.copy(rig.goalPosition);
  rig.lookAt.copy(rig.goalLookAt);
  rig.placed = true;
  rig.moving = false;
  applyRig(rig, camera);
}

/** One damping step; returns true while the camera is still on its way. No allocation. */
function stepRig(rig: Rig, camera: Camera, deltaS: number): boolean {
  const settled =
    rig.position.distanceToSquared(rig.goalPosition) < SETTLED * SETTLED &&
    rig.lookAt.distanceToSquared(rig.goalLookAt) < SETTLED * SETTLED;
  if (settled) {
    if (!rig.moving) return false;
    rig.moving = false;
    rig.position.copy(rig.goalPosition);
    rig.lookAt.copy(rig.goalLookAt);
    applyRig(rig, camera);
    return false;
  }
  const step = Math.min(deltaS, rig.moving ? MAX_STEP_S : FIRST_STEP_S);
  rig.moving = true;
  const ease = 1 - Math.exp(-step * DAMPING_PER_S);
  rig.position.lerp(rig.goalPosition, ease);
  rig.lookAt.lerp(rig.goalLookAt, ease);
  applyRig(rig, camera);
  return true;
}

interface CameraRigProps {
  /** The current beat; null shows the overview (the hero, or no chapter). */
  readonly beat: BeatSpec | null;
  readonly layout: LayoutMode;
}

/**
 * Damps the camera toward the beat's shot (round 5's per-frame lerp), framing the subject about 36%
 * right of centre on desktop and in the top half on stacked layouts. The first shot after mount and
 * every shot under reduced motion is a hard cut. It asks for frames only while the camera moves.
 */
export function CameraRig({ beat, layout }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = useStore(storyStore, (s) => s.reducedMotion);
  const sized = width > 0 && height > 0;
  /* shotFor needs a finite aspect > 0 */
  const aspect = sized ? width / height : 1;
  const shotId = beat?.shot ?? "overview";
  const station = beat?.station ?? "browser";
  const shot = useMemo(
    () => shotFor(subjectFor(shotId, station, layout), layout, aspect, shotId),
    [shotId, station, layout, aspect],
  );
  const rig = useRef<Rig | null>(null);

  useLayoutEffect(() => {
    rig.current ??= createRig();
    /* until the canvas has a size the framing is a guess, so keep cutting rather than gliding */
    aimRig(rig.current, camera, shot, reducedMotion || !sized);
    invalidate();
  }, [camera, shot, reducedMotion, sized, invalidate]);

  useFrame((_, delta) => {
    if (rig.current && stepRig(rig.current, camera, delta)) invalidate();
  }, CAMERA_PRIORITY);

  return null;
}
