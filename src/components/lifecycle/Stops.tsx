"use client";

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, Object3D, TorusGeometry, type InstancedMesh } from "three";
import { ORIGIN_COLOURS } from "@/lib/design/tokens";
import type { LifecycleStop } from "@/lib/lifecycle/model";
import { lifecycleStore } from "@/lib/lifecycle/store";
import type { MapMaterials } from "../three/map/materials";
import { pill } from "../three/map/StationMarker";

/*
 * Every hook is a stop, in the prop vocabulary: a filter is a porcelain portal the train passes
 * through (taller the more often it ran), an action a station marker laid across the line.
 */
const ARCH = { radius: 0.3, tube: 0.07, radial: 10, tubular: 28 } as const;
/** log10 of the call count adds this much height: 1,000 calls make an arch ~2.6× taller. */
const ARCH_GROWTH = 0.55;
const PILL = { len: 0.62, wid: 0.28, rim: 0.12, rimDepth: 0.14, faceDepth: 0.19 } as const;
/** A click that moved the pointer further than this was a drag of the map. */
const CLICK_SLOP_PX = 5;

const PORCELAIN = new Color("#F4F3F0");
const PASSED = new Color(ORIGIN_COLOURS.core);
const CURRENT = new Color("#3858E9");
const INK = new Color("#2B2D33");

type Kind = "arch" | "pill";

interface Instances {
  /** Stop index of each instance, per mesh. */
  readonly arch: ReadonlyArray<number>;
  readonly pill: ReadonlyArray<number>;
  /** Mesh and instance of each stop. */
  readonly of: ReadonlyArray<readonly [Kind, number]>;
}

function splitInstances(stops: ReadonlyArray<LifecycleStop>): Instances {
  const arch: number[] = [];
  const pills: number[] = [];
  const of = stops.map((s, i): readonly [Kind, number] => {
    if (s.type === "filter") {
      arch.push(i);
      return ["arch", arch.length - 1];
    }
    pills.push(i);
    return ["pill", pills.length - 1];
  });
  return { arch, pill: pills, of };
}

function archGeometry(): TorusGeometry {
  /* a half torus standing on the floor, turned to span the line (which runs along x) */
  const g = new TorusGeometry(ARCH.radius, ARCH.tube, ARCH.radial, ARCH.tubular, Math.PI);
  g.rotateY(Math.PI / 2);
  return g;
}

function placeInstances(
  mesh: InstancedMesh,
  indexes: ReadonlyArray<number>,
  stops: ReadonlyArray<LifecycleStop>,
  kind: Kind,
): void {
  const o = new Object3D();
  indexes.forEach((stopIndex, k) => {
    const s = stops[stopIndex];
    if (!s) return;
    o.position.set(s.x, 0, s.z);
    o.rotation.set(kind === "pill" ? -Math.PI / 2 : 0, 0, kind === "pill" ? Math.PI / 2 : 0);
    const grow = kind === "arch" ? 1 + ARCH_GROWTH * Math.log10(Math.max(1, s.count)) : 1;
    o.scale.set(1, kind === "arch" ? grow : 1, 1);
    o.updateMatrix();
    mesh.setMatrixAt(k, o.matrix);
    mesh.setColorAt(k, PORCELAIN);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

interface StopsProps {
  readonly stops: ReadonlyArray<LifecycleStop>;
  readonly materials: MapMaterials;
}

/** The stops, as two instanced meshes (one draw call each), recoloured straight from the store. */
export function Stops({ stops, materials }: StopsProps) {
  const invalidate = useThree((s) => s.invalidate);
  const instances = useMemo(() => splitInstances(stops), [stops]);
  const arch = useMemo(() => archGeometry(), []);
  const pillRim = useMemo(() => pill(PILL.len + PILL.rim, PILL.wid + PILL.rim, PILL.rimDepth), []);
  const pillFace = useMemo(() => pill(PILL.len, PILL.wid, PILL.faceDepth), []);
  const archMesh = useRef<InstancedMesh>(null);
  const rimMesh = useRef<InstancedMesh>(null);
  const faceMesh = useRef<InstancedMesh>(null);
  useEffect(
    () => () => {
      arch.dispose();
      pillRim.dispose();
      pillFace.dispose();
    },
    [arch, pillRim, pillFace],
  );

  useLayoutEffect(() => {
    if (archMesh.current) placeInstances(archMesh.current, instances.arch, stops, "arch");
    if (faceMesh.current) placeInstances(faceMesh.current, instances.pill, stops, "pill");
    if (rimMesh.current) {
      placeInstances(rimMesh.current, instances.pill, stops, "pill");
      instances.pill.forEach((_, k) => rimMesh.current?.setColorAt(k, INK));
    }
    invalidate();
  }, [instances, stops, invalidate]);

  /* colour: the current stop blue, stops the train has passed in the core's periwinkle */
  useEffect(() => {
    const paint = (stopIndex: number, colour: Color): void => {
      const [kind, k] = instances.of[stopIndex] ?? [];
      const mesh = kind === "arch" ? archMesh.current : kind === "pill" ? rimMesh.current : null;
      if (!mesh || k === undefined) return;
      mesh.setColorAt(k, colour);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    const base = (i: number, ride: number, rideStarted: boolean): Color => {
      if (rideStarted && i < ride) return PASSED;
      return instances.of[i]?.[0] === "pill" ? INK : PORCELAIN;
    };
    let painted = new Set<number>();
    let passedUpTo = 0;
    const repaint = (): void => {
      const { hovered, selected, ride, riding } = lifecycleStore.getState();
      const started = riding || ride > 0;
      const current = Math.floor(ride);
      const reach = started ? current : 0;
      for (let i = Math.min(reach, passedUpTo); i < Math.max(reach, passedUpTo); i++)
        paint(i, base(i, current, started));
      passedUpTo = reach;
      const lit = new Set<number>([hovered, selected, started ? current : null].filter((i): i is number => i !== null));
      painted.forEach((i) => {
        if (!lit.has(i)) paint(i, base(i, current, started));
      });
      lit.forEach((i) => paint(i, CURRENT));
      painted = lit;
      invalidate();
    };
    repaint();
    return lifecycleStore.subscribe(repaint);
  }, [instances, invalidate]);

  const handlers = useMemo(() => {
    const stopOf = (kind: Kind, e: ThreeEvent<PointerEvent | MouseEvent>): number | null => {
      if (e.instanceId === undefined) return null;
      return (kind === "arch" ? instances.arch : instances.pill)[e.instanceId] ?? null;
    };
    const make = (kind: Kind) => ({
      onPointerMove: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        const i = stopOf(kind, e);
        if (lifecycleStore.getState().hovered !== i) lifecycleStore.getState().hover(i);
        document.body.style.cursor = "pointer";
      },
      onPointerOut: () => {
        lifecycleStore.getState().hover(null);
        document.body.style.cursor = "";
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > CLICK_SLOP_PX) return;
        e.stopPropagation();
        lifecycleStore.getState().select(stopOf(kind, e));
      },
    });
    return { arch: make("arch"), pill: make("pill") };
  }, [instances]);

  return (
    <group>
      <instancedMesh
        ref={archMesh}
        args={[arch, materials.porcelain, instances.arch.length]}
        castShadow
        receiveShadow
        {...handlers.arch}
      />
      <instancedMesh
        ref={rimMesh}
        args={[pillRim, materials.porcelain, instances.pill.length]}
        castShadow
        receiveShadow
        {...handlers.pill}
      />
      <instancedMesh
        ref={faceMesh}
        args={[pillFace, materials.stationWhite, instances.pill.length]}
        castShadow
        receiveShadow
        {...handlers.pill}
      />
    </group>
  );
}
