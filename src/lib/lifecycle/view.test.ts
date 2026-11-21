import { describe, expect, it, vi } from "vitest";
import { getLifecycleMap } from "./data";
import type { LifecycleStage } from "./model";
import { createLifecycleStore } from "./store";
import {
  CLOSE_ELEVATION,
  MAP_ELEVATION,
  STAGE_DIST,
  cameraPosition,
  fitDist,
  moodAt,
  overviewPose,
  stageNear,
  stagePose,
  stopPose,
  viewMood,
} from "./view";

/* data.ts is server-only; the guard package throws outside React's server build */
vi.mock("server-only", () => ({}));

const stage = (id: LifecycleStage["id"], z0: number, z1: number, mood: number, entryX = 0): LifecycleStage => ({
  id,
  title: id,
  where: "",
  what: "",
  mood,
  first: 0,
  count: 1,
  actions: 0,
  calls: 1,
  label: [entryX, z0 - 2],
  zRange: [z0, z1],
});

const STAGES = [stage("boot", 0, 4, 0.25), stage("main", 10, 10, 1, 56), stage("shutdown", 20, 20, 0)];

describe("framing", () => {
  it("backs off further for a wider or deeper patch, and for a narrower screen", () => {
    expect(fitDist(60, 20, 16 / 9)).toBeGreaterThan(fitDist(30, 20, 16 / 9));
    expect(fitDist(30, 60, 16 / 9)).toBeGreaterThan(fitDist(30, 20, 16 / 9));
    expect(fitDist(60, 20, 1)).toBeGreaterThan(fitDist(60, 20, 16 / 9));
  });

  it("frames the whole map from above, leaving room for the panels", () => {
    const pose = overviewPose({ minX: 0, maxX: 56, minZ: 0, maxZ: 30 }, 1.6);
    expect(pose.x).toBe(28);
    expect(pose.z).toBeLessThan(15);
    expect(pose.elev).toBeUndefined();
    const [x, y, z] = cameraPosition(pose);
    expect(x).toBe(28);
    expect(y).toBeCloseTo(pose.dist * Math.sin(MAP_ELEVATION));
    expect(z).toBeCloseTo(pose.z + pose.dist * Math.cos(MAP_ELEVATION));
  });

  it("looks into a stage from the side its first row starts on, from lower down", () => {
    const bounds = { minX: -1, maxX: 57, minZ: 0, maxZ: 30 };
    const left = stagePose(STAGES[0]!, bounds);
    const right = stagePose(STAGES[1]!, bounds);
    expect(left.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThan(56);
    expect(left.dist).toBe(STAGE_DIST);
    expect(left.elev).toBe(CLOSE_ELEVATION);
    expect(stopPose(3, 4)).toMatchObject({ x: 3, z: 4, elev: CLOSE_ELEVATION });
  });
});

describe("the lighting narrative", () => {
  it("finds the stage nearest a point", () => {
    expect(stageNear(STAGES, 2)?.id).toBe("boot");
    expect(stageNear(STAGES, 9)?.id).toBe("main");
    expect(stageNear(STAGES, 99)?.id).toBe("shutdown");
    expect(stageNear([], 0)).toBeNull();
  });

  it("blends each stage's mood between their centres and holds it past the ends", () => {
    expect(moodAt(STAGES, -5, false)).toBe(0.25);
    expect(moodAt(STAGES, 2, false)).toBe(0.25);
    expect(moodAt(STAGES, 10, false)).toBe(1);
    expect(moodAt(STAGES, 6, false)).toBeCloseTo(0.625);
    expect(moodAt(STAGES, 30, false)).toBe(0);
    expect(moodAt([], 0, false)).toBe(0);
    expect(moodAt([], 0, true)).toBe(0.5);
  });

  it("shifts the whole journey darker in a dark colour scheme", () => {
    expect(moodAt(STAGES, 30, true)).toBe(0.5);
    expect(moodAt(STAGES, 10, true)).toBe(1);
  });

  it("keeps the scheme's own light far out and the stage's close up", () => {
    expect(viewMood(STAGES, 10, 200, false)).toBe(0);
    expect(viewMood(STAGES, 10, 200, true)).toBe(0.5);
    expect(viewMood(STAGES, 10, 20, false)).toBe(1);
    const between = viewMood(STAGES, 10, 54, false);
    expect(between).toBeGreaterThan(0);
    expect(between).toBeLessThan(1);
  });
});

describe("the map's store", () => {
  it("hovers, picks, and flies with a fresh request each time", () => {
    const store = createLifecycleStore();
    store.getState().hover(3);
    store.getState().select(4);
    expect(store.getState()).toMatchObject({ hovered: 3, selected: 4 });
    store.getState().flyTo({ x: 1, z: 2, dist: 3 });
    const first = store.getState().flight?.seq;
    store.getState().flyTo({ x: 1, z: 2, dist: 3 });
    expect(store.getState().flight?.seq).toBe((first ?? 0) + 1);
    store.getState().land();
    expect(store.getState().flight).toBeNull();
  });

  it("rides to the last stop, stops there, and starts over from the beginning", () => {
    const store = createLifecycleStore();
    store.getState().toggleRide(10);
    expect(store.getState()).toMatchObject({ riding: true, follow: true });
    store.getState().advance(4.5, 10);
    expect(store.getState().ride).toBe(4.5);
    store.getState().stopFollowing();
    expect(store.getState().follow).toBe(false);
    store.getState().toggleRide(10);
    expect(store.getState().riding).toBe(false);
    store.getState().toggleRide(10);
    store.getState().advance(20, 10);
    expect(store.getState()).toMatchObject({ ride: 9, riding: false });
    store.getState().toggleRide(10);
    expect(store.getState()).toMatchObject({ ride: 0, riding: true });
  });
});

describe("the map's data", () => {
  it("loads the latest version's single-post request", async () => {
    const map = await getLifecycleMap();
    expect(map.scenario).toBe("block-single");
    expect(map.request.path).toBe("/hello-world/");
    expect(map.stops.length).toBeGreaterThan(500);
  });
});
