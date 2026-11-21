import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CAMERA, shotFor, subjectFor, type Vec3 } from "./camera";
import type { ShotId } from "./chapter";
import { layoutMode } from "./layout";
import {
  FEEDER_LABEL_END_OFFSET,
  FEEDER_LABEL_HALF_WIDTH,
  FEEDER_LABEL_MAX_ROW,
  FEEDER_LABEL_ROW_STEP,
} from "../metro/feeder-labels";
import { DEPOT, FEEDER_LINES, STATIONS, stationById } from "../metro/route";

const VIEWPORTS: ReadonlyArray<readonly [number, number]> = [
  [390, 844],
  [820, 1180],
  [1180, 820],
  [1440, 900],
  [1920, 1080],
];

function project(point: Vec3, subject: Vec3 | "overview", w: number, h: number, shotId?: ShotId) {
  const layout = layoutMode(w, h);
  const shot = shotFor(subject, layout, w / h, shotId);
  const camera = new PerspectiveCamera(CAMERA[layout].fov, w / h, 0.1, 400);
  camera.position.set(...shot.position);
  camera.lookAt(...shot.lookAt);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return new Vector3(...point).project(camera);
}

describe("shotFor framing", () => {
  const subject = subjectFor("platform", "init", "desktop") as Vec3;

  it.each(VIEWPORTS.filter(([w, h]) => ["desktop", "wide", "tablet"].includes(layoutMode(w, h))))(
    "puts the subject right of centre at %ix%i",
    (w, h) => {
      const p = project(subject, subject, w, h);
      expect(p.x).toBeGreaterThanOrEqual(0.3);
      expect(p.x).toBeLessThanOrEqual(0.42);
      expect(Math.abs(p.y)).toBeLessThan(0.25);
    },
  );

  it.each(VIEWPORTS.filter(([w, h]) => layoutMode(w, h) === "stacked"))(
    "puts the subject in the top half at %ix%i",
    (w, h) => {
      const p = project(subject, subject, w, h);
      expect(p.y).toBeGreaterThanOrEqual(0.15);
      expect(p.y).toBeLessThanOrEqual(0.7);
      expect(Math.abs(p.x)).toBeLessThan(0.15);
    },
  );

  it.each(VIEWPORTS.filter(([w, h]) => layoutMode(w, h) !== "stacked"))(
    "overview fits the whole line at %ix%i",
    (w, h) => {
      for (const s of STATIONS) {
        const p = project([s.x, 0, s.z], "overview", w, h);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.95);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.95);
      }
    },
  );

  it("stacked overview stays close and high", () => {
    expect(CAMERA.stacked.overview.dist).toBeLessThanOrEqual(70);
    const xs = STATIONS.map((s) => s.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const p = project([mid, 0, 0], "overview", 390, 844);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(0.7);
    expect(Math.abs(p.x)).toBeLessThan(0.15);
  });

  it("does not mutate its inputs", () => {
    const s: Vec3 = [1, 2, 3];
    const a = shotFor(s, "desktop", 1.6);
    const b = shotFor(s, "desktop", 1.6);
    expect(a).toEqual(b);
    expect(s).toEqual([1, 2, 3]);
  });
});

describe("subjectFor", () => {
  it("returns the depot for depot", () => {
    expect(subjectFor("depot", "init", "desktop")).toEqual([DEPOT.x, 0.7, DEPOT.z]);
  });
  it("returns overview for overview", () => {
    expect(subjectFor("overview", "init", "desktop")).toBe("overview");
  });
  it("lifts station subjects 0.7 up", () => {
    const s = stationById("query");
    expect(subjectFor("station", "query", "desktop")).toEqual([s.x, 0.7, s.z]);
  });
  it("centres the platform shot on the init platform", () => {
    const s = stationById("init");
    expect(subjectFor("platform", "query", "desktop")).toEqual([s.x + 0.8, 0.7, 0.4]);
  });
  it("sits the feeders subject between wp-settings and the feeder starts", () => {
    const [x, y, z] = subjectFor("feeders", "init", "desktop") as Vec3;
    const s = stationById("settings");
    expect(x).toBeCloseTo(s.x, 0);
    expect(y).toBe(0.7);
    expect(z).toBeGreaterThan(s.z);
    expect(z).toBeLessThan(5.4);
  });
});

/* The board's top edge is NDC y -0.5 on desktop; anchors are label centres, so keep them clear of it. */
const MIN_DESKTOP_LABEL_Y = -0.42;
/* On stacked layouts the frosted sheet's top edge is about NDC y 0.1. */
const MIN_STACKED_LABEL_Y = 0.18;
/* The copy column ends near NDC x -0.08 on desktop. */
const MIN_DESKTOP_LABEL_X = -0.1;
const MAX_LABEL_X = 0.95;

describe("the feeders shot", () => {
  const feeders = FEEDER_LINES.filter((l) => l.kind === "feeder");

  /** Each feeder label's left, centre and right edge at its farthest possible row, projected. */
  const projected = (w: number, h: number) => {
    const subject = subjectFor("feeders", "init", layoutMode(w, h)) as Vec3;
    return feeders.flatMap((l) => {
      const start = l.points[0] as readonly [number, number];
      const z = start[1] + FEEDER_LABEL_END_OFFSET + FEEDER_LABEL_MAX_ROW * FEEDER_LABEL_ROW_STEP;
      return [-1, 0, 1].map((side) =>
        project([start[0] + side * FEEDER_LABEL_HALF_WIDTH, 0, z], subject, w, h, "feeders"),
      );
    });
  };

  it.each(VIEWPORTS.filter(([w, h]) => layoutMode(w, h) !== "stacked"))(
    "keeps all four labels on screen, clear of the copy and above the board at %ix%i",
    (w, h) => {
      expect(feeders).toHaveLength(4);
      for (const p of projected(w, h)) {
        expect(p.x).toBeLessThanOrEqual(MAX_LABEL_X);
        expect(p.x).toBeGreaterThanOrEqual(MIN_DESKTOP_LABEL_X);
        expect(p.y).toBeGreaterThan(MIN_DESKTOP_LABEL_Y);
      }
    },
  );

  it.each(VIEWPORTS.filter(([w, h]) => layoutMode(w, h) === "stacked"))(
    "keeps all four labels on screen and above the sheet at %ix%i",
    (w, h) => {
      for (const p of projected(w, h)) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(MAX_LABEL_X);
        expect(p.y).toBeGreaterThan(MIN_STACKED_LABEL_Y);
      }
    },
  );

  it.each(VIEWPORTS)("keeps the wp-settings label in frame at %ix%i", (w, h) => {
    const subject = subjectFor("feeders", "init", layoutMode(w, h)) as Vec3;
    const settings = stationById("settings");
    expect(project([settings.x, 0, settings.z - 2.2], subject, w, h, "feeders").y).toBeLessThanOrEqual(0.92);
  });
});

/* About half of "your browser" as printed on the map, the widest of the three Stop 0 labels. */
const STOP0_LABEL_HALF_WIDTH = 2.2;
/* Station labels sit this far behind or in front of the line (MetroMap's STATION_LABEL_OFFSET). */
const STATION_LABEL_OFFSET = 1.75;
/* Tablets' scrim fades out further right (to 70% of the width), so Stop 0 keeps clear of it. */
const MIN_TABLET_STOP0_X = 0.1;
/* Laptop windows too: a browser's chrome (and zoom) leaves them wide and short. */
const WEB_VIEWPORTS: ReadonlyArray<readonly [number, number]> = [
  ...VIEWPORTS,
  [1171, 606],
  [1288, 667],
  [1366, 768],
  [1536, 864],
];

describe("the web shot (Stop 0's round trip)", () => {
  const stop0 = STATIONS.filter((s) => ["browser", "server", "php"].includes(s.id));

  /** Each Stop 0 marker, and its label's left and right edge, projected. */
  const projected = (w: number, h: number) => {
    const subject = subjectFor("web", "php", layoutMode(w, h)) as Vec3;
    return stop0.flatMap((s) => [
      project([s.x, 0, s.z], subject, w, h, "web"),
      ...[-1, 1].map((side) =>
        project(
          [s.x + side * STOP0_LABEL_HALF_WIDTH, 0, s.z + s.labelSide * STATION_LABEL_OFFSET],
          subject,
          w,
          h,
          "web",
        ),
      ),
    ]);
  };

  it("centres on the three Stop 0 stations", () => {
    const [x, y, z] = subjectFor("web", "php", "desktop") as Vec3;
    expect(x).toBeCloseTo((stationById("browser").x + stationById("php").x) / 2);
    expect(y).toBe(0.7);
    expect(z).toBe(stationById("server").z);
  });

  it.each(WEB_VIEWPORTS.filter(([w, h]) => layoutMode(w, h) !== "stacked"))(
    "shows your browser, the web server and PHP clear of the copy at %ix%i",
    (w, h) => {
      expect(stop0).toHaveLength(3);
      const minX = layoutMode(w, h) === "tablet" ? MIN_TABLET_STOP0_X : MIN_DESKTOP_LABEL_X;
      for (const p of projected(w, h)) {
        expect(p.x).toBeGreaterThanOrEqual(minX);
        expect(p.x).toBeLessThanOrEqual(MAX_LABEL_X);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.6);
      }
    },
  );

  it.each(WEB_VIEWPORTS.filter(([w, h]) => layoutMode(w, h) === "stacked"))(
    "shows all three above the sheet at %ix%i",
    (w, h) => {
      for (const p of projected(w, h)) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(MAX_LABEL_X);
        expect(p.y).toBeGreaterThan(MIN_STACKED_LABEL_Y);
        expect(p.y).toBeLessThanOrEqual(0.92);
      }
    },
  );

  it("stays closer than the overview, so the stations read", () => {
    for (const layout of ["stacked", "tablet", "desktop", "wide"] as const) {
      const subject = subjectFor("web", "php", layout) as Vec3;
      const shot = shotFor(subject, layout, 1.6, "web");
      const d = Math.hypot(...shot.position.map((v, i) => v - (shot.lookAt[i] ?? 0)));
      expect(d).toBeLessThan(CAMERA[layout].overview.dist * 0.75);
    }
  });
});
