"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { initPlatformLayout, type PlatformLayout } from "@/lib/metro/platform";
import { stationById } from "@/lib/metro/route";
import type { CueIndices } from "@/lib/story/cues";
import type { Ticket } from "@/lib/story/facts";
import type { Palette } from "../palette";
import { PICKABLE_LAYERS } from "../usePicking";
import { LABEL_LAYER, useLabelFonts } from "./labels";
import {
  BASE,
  CARD,
  FACE,
  RING_COUNT,
  SLAB,
  usePlatformParts,
  useTicketCards,
  useTicketFaces,
  type PlatformParts,
  type TicketCard,
  type TicketFace,
} from "./platformParts";
import { createFrameState, createTicketAnim, stepPlatform, type PlatformView, type TicketAnim } from "./platformMotion";

/** Round 5's passes lean back a little, towards the camera. */
const TICKET_LEAN = -0.16;
/** The ripples spread just above the line, round the init station. */
const RING_Y = 0.2;
const RING_INDICES = Array.from({ length: RING_COUNT }, (_, i) => i);
const INIT = stationById("init");

interface ViewInputs {
  readonly groups: ReadonlyArray<Group | null>;
  readonly rings: ReadonlyArray<Mesh | null>;
  readonly tickets: ReadonlyArray<Ticket>;
  readonly cards: ReadonlyArray<TicketCard>;
  readonly faces: ReadonlyArray<TicketFace> | null;
  readonly anims: ReadonlyArray<TicketAnim>;
  readonly layout: PlatformLayout;
  readonly parts: PlatformParts;
}

/** Everything the frame loop drives, once every mesh has mounted; null until then. */
function buildView(v: ViewInputs): PlatformView | null {
  const tickets = v.tickets.map((t, i) => {
    const group = v.groups[i];
    const card = v.cards[i];
    const anim = v.anims[i];
    if (!group || !card || !anim) return null;
    return {
      name: t.callback,
      group,
      card,
      anim,
      face: v.faces?.[i] ?? null,
      restY: SLAB.h,
      scale: v.layout.ticketScale,
    };
  });
  const rings = v.rings.slice(0, RING_COUNT);
  if (tickets.some((t) => t === null) || rings.some((r) => r === null)) return null;
  /* ripples stay hidden (and out of every pass) until the announcement */
  for (const ring of rings) if (ring) ring.visible = false;
  return {
    tickets: tickets.filter((t) => t !== null),
    rings: rings.filter((r) => r !== null),
    ringMaterials: v.parts.ringMaterials,
    frame: createFrameState(),
  };
}

interface InitPlatformProps {
  /** `StoryData.tickets.shown`, in run order. */
  readonly tickets: ReadonlyArray<Ticket>;
  readonly cues: CueIndices;
  /** Focus mode: the printed faces show at the init stop and in the overview only. */
  readonly facesVisible: boolean;
  readonly palette: Palette;
}

/**
 * The init platform (round 5): a slab of ticket passes, one per listener, in run order. At the
 * announcement beat ripples spread from the station; at the cascade beat each pass takes its turn
 * 0.5s after the previous one; past it, every pass is done. Timing comes from `cues.ts`, the same
 * logic the departure board reads. The platform asks for frames only while something moves.
 */
export function InitPlatform({ tickets, cues, facesVisible, palette }: InitPlatformProps) {
  const invalidate = useThree((s) => s.invalidate);
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const fonts = useLabelFonts();
  const layout = useMemo(() => initPlatformLayout(tickets.length), [tickets.length]);
  const parts = usePlatformParts(layout.width, layout.depth, palette);
  const cards = useTicketCards(tickets);
  const faces = useTicketFaces(tickets, fonts, anisotropy);
  const anims = useMemo(() => tickets.map(createTicketAnim), [tickets]);
  const pickNames = useMemo(() => tickets.map((t) => ({ card: t.callback })), [tickets]);
  const groups = useRef<(Group | null)[]>([]);
  const rings = useRef<(Mesh | null)[]>([]);
  const view = useRef<PlatformView | null>(null);

  useLayoutEffect(() => {
    view.current = buildView({
      groups: groups.current,
      rings: rings.current,
      tickets,
      cards,
      faces,
      anims,
      layout,
      parts,
    });
    invalidate();
    return () => {
      view.current = null;
    };
  }, [tickets, cards, faces, anims, layout, parts, invalidate]);

  useFrame((_, delta) => {
    if (view.current && stepPlatform(view.current, cues, delta)) invalidate();
  });

  return (
    <group>
      <mesh
        geometry={parts.slab}
        material={parts.slabMaterial}
        position={[layout.x, SLAB.h / 2, layout.z]}
        castShadow
        receiveShadow
      />
      {tickets.map((t, i) => (
        <group
          key={`${i}:${t.callback}`}
          ref={(g) => {
            groups.current[i] = g;
          }}
          position-x={layout.ticketX[i] ?? layout.x}
          position-z={layout.z}
          rotation-x={TICKET_LEAN}
          userData={pickNames[i]}
        >
          <mesh
            geometry={parts.base}
            material={parts.baseMaterial}
            position-y={BASE.y}
            layers={PICKABLE_LAYERS}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={parts.card}
            material={cards[i]?.material}
            position-y={CARD.y}
            layers={PICKABLE_LAYERS}
            castShadow
            receiveShadow
          />
          {faces?.[i] && (
            <mesh
              geometry={parts.face}
              material={faces[i].material}
              position={[0, CARD.y, FACE.z]}
              layers={PICKABLE_LAYERS}
              visible={facesVisible}
            />
          )}
        </group>
      ))}
      {RING_INDICES.map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
          geometry={parts.ring}
          material={parts.ringMaterials[i]}
          position={[INIT.x, RING_Y, INIT.z]}
          rotation-x={Math.PI / 2}
          layers={LABEL_LAYER}
        />
      ))}
    </group>
  );
}
