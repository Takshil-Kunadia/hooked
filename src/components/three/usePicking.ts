"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Layers, Raycaster, Vector2, type Camera, type Intersection, type Object3D, type Scene } from "three";
import { pointerHover } from "@/lib/story/hover-intent";
import { storyStore } from "@/lib/story/store";

/** Objects with a hover card also live on this layer, so a pick only tests them, never the floor or lines. */
const PICK_LAYER = 2;

/** Rendered on the default layer and picked on PICK_LAYER: pass as a mesh's `layers` prop. */
export const PICKABLE_LAYERS = new Layers();
PICKABLE_LAYERS.enable(PICK_LAYER);

const HOVER_CURSOR = "help";

/** The card name of the nearest pickable object's owner (the group carrying `userData.card`). */
function cardOf(object: Object3D): string | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    const card: unknown = o.userData.card;
    if (typeof card === "string") return card;
  }
  return null;
}

interface Picker {
  readonly raycaster: Raycaster;
  readonly ndc: Vector2;
  readonly hits: Intersection[];
}

function createPicker(): Picker {
  const raycaster = new Raycaster();
  raycaster.layers.set(PICK_LAYER);
  return { raycaster, ndc: new Vector2(), hits: [] };
}

/** The card under a viewport point, reusing the picker's objects (no allocation per pick). */
function pickAt(
  p: Picker,
  canvas: HTMLCanvasElement,
  camera: Camera,
  scene: Scene,
  x: number,
  y: number,
): string | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  p.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  p.raycaster.setFromCamera(p.ndc, camera);
  p.hits.length = 0;
  p.raycaster.intersectObject(scene, true, p.hits);
  const first = p.hits[0];
  return first ? cardOf(first.object) : null;
}

interface PickingSession {
  /** Re-picks under a resting pointer: the scene can move beneath it (scrolling moves the camera). */
  refresh(): void;
  stop(): void;
}

/** Listens to the canvas and reports hovers and taps to the story store. */
function startPicking(canvas: HTMLCanvasElement, camera: Camera, scene: Scene): PickingSession {
  const picker = createPicker();
  /* the latest hovering pointer, in viewport pixels; NaN when it has left the canvas */
  let pointerX = Number.NaN;
  let pointerY = Number.NaN;
  let hovered: string | null = null;
  let frame = 0;

  const updateHover = (): void => {
    const name = Number.isNaN(pointerX) ? null : pickAt(picker, canvas, camera, scene, pointerX, pointerY);
    if (name === hovered) return;
    hovered = name;
    canvas.style.cursor = name ? HOVER_CURSOR : "";
    pointerHover.send({ type: "anchor", name });
  };
  const flushHover = (): void => {
    frame = 0;
    updateHover();
  };
  const scheduleHover = (): void => {
    if (frame === 0) frame = requestAnimationFrame(flushHover);
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType === "touch") return;
    pointerX = e.clientX;
    pointerY = e.clientY;
    scheduleHover();
  };
  const onLeave = (): void => {
    pointerX = Number.NaN;
    scheduleHover();
  };
  const onClick = (e: MouseEvent): void => {
    storyStore.getState().pin(pickAt(picker, canvas, camera, scene, e.clientX, e.clientY));
  };

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("click", onClick);
  return {
    refresh() {
      if (!Number.isNaN(pointerX)) updateHover();
    },
    stop() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
      if (frame !== 0) cancelAnimationFrame(frame);
      canvas.style.cursor = "";
      /* the map is gone: close the card its pointer opened at once, no grace */
      if (hovered !== null) pointerHover.send({ type: "dismiss" });
    },
  };
}

/**
 * Hover and tap on the map's stations, tickets and depot, reported to the story store as card names
 * (the same names the DOM's `[data-card]` elements use, so highlights link both ways).
 *
 * Pointer events: the canvas takes them wherever nothing sits above it. R3F's canvas container is
 * `pointer-events: auto` (it overrides the stage wrapper's `none`), and the story copy is laid over
 * the stage, so the copy layer decides what the scene can hear: full-viewport copy layers must be
 * `pointer-events: none`, with `auto` on the copy column, boards, rail and cards. Clicks on the
 * canvas belong to picking: a hit pins its card, a miss unpins, so a document-level "click outside
 * closes the card" handler should skip events whose target is inside the stage (`[data-stage]`).
 *
 * Hover follows mouse and pen only (touch has no hover), through `pointerHover`, so a card stays
 * open while the pointer crosses onto it; a tap pins. Hover picks are coalesced to
 * one per animation frame, and repeated on every rendered frame while the pointer rests on the
 * canvas, since frames only render while something on the map moves.
 */
export function usePicking(): void {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const session = useRef<PickingSession | null>(null);

  useEffect(() => {
    const started = startPicking(gl.domElement, camera, scene);
    session.current = started;
    return () => {
      session.current = null;
      started.stop();
    };
  }, [gl, camera, scene]);

  useFrame(() => session.current?.refresh());
}
