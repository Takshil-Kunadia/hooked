"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import { MOUSE, TOUCH, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { lifecycleStore } from "@/lib/lifecycle/store";
import { cameraPosition, STOP_DIST, type MapPose } from "@/lib/lifecycle/view";

const MIN_DIST = 3.5;
const MAX_DIST = 320;
/** Keeps the map from turning into a horizon view or flipping over. */
const MIN_POLAR = 0.15;
const MAX_POLAR = 1.15;
const DAMPING = 0.12;
/** How quickly a flight closes the gap, per second (exponential). */
const FLY_RATE = 3.2;
const FOLLOW_RATE = 4;
const LANDED = 0.02;

function configure(controls: MapControls): void {
  controls.enableDamping = true;
  controls.dampingFactor = DAMPING;
  controls.screenSpacePanning = false;
  controls.minDistance = MIN_DIST;
  controls.maxDistance = MAX_DIST;
  controls.minPolarAngle = MIN_POLAR;
  controls.maxPolarAngle = MAX_POLAR;
  controls.zoomToCursor = true;
  controls.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
  controls.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
}

interface MapCameraProps {
  /** Where the camera starts. */
  readonly home: MapPose;
  /** Where the train is, written by the train each frame. */
  readonly train: RefObject<{ x: number; z: number }>;
  readonly reducedMotion: boolean;
  /** Told where the camera looks whenever it moves (the lighting follows it). */
  readonly onLook: (x: number, z: number, dist: number) => void;
}

/** Drag to pan, scroll or pinch to zoom, right-drag or two fingers to turn; flights and the ride steer it too. */
export function MapCamera({ home, train, reducedMotion, onLook }: MapCameraProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useMemo(() => new MapControls(camera, gl.domElement), [camera, gl]);
  const scratch = useMemo(() => ({ goal: new Vector3(), offset: new Vector3(), eye: new Vector3() }), []);

  useEffect(() => {
    configure(controls);
    const onChange = (): void => invalidate();
    const onStart = (): void => lifecycleStore.getState().stopFollowing();
    controls.addEventListener("change", onChange);
    controls.addEventListener("start", onStart);
    return () => {
      controls.removeEventListener("change", onChange);
      controls.removeEventListener("start", onStart);
      controls.dispose();
    };
  }, [controls, invalidate]);

  /* the first view: the whole request */
  useEffect(() => {
    controls.target.set(home.x, 0, home.z);
    camera.position.set(...cameraPosition(home));
    controls.update();
    invalidate();
  }, [controls, camera, home, invalidate]);

  useFrame((_, delta) => {
    const { flight, follow, riding } = lifecycleStore.getState();
    const dt = Math.min(delta, 0.1);
    let moving = false;

    if (flight) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-FLY_RATE * dt);
      scratch.goal.set(flight.x, 0, flight.z);
      scratch.eye.set(...cameraPosition(flight));
      controls.target.lerp(scratch.goal, k);
      camera.position.lerp(scratch.eye, k);
      if (controls.target.distanceTo(scratch.goal) < LANDED && camera.position.distanceTo(scratch.eye) < LANDED) {
        lifecycleStore.getState().land();
      }
      moving = true;
    } else if (follow && riding) {
      const k = reducedMotion ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt);
      scratch.goal.set(train.current.x, 0, train.current.z);
      scratch.offset.copy(camera.position).sub(controls.target);
      const dist = scratch.offset.length();
      scratch.offset.setLength(dist + (STOP_DIST * 1.6 - dist) * k);
      controls.target.lerp(scratch.goal, k);
      camera.position.copy(controls.target).add(scratch.offset);
      moving = true;
    }

    if (controls.update(dt) || moving) invalidate();
    onLook(controls.target.x, controls.target.z, camera.position.distanceTo(controls.target));
  });

  return null;
}
