import { DEPOT, FEEDER_LINES, stationById, type StationId } from "../metro/route";
import type { ShotId } from "./chapter";
import type { LayoutMode } from "./layout";

export type Vec3 = readonly [number, number, number];

interface CameraSpec {
  readonly fov: 30;
  /** Camera distance to the subject. */
  readonly dist: number;
  /** Degrees above the ground. */
  readonly elev: number;
  /** How far right of centre the subject sits, as a fraction of the half-width. */
  readonly shiftFrac: number;
  /** Aim offset below the subject. */
  readonly lookY: number;
  readonly overview: { readonly look: Vec3; readonly dist: number; readonly elev: number };
}

/** Round 5's framing, with each overview retuned to fit the longer line. */
export const CAMERA: Readonly<Record<LayoutMode, CameraSpec>> = {
  stacked: {
    fov: 30,
    dist: 31,
    elev: 46,
    shiftFrac: 0,
    lookY: -4.8,
    overview: { look: [0.7, 0, 1], dist: 195, elev: 44 },
  },
  tablet: {
    fov: 30,
    dist: 19.5,
    elev: 42,
    shiftFrac: 0.34,
    lookY: -0.9,
    overview: { look: [0.7, 0, 1], dist: 62, elev: 38 },
  },
  desktop: {
    fov: 30,
    dist: 19,
    elev: 42,
    shiftFrac: 0.36,
    lookY: -1.0,
    overview: { look: [0.7, 0, 1], dist: 56, elev: 37 },
  },
  wide: {
    fov: 30,
    dist: 17.5,
    elev: 41,
    shiftFrac: 0.38,
    lookY: -1.0,
    overview: { look: [0.7, 0, 1], dist: 50, elev: 36 },
  },
};

const SUBJECT_LIFT = 0.7;
const HALF_FOV_TAN = Math.tan((15 * Math.PI) / 180);

function rig(look: Vec3, dist: number, elevDeg: number): { position: Vec3; lookAt: Vec3 } {
  const e = (elevDeg * Math.PI) / 180;
  return {
    position: [look[0] - 0.08 * dist, look[1] + Math.sin(e) * dist, look[2] + Math.cos(e) * dist],
    lookAt: look,
  };
}

/** Where the camera sits and what it aims at to frame `subject` in this layout. */
export function shotFor(
  subject: Vec3 | "overview",
  layout: LayoutMode,
  aspect: number,
): { position: Vec3; lookAt: Vec3 } {
  const cam = CAMERA[layout];
  if (subject === "overview") return rig(cam.overview.look, cam.overview.dist, cam.overview.elev);
  const halfW = cam.dist * HALF_FOV_TAN * aspect;
  return rig([subject[0] - cam.shiftFrac * halfW, subject[1] + cam.lookY, subject[2]], cam.dist, cam.elev);
}

function feedersSubject(): Vec3 {
  const settings = stationById("settings");
  const starts = FEEDER_LINES.filter((l) => l.kind === "feeder").flatMap((l) => l.points.slice(0, 1));
  const meanX = starts.reduce((sum, p) => sum + p[0], 0) / starts.length;
  const meanZ = starts.reduce((sum, p) => sum + p[1], 0) / starts.length;
  return [(settings.x + meanX) / 2, SUBJECT_LIFT, (settings.z + meanZ) / 2];
}

/** What the camera looks at for a beat's shot. */
export function subjectFor(shot: ShotId, station: StationId): Vec3 | "overview" {
  switch (shot) {
    case "overview":
      return "overview";
    case "depot":
      return [DEPOT.x, SUBJECT_LIFT, DEPOT.z];
    case "feeders":
      return feedersSubject();
    case "platform": {
      const init = stationById("init");
      return [init.x + 0.8, SUBJECT_LIFT, 0.4];
    }
    case "station": {
      const s = stationById(station);
      return [s.x, SUBJECT_LIFT, s.z];
    }
  }
}
