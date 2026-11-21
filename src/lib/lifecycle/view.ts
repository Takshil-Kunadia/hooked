/**
 * Camera framing and the lighting narrative for the lifecycle map. Pure numbers, so the 3D stage
 * stays thin and this stays tested.
 */
import type { LifecycleMap, LifecycleStage } from "./model";

/** Same lens as the story's stage. */
export const MAP_FOV = 30;
const HALF_FOV_TAN = Math.tan(((MAP_FOV / 2) * Math.PI) / 180);
/** The camera looks down at the map from this far above the horizon. */
export const MAP_ELEVATION = (50 * Math.PI) / 180;
const FIT_MARGIN = 1.12;
/** Room for the title panel above the map and the controls below it, in floor units of depth. */
const UI_ROOM = 13;
/** Close enough to read a stop's name. */
export const STOP_DIST = 11;

export interface MapPose {
  readonly x: number;
  readonly z: number;
  readonly dist: number;
  /** Radians above the horizon; the overview's when left out. */
  readonly elev?: number;
}

/** Close views come down lower, so the portals stand up and the line has depth. */
export const CLOSE_ELEVATION = (36 * Math.PI) / 180;

type Bounds = LifecycleMap["bounds"];

/**
 * The distance that fits a `width` × `depth` patch of floor on screen. The patch's near edge is
 * closer to the camera than its centre, so it looks wider: the width is fitted there.
 */
export function fitDist(width: number, depth: number, aspect: number): number {
  const nearEdge = (depth / 2) * Math.cos(MAP_ELEVATION);
  const byWidth = width / 2 / (HALF_FOV_TAN * aspect) + nearEdge;
  const byDepth = (depth * Math.sin(MAP_ELEVATION)) / 2 / HALF_FOV_TAN + nearEdge * 0.5;
  return Math.max(byWidth, byDepth) * FIT_MARGIN;
}

/** The whole request in one view. */
export function overviewPose(bounds: Bounds, aspect: number): MapPose {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    /* most of the room goes above the map, where the title panel is */
    z: (bounds.minZ + bounds.maxZ) / 2 - UI_ROOM * 0.3,
    dist: fitDist(width * 1.12, depth + UI_ROOM, aspect),
  };
}

/** Close enough to read the names of a stage's first stops. */
export const STAGE_DIST = 26;
/** How far into its first row a stage's view looks, along the row. */
const STAGE_LOOK_IN = 13;

/** Where a stage begins: its title and the first stretch of its first row, close enough to read. */
export function stagePose(stage: LifecycleStage, bounds: Bounds): MapPose {
  const [entryX, labelZ] = stage.label;
  const inward = entryX > (bounds.minX + bounds.maxX) / 2 ? -1 : 1;
  return {
    x: entryX + inward * STAGE_LOOK_IN,
    z: (labelZ + stage.zRange[0]) / 2 + 1.5,
    dist: STAGE_DIST,
    elev: CLOSE_ELEVATION,
  };
}

/** Where the camera stands for a pose: behind and above the point it looks at. */
export function cameraPosition(pose: MapPose): readonly [number, number, number] {
  const elev = pose.elev ?? MAP_ELEVATION;
  return [pose.x, pose.dist * Math.sin(elev), pose.z + pose.dist * Math.cos(elev)];
}

/** A close look at one stop. */
export function stopPose(x: number, z: number): MapPose {
  return { x, z, dist: STOP_DIST, elev: CLOSE_ELEVATION };
}

const centre = (s: LifecycleStage): number => (s.zRange[0] + s.zRange[1]) / 2;

/** The stage whose rows are nearest to `z`. */
export function stageNear(stages: ReadonlyArray<LifecycleStage>, z: number): LifecycleStage | null {
  let best: LifecycleStage | null = null;
  let bestD = Infinity;
  for (const s of stages) {
    const [z0, z1] = s.zRange;
    const d = z < z0 ? z0 - z : z > z1 ? z - z1 : 0;
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** From this far out the map is a diagram in the scheme's own light; the narrative fades in closer. */
const MOOD_FAR = 70;
const MOOD_NEAR = 38;

/** The lighting for a camera looking at `z` from `dist` away: the base light far out, the stage's close up. */
export function viewMood(stages: ReadonlyArray<LifecycleStage>, z: number, dist: number, dark: boolean): number {
  const base = dark ? 0.5 : 0;
  const near = Math.min(1, Math.max(0, (MOOD_FAR - dist) / (MOOD_FAR - MOOD_NEAR)));
  return base + (moodAt(stages, z, dark) - base) * near;
}

/**
 * The lighting narrative at a point of the map: each stage's mood at its centre, blended between
 * neighbours. In a dark colour scheme the whole journey shifts towards the dark (Dusk to core).
 */
export function moodAt(stages: ReadonlyArray<LifecycleStage>, z: number, dark: boolean): number {
  const first = stages[0];
  if (!first) return dark ? 0.5 : 0;
  let mood = first.mood;
  if (z > centre(first)) {
    mood = stages[stages.length - 1]?.mood ?? first.mood;
    for (let i = 0; i + 1 < stages.length; i++) {
      const a = stages[i]!;
      const b = stages[i + 1]!;
      if (z >= centre(a) && z <= centre(b)) {
        const t = (z - centre(a)) / Math.max(1e-6, centre(b) - centre(a));
        mood = a.mood + (b.mood - a.mood) * t;
        break;
      }
    }
  }
  return dark ? 0.5 + mood / 2 : mood;
}
