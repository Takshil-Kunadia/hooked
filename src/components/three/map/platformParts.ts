import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { Color, MeshBasicMaterial, PlaneGeometry, TorusGeometry, type MeshPhysicalMaterial, type Texture } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ORIGIN_COLOURS } from "@/lib/design/tokens";
import type { Ticket } from "@/lib/story/facts";
import type { Palette } from "../palette";
import type { LabelFonts } from "./labels";
import { physical } from "./materials";
import { ticketFaceTexture } from "./ticketFace";

/* Round 5's init platform. A pass is a porcelain foot, a card and its printed face, which sits a
 * hair in front of the card so the two never coincide. */
export const SLAB = { h: 0.12, segments: 6, radius: 0.05 } as const;
const SLAB_COLOUR = "#ECE9E3";
export const BASE = { w: 0.44, h: 0.05, d: 0.24, segments: 3, radius: 0.02, y: 0.025 } as const;
export const CARD = { w: 0.64, h: 0.92, d: 0.04, segments: 8, radius: 0.06, y: 0.52 } as const;
export const FACE = { w: 0.634, h: 0.914, z: 0.0215 } as const;
const RING = { radius: 0.8, tube: 0.018, radialSegments: 8, tubularSegments: 120 } as const;
/** Three ripples spread from the station on the announcement. */
export const RING_COUNT = 3;
export const TICKET_DARK = "#16171b";

export interface PlatformParts {
  readonly slab: RoundedBoxGeometry;
  readonly base: RoundedBoxGeometry;
  readonly card: RoundedBoxGeometry;
  readonly face: PlaneGeometry;
  readonly ring: TorusGeometry;
  readonly slabMaterial: MeshPhysicalMaterial;
  readonly baseMaterial: MeshPhysicalMaterial;
  readonly ringMaterials: ReadonlyArray<MeshBasicMaterial>;
}

function createParts(width: number, depth: number): PlatformParts {
  return {
    slab: new RoundedBoxGeometry(width, SLAB.h, depth, SLAB.segments, SLAB.radius),
    base: new RoundedBoxGeometry(BASE.w, BASE.h, BASE.d, BASE.segments, BASE.radius),
    card: new RoundedBoxGeometry(CARD.w, CARD.h, CARD.d, CARD.segments, CARD.radius),
    face: new PlaneGeometry(FACE.w, FACE.h),
    ring: new TorusGeometry(RING.radius, RING.tube, RING.radialSegments, RING.tubularSegments),
    slabMaterial: physical(SLAB_COLOUR, { roughness: 0.6 }),
    baseMaterial: physical("#ffffff"),
    ringMaterials: Array.from(
      { length: RING_COUNT },
      () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    ),
  };
}

function disposeParts(parts: PlatformParts): void {
  const { ringMaterials, ...rest } = parts;
  [...Object.values(rest), ...ringMaterials].forEach((part) => part.dispose());
}

/** The feet are porcelain like the rest of the map; the ripples take the tile's ring colour. */
function paintParts(parts: PlatformParts, palette: Palette): void {
  parts.baseMaterial.color.set(palette.porcelain);
  parts.ringMaterials.forEach((m) => m.color.set(palette.ring));
}

/** The platform's shared geometry and materials, repainted per tile and freed on unmount. */
export function usePlatformParts(width: number, depth: number, palette: Palette): PlatformParts {
  const invalidate = useThree((s) => s.invalidate);
  const parts = useMemo(() => createParts(width, depth), [width, depth]);
  useEffect(() => () => disposeParts(parts), [parts]);
  useLayoutEffect(() => {
    paintParts(parts, palette);
    invalidate();
  }, [parts, palette, invalidate]);
  return parts;
}

/** One card material per pass: dark while waiting, tinted toward its origin colour once done. */
export interface TicketCard {
  readonly material: MeshPhysicalMaterial;
  readonly origin: Color;
}

export function useTicketCards(tickets: ReadonlyArray<Ticket>): ReadonlyArray<TicketCard> {
  const cards = useMemo(
    () =>
      tickets.map((t) => {
        const colour = ORIGIN_COLOURS[t.origin];
        return {
          material: physical(TICKET_DARK, { roughness: 0.3, clearcoat: 1, emissive: colour, emissiveIntensity: 0 }),
          origin: new Color(colour),
        };
      }),
    [tickets],
  );
  useEffect(() => () => cards.forEach((c) => c.material.dispose()), [cards]);
  return cards;
}

/** A pass's printed face: one material whose map swaps between the waiting and done prints. */
export interface TicketFace {
  readonly material: MeshBasicMaterial;
  readonly waiting: Texture;
  readonly done: Texture;
}

function createFace(ticket: Ticket, fonts: LabelFonts, anisotropy: number): TicketFace {
  const waiting = ticketFaceTexture(ticket, false, fonts, anisotropy);
  const done = ticketFaceTexture(ticket, true, fonts, anisotropy);
  /* unlit and pre-compensated, like the map labels, so the print stays exact */
  const material = new MeshBasicMaterial({ map: waiting, transparent: true, toneMapped: false });
  return { material, waiting, done };
}

/** The faces, once the page fonts have loaded (null until then: never printed in a fallback face). */
export function useTicketFaces(
  tickets: ReadonlyArray<Ticket>,
  fonts: LabelFonts | null,
  anisotropy: number,
): ReadonlyArray<TicketFace> | null {
  const faces = useMemo(
    () => (fonts ? tickets.map((t) => createFace(t, fonts, anisotropy)) : null),
    [tickets, fonts, anisotropy],
  );
  useEffect(
    () => () =>
      faces?.forEach((f) => {
        f.material.dispose();
        f.waiting.dispose();
        f.done.dispose();
      }),
    [faces],
  );
  return faces;
}
