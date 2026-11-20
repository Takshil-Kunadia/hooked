import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { buildTransitPath, nearestParam } from "@/lib/geometry/transit";
import { FEEDER_LINES, MAIN_LINE, STATIONS, DEPOT, stationById, type LineSpec } from "./route";

const pathOf = (spec: LineSpec) =>
  buildTransitPath(
    spec.points.map(([x, z]) => new Vector3(x, 0, z)),
    spec.cornerRadius,
  );
const main = pathOf(MAIN_LINE);
const distanceToMain = (x: number, z: number) => {
  const p = main.getPointAt(nearestParam(main, x, z));
  return Math.hypot(p.x - x, p.z - z);
};

describe("map data", () => {
  it("stations sit on the main line", () => {
    for (const s of STATIONS) expect(distanceToMain(s.x, s.z), s.id).toBeLessThan(0.05);
  });

  it("stations run in travel order", () => {
    const params = STATIONS.map((s) => nearestParam(main, s.x, s.z));
    params.forEach((u, i) => {
      if (i > 0) expect(u, STATIONS[i]?.id).toBeGreaterThan(params[i - 1]!);
    });
  });

  it("stations are spaced", () => {
    STATIONS.forEach((a, i) => {
      STATIONS.slice(i + 1).forEach((b) => {
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThanOrEqual(2.4);
      });
    });
  });

  it("ids are unique and found by stationById", () => {
    expect(new Set(STATIONS.map((s) => s.id)).size).toBe(STATIONS.length);
    expect(stationById("init").title).toBe("init");
    expect(STATIONS.map((s) => s.id)).toEqual([
      "browser",
      "server",
      "php",
      "index",
      "config",
      "settings",
      "init",
      "query",
      "template",
      "the_title",
      "response",
    ]);
  });

  it("feeder lines join at wp-settings", () => {
    const settings = stationById("settings");
    const feeders = FEEDER_LINES.filter((l) => l.kind === "feeder");
    expect(feeders.map((l) => l.origin).sort()).toEqual(["dropin", "mu", "plugin", "theme"]);
    for (const l of feeders) {
      const [x, z] = l.points[l.points.length - 1]!;
      expect(distanceToMain(x, z), l.id).toBeLessThan(0.6);
      expect(Math.abs(x - settings.x), l.id).toBeLessThan(3);
    }
  });

  it("the depot spur starts on the main line near WP_Query", () => {
    const spur = FEEDER_LINES.find((l) => l.id === "depot")!;
    const [x, z] = spur.points[0]!;
    expect(distanceToMain(x, z)).toBeLessThan(0.6);
    expect(Math.abs(x - stationById("query").x)).toBeLessThan(0.5);
    expect(DEPOT.x).toBeCloseTo(stationById("query").x, 5);
  });
});
