"use client";

import { useFrame, useThree, type RootState } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { Vector3, type CurvePath, type Group } from "three";
import type { LifecycleStop } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";
import { LINE_HEIGHT } from "../three/map/MetroLine";
import type { Palette } from "../three/palette";
import { Car } from "../three/Train";
import { useTrainParts } from "../three/trainParts";

/** Half-size train, so it reads against stops spaced well under a unit apart. */
const TRAIN_SCALE = 0.5;
const CAR_SPACING = 2.0 * TRAIN_SCALE;
/** Stops per second at 1× speed: the whole request takes about a minute. */
const RIDE_SPEED = 12;
const PILL_LIFT = 0.7;
const SAMPLES = 8000;

/** Each stop's position along the line (0–1), from a dense sampling of the path. */
function stopParams(path: CurvePath<Vector3>, stops: ReadonlyArray<LifecycleStop>): Float64Array {
  const points = path.getSpacedPoints(SAMPLES);
  const params = new Float64Array(stops.length);
  let from = 0;
  stops.forEach((s, i) => {
    /* stops come in path order, so the search starts where the last one was found */
    let best = from;
    let bestD = Infinity;
    for (let k = from; k < points.length; k++) {
      const p = points[k]!;
      const d = (p.x - s.x) ** 2 + (p.z - s.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
      if (bestD < 0.01 && d > bestD + 4) break;
    }
    from = best;
    params[i] = best / SAMPLES;
  });
  return params;
}

interface Scratch {
  readonly p: Vector3;
  readonly t: Vector3;
  readonly q: Vector3;
}

/** Where along the line (0–1) the train is when it is `ride` stops in. */
function rideParam(params: Float64Array, ride: number): number {
  const i = Math.floor(ride);
  const a = params[i] ?? 0;
  const b = params[Math.min(params.length - 1, i + 1)] ?? a;
  return a + (b - a) * (ride - i);
}

function placeCar(car: Group | null, path: CurvePath<Vector3>, at: number, s: Scratch): void {
  if (!car) return;
  const u = Math.min(1, Math.max(0, at));
  path.getPointAt(u, s.p);
  path.getTangentAt(u, s.t);
  car.position.set(s.p.x, LINE_HEIGHT, s.p.z);
  car.rotation.set(0, Math.atan2(s.t.x, s.t.z), 0);
  car.scale.setScalar(TRAIN_SCALE);
}

const pillText = (stop: LifecycleStop | undefined): string =>
  stop ? `${stop.type === "action" ? "do_action" : "apply_filters"}( '${stop.name}' )` : "";

/** Moves the pill over the lead car and names the stop; returns the stop it now names. */
function writePill(
  el: HTMLDivElement | null,
  lead: Group,
  state: RootState,
  started: boolean,
  stops: ReadonlyArray<LifecycleStop>,
  ride: number,
  shown: number,
  s: Scratch,
): number {
  if (!el) return shown;
  s.q.copy(lead.position).setY(PILL_LIFT).project(state.camera);
  const onScreen = started && s.q.z > -1 && s.q.z < 1;
  const x = ((s.q.x + 1) / 2) * state.size.width;
  const y = ((1 - s.q.y) / 2) * state.size.height;
  el.style.opacity = onScreen ? "1" : "0";
  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
  const i = Math.floor(ride);
  if (shown !== i) el.textContent = pillText(stops[i]);
  return i;
}

interface RideTrainProps {
  readonly path: CurvePath<Vector3>;
  readonly stops: ReadonlyArray<LifecycleStop>;
  readonly palette: Palette;
  /** The pill above the train: its text and screen position are written straight to it. */
  readonly pill: RefObject<HTMLDivElement | null>;
  readonly onTrain: (x: number, z: number) => void;
}

export function RideTrain({ path, stops, palette, pill, onTrain }: RideTrainProps) {
  const invalidate = useThree((s) => s.invalidate);
  const parts = useTrainParts(palette);
  const params = useMemo(() => stopParams(path, stops), [path, stops]);
  const length = useMemo(() => path.getLength(), [path]);
  const lead = useRef<Group>(null);
  const rear = useRef<Group>(null);
  const scratch = useMemo<Scratch>(() => ({ p: new Vector3(), t: new Vector3(), q: new Vector3() }), []);
  const shown = useRef(-1);

  useFrame((state, delta) => {
    const store = lifecycleStore.getState();
    if (store.riding) {
      store.advance(Math.min(delta, 0.1) * RIDE_SPEED, stops.length);
      invalidate();
    }
    const ride = lifecycleStore.getState().ride;
    const u = rideParam(params, ride);
    placeCar(lead.current, path, u, scratch);
    placeCar(rear.current, path, u - CAR_SPACING / length, scratch);
    if (!lead.current) return;
    onTrain(lead.current.position.x, lead.current.position.z);
    const started = store.riding || ride > 0;
    shown.current = writePill(pill.current, lead.current, state, started, stops, ride, shown.current, scratch);
  });

  return (
    <>
      <Car ref={lead} parts={parts} lead />
      <Car ref={rear} parts={parts} lead={false} />
    </>
  );
}
