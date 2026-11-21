"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Vector3 } from "three";
import type { LifecycleStop } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";

/**
 * Hook names, printed beside their stops at an angle like a transit diagram's station names.
 * They are plain HTML laid over the canvas (crisp at any zoom, no textures): each frame picks the
 * stops on screen that have room for a name and moves a pool of labels onto them.
 */
const POOL = 160;
/** Two names closer than this on screen would overlap; the later one is skipped. */
const MIN_GAP_PX = 22;
const LIFT = 0.35;
const ANGLE_DEG = 38;
const SIN = Math.sin((ANGLE_DEG * Math.PI) / 180);
/** Width of one character of the 11px monospace name. */
const CHAR_PX = 6.7;
/** Fewer characters than this would say nothing: the names wait until the map is closer. */
const MIN_CHARS = 14;

interface LabelLayerProps {
  readonly stops: ReadonlyArray<LifecycleStop>;
  readonly overlay: RefObject<HTMLDivElement | null>;
  /** Screen pixels between two rows of the line where the camera looks, written each frame. */
  readonly rowGapPx: RefObject<number>;
}

export function LabelLayer({ stops, overlay, rowGapPx }: LabelLayerProps) {
  const pool = useRef<HTMLSpanElement[]>([]);
  const world = useMemo(() => stops.map((s) => new Vector3(s.x, LIFT, s.z)), [stops]);
  const scratch = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const root = overlay.current;
    if (!root) return;
    const spans = Array.from({ length: POOL }, () => {
      const span = document.createElement("span");
      span.className = "map-name";
      span.style.opacity = "0";
      root.appendChild(span);
      return span;
    });
    pool.current = spans;
    return () => {
      spans.forEach((s) => s.remove());
      pool.current = [];
    };
  }, [overlay]);

  useFrame((state) => {
    const spans = pool.current;
    if (spans.length === 0) return;
    const { camera, size } = state;
    camera.updateMatrixWorld();
    const { hovered, selected, ride, riding } = lifecycleStore.getState();
    const current = riding || ride > 0 ? Math.floor(ride) : null;
    const focus = new Set([hovered, selected, current].filter((i): i is number => i !== null));
    /* a name rises at an angle; it must stay below the row above */
    const maxChars = Math.floor((rowGapPx.current * 0.85) / SIN / CHAR_PX);
    const named = maxChars >= MIN_CHARS;

    let used = 0;
    let lastX = -Infinity;
    let lastY = -Infinity;
    const show = (i: number, x: number, y: number, strong: boolean): void => {
      const span = spans[used++];
      const stop = stops[i];
      if (!span || !stop) return;
      const text =
        strong || stop.name.length <= maxChars ? stop.name : `${stop.name.slice(0, Math.max(1, maxChars - 1))}…`;
      if (span.textContent !== text) span.textContent = text;
      span.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(-${ANGLE_DEG}deg)`;
      span.style.opacity = "1";
      if (strong) span.dataset.strong = "";
      else delete span.dataset.strong;
    };
    const project = (i: number): readonly [number, number] | null => {
      const p = world[i];
      if (!p) return null;
      scratch.copy(p).project(camera);
      if (scratch.z < -1 || scratch.z > 1) return null;
      const x = ((scratch.x + 1) / 2) * size.width;
      const y = ((1 - scratch.y) / 2) * size.height;
      if (x < -20 || x > size.width + 20 || y < -20 || y > size.height + 40) return null;
      return [x, y];
    };

    focus.forEach((i) => {
      const at = project(i);
      if (at) show(i, at[0], at[1], true);
    });
    if (named) {
      for (let i = 0; i < stops.length && used < spans.length; i++) {
        if (focus.has(i)) continue;
        const at = project(i);
        if (!at) continue;
        if (Math.hypot(at[0] - lastX, at[1] - lastY) < MIN_GAP_PX) continue;
        lastX = at[0];
        lastY = at[1];
        show(i, at[0], at[1], false);
      }
    }
    for (let k = used; k < spans.length; k++) {
      const span = spans[k];
      if (span && span.style.opacity !== "0") span.style.opacity = "0";
    }
  });

  return null;
}
