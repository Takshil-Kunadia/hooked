"use client";

import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type Ref } from "react";
import { Vector3, type Camera, type CurvePath, type Group } from "three";
import { useStore } from "zustand";
import { nearestParam } from "@/lib/geometry/transit";
import { stationById, type StationId } from "@/lib/metro/route";
import { arrivalS, nextTravel, travelU, type Travel } from "@/lib/story/motion";
import { storyStore } from "@/lib/story/store";
import { clamp01 } from "@/lib/story/timeline";
import { trainScreen, writeTrainArrival, writeTrainPosition, writeTrainReady } from "@/lib/story/train-screen";
import { storyNowS } from "./clock";
import { LINE_HEIGHT } from "./map/MetroLine";
import { mainLinePath } from "./map/mainLine";
import type { Palette } from "./palette";
import { BODY, CAR_LAYOUT, useTrainParts, type TrainParts } from "./trainParts";

/** Centre-to-centre distance of the two cars (round 5's CAR_GAP), leaving a slim coupling gap. */
const CAR_SPACING = 2.0;
/** The train's centre stays this far from either end, so both cars are always on the line. */
const END_MARGIN = CAR_SPACING / 2 + BODY.d / 2;
/** The train pill floats this far above the lead car (round 5). */
const PILL_LIFT = 0.9;
/** Half the line distance sampled either side of a car to find its heading. */
const HEADING_STEP = 0.02;

interface Scratch {
  readonly point: Vector3;
  readonly behind: Vector3;
  readonly ahead: Vector3;
  readonly screen: Vector3;
}

const createScratch = (): Scratch => ({
  point: new Vector3(),
  behind: new Vector3(),
  ahead: new Vector3(),
  screen: new Vector3(),
});

/** Stands a car on the line `s` units along it, facing the direction of travel. No allocation. */
function placeCar(car: Group, path: CurvePath<Vector3>, length: number, s: number, v: Scratch): void {
  path.getPointAt(clamp01(s / length), v.point);
  path.getPointAt(clamp01((s - HEADING_STEP) / length), v.behind);
  path.getPointAt(clamp01((s + HEADING_STEP) / length), v.ahead);
  car.position.set(v.point.x, LINE_HEIGHT, v.point.z);
  car.rotation.y = Math.atan2(v.ahead.x - v.behind.x, v.ahead.z - v.behind.z);
}

/** Round 5's `placeTrain`: the train is centred on `u`, so at a stop the marker sits in the coupling gap. */
function placeTrain(lead: Group, rear: Group, path: CurvePath<Vector3>, length: number, u: number, v: Scratch): void {
  const centre = Math.min(Math.max(u * length, END_MARGIN), length - END_MARGIN);
  placeCar(lead, path, length, centre + CAR_SPACING / 2, v);
  placeCar(rear, path, length, centre - CAR_SPACING / 2, v);
}

/** Projects the point above the lead car to CSS pixels on the canvas, for the DOM train pill. */
function reportScreen(lead: Group, camera: Camera, size: RootState["size"], v: Scratch): void {
  const q = v.screen
    .copy(lead.position)
    .setY(lead.position.y + PILL_LIFT)
    .project(camera);
  const visible = q.z > -1 && q.z < 1;
  writeTrainPosition(trainScreen, ((q.x + 1) / 2) * size.width, ((1 - q.y) / 2) * size.height, visible);
}

interface CarProps {
  readonly ref: Ref<Group>;
  readonly parts: TrainParts;
  /** The lead car carries the windscreen and headlights. */
  readonly lead: boolean;
}

export function Car({ ref, parts, lead }: CarProps) {
  return (
    <group ref={ref}>
      <mesh geometry={parts.body} material={parts.bodyMaterial} position-y={BODY.y} castShadow receiveShadow />
      <mesh
        geometry={parts.glass}
        material={parts.glassMaterial}
        position-y={CAR_LAYOUT.glassY}
        castShadow
        receiveShadow
      />
      {CAR_LAYOUT.pillarZ.map((z) => (
        <mesh
          key={z}
          geometry={parts.pillar}
          material={parts.bodyMaterial}
          position={[0, CAR_LAYOUT.glassY, z]}
          receiveShadow
        />
      ))}
      <mesh geometry={parts.stripe} material={parts.stripeMaterial} position-y={CAR_LAYOUT.stripeY} receiveShadow />
      {lead && (
        <>
          <mesh
            geometry={parts.windscreen}
            material={parts.glassMaterial}
            position={[0, CAR_LAYOUT.glassY, CAR_LAYOUT.windscreenZ]}
            receiveShadow
          />
          {CAR_LAYOUT.lamps.map((p) => (
            <mesh key={p[0]} geometry={parts.lamp} material={parts.lampMaterial} position={p} />
          ))}
        </>
      )}
    </group>
  );
}

interface TrainProps {
  /** The stop the current beat is at. */
  readonly station: StationId;
  readonly palette: Palette;
}

/**
 * The request, as a two-car train on the main line. It eases between stops (ease-in-out-cubic,
 * 0.9–3s by distance), retargets from where it is when the beat changes mid-trip, and reports its
 * screen position and arrival time through `trainScreen`, and marks itself `ready` there while it is
 * mounted. It asks for frames only while moving.
 */
export function Train({ station, palette }: TrainProps) {
  const invalidate = useThree((s) => s.invalidate);
  const reducedMotion = useStore(storyStore, (s) => s.reducedMotion);
  const parts = useTrainParts(palette);
  const path = mainLinePath();
  const length = useMemo(() => path.getLength(), [path]);
  const targetU = useMemo(() => {
    const s = stationById(station);
    return nearestParam(path, s.x, s.z);
  }, [path, station]);
  const lead = useRef<Group>(null);
  const rear = useRef<Group>(null);
  const travel = useRef<Travel | null>(null);
  const scratch = useMemo(() => createScratch(), []);

  useLayoutEffect(() => {
    const now = storyNowS();
    const current = travel.current;
    const next = nextTravel(current, now, targetU, length, reducedMotion);
    if (next === current) return;
    travel.current = next;
    writeTrainArrival(trainScreen, next.duration > 0 ? null : now);
    invalidate();
  }, [targetU, length, reducedMotion, invalidate]);

  /* after the first stop is set: the stage's E2E hooks follow this train from here on */
  useLayoutEffect(() => {
    writeTrainReady(trainScreen, true);
    return () => writeTrainReady(trainScreen, false);
  }, []);

  /* the pill hides while there is no train to point at */
  useEffect(() => () => writeTrainPosition(trainScreen, 0, 0, false), []);

  useFrame((state) => {
    const trip = travel.current;
    if (!trip || !lead.current || !rear.current) return;
    const now = storyNowS();
    placeTrain(lead.current, rear.current, path, length, travelU(trip, now), scratch);
    reportScreen(lead.current, state.camera, state.size, scratch);
    const arrival = arrivalS(trip);
    if (now < arrival) {
      invalidate();
    } else if (trainScreen.getState().arrivedAtS === null) {
      writeTrainArrival(trainScreen, arrival);
      /* one more frame, so whatever waits on the arrival (the init cascade) sees it */
      invalidate();
    }
  });

  return (
    <>
      <Car ref={lead} parts={parts} lead />
      <Car ref={rear} parts={parts} lead={false} />
    </>
  );
}
