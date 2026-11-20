import { Color, type Group, type Mesh, type MeshBasicMaterial } from "three";
import {
  initStage,
  sinceArrival,
  stageSettled,
  stageTicketPhase,
  type CueIndices,
  type InitStage,
} from "@/lib/story/cues";
import { ANNOUNCE_DELAY_S, type TicketPhase } from "@/lib/story/motion";
import { storyStore } from "@/lib/story/store";
import { trainScreen } from "@/lib/story/train-screen";
import { storyNowS } from "../clock";
import { TICKET_DARK, type TicketCard, type TicketFace } from "./platformParts";

/*
 * Round 5's pass motion. While it is a pass's turn its card pulses; when the turn is done the pass
 * lifts, twists and settles a little raised, easing into its origin colour with a ✓ on its face.
 */
/** Each second the colour closes all but 0.05% of the gap (round 5's `1 - 0.0005^dt`). */
const LIT_REMAINING_PER_S = 0.0005;
const HOP_PER_S = 2.2;
const LIT_LIFT = 0.1;
const HOP_LIFT = 0.22;
const FLIP_YAW = Math.PI * 0.18;
const PULSE = { glow: 0.35, swing: 0.25, radPerS: 7 } as const;
/** Two-way hover linking: the named pass grows, lifts and glows (round 5 grew it by 10%). */
const HIGHLIGHT = { glow: 0.3, scale: 1.1, lift: 0.12 } as const;
/** Round 5's announcement ripples: three rings, 0.22s apart, each spreading for 1.6s. */
const RIPPLE = { staggerS: 0.22, lifeS: 1.6, grow: 4.2, opacity: 0.7 } as const;
/** Round 5's cap on one frame's step, for slow frames. */
const MAX_STEP_S = 0.05;
/** The first step after a rest follows an idle gap of any length, so it is one 60 Hz frame long. */
const FIRST_STEP_S = 1 / 60;
const SETTLED = 1e-3;

const DARK = new Color(TICKET_DARK);

export interface TicketAnim {
  /** Whether the pass shows as done; null before its first frame (which never animates). */
  done: boolean | null;
  lit: number;
  hop: number;
}

export const createTicketAnim = (): TicketAnim => ({ done: null, lit: 0, hop: 0 });

interface TicketView {
  readonly name: string;
  readonly group: Group;
  readonly card: TicketCard;
  readonly face: TicketFace | null;
  readonly anim: TicketAnim;
  /** Resting height (the slab's top) and size of the pass. */
  readonly restY: number;
  readonly scale: number;
}

interface FrameState {
  nowS: number;
  dtS: number;
  animate: boolean;
  highlighted: string | null;
  /** Whether the last step left anything moving. */
  busy: boolean;
}

export interface PlatformView {
  readonly tickets: ReadonlyArray<TicketView>;
  readonly rings: ReadonlyArray<Mesh>;
  readonly ringMaterials: ReadonlyArray<MeshBasicMaterial>;
  /** Reused every frame, so stepping the platform allocates nothing. */
  readonly frame: FrameState;
}

export const createFrameState = (): FrameState => ({
  nowS: 0,
  dtS: 0,
  animate: true,
  highlighted: null,
  busy: false,
});

/** Returns true while the pass is still moving. */
function stepTicket(t: TicketView, phase: TicketPhase, f: FrameState): boolean {
  const a = t.anim;
  const done = phase === "done";
  if (a.done !== done) {
    /* no flip on first paint (a reload shows the passes as they are) or under reduced motion */
    a.hop = done && a.done !== null && f.animate ? 1 : 0;
    if (a.done === null) a.lit = done ? 1 : 0;
    a.done = done;
  }
  const goal = done ? 1 : 0;
  a.lit = f.animate ? goal + (a.lit - goal) * Math.pow(LIT_REMAINING_PER_S, f.dtS) : goal;
  if (Math.abs(a.lit - goal) < SETTLED) a.lit = goal;
  a.hop = f.animate ? Math.max(0, a.hop - f.dtS * HOP_PER_S) : 0;
  const flip = a.hop > 0 ? Math.sin((1 - a.hop) * Math.PI) : 0;
  const highlighted = f.highlighted === t.name;
  const running = phase === "running";

  if (t.face) {
    const print = done ? t.face.done : t.face.waiting;
    if (t.face.material.map !== print) t.face.material.map = print;
  }
  t.card.material.color.copy(DARK).lerp(t.card.origin, a.lit);
  const pulse = running ? PULSE.glow + (f.animate ? PULSE.swing * Math.sin(f.nowS * PULSE.radPerS) : 0) : 0;
  t.card.material.emissiveIntensity = pulse + (highlighted ? HIGHLIGHT.glow : 0);
  t.group.position.y = t.restY + (a.lit * LIT_LIFT + flip * HOP_LIFT + (highlighted ? HIGHLIGHT.lift : 0)) * t.scale;
  t.group.rotation.y = flip * FLIP_YAW;
  t.group.scale.setScalar(t.scale * (highlighted ? HIGHLIGHT.scale : 1));
  return a.lit !== goal || a.hop > 0 || (running && f.animate);
}

/** The ripples play once when the announcement is made; returns true until the last one fades. */
function stepRings(view: PlatformView, stage: InitStage, since: number | null, fromLater: boolean): boolean {
  const playing = stage === "announce" && !fromLater && since !== null && view.frame.animate;
  const t = playing ? since - ANNOUNCE_DELAY_S : -1;
  let active = false;
  for (let i = 0; i < view.rings.length; i += 1) {
    const ring = view.rings[i];
    const material = view.ringMaterials[i];
    if (!ring || !material) continue;
    const life = (t - i * RIPPLE.staggerS) / RIPPLE.lifeS;
    const on = t >= 0 && life > 0 && life < 1;
    ring.visible = on;
    if (on) {
      ring.scale.setScalar(1 + life * RIPPLE.grow);
      material.opacity = (1 - life) * RIPPLE.opacity;
    }
    if (t >= 0 && life < 1) active = true;
  }
  return active;
}

/**
 * Brings the platform up to date with the story (via the shared cue logic) and returns true while
 * anything is still moving or about to change: the caller keeps requesting frames until then.
 */
export function stepPlatform(view: PlatformView, cues: CueIndices, deltaS: number): boolean {
  const s = storyStore.getState();
  const f = view.frame;
  f.nowS = storyNowS();
  f.dtS = Math.min(Math.max(deltaS, 0), f.busy ? MAX_STEP_S : FIRST_STEP_S);
  f.animate = !s.reducedMotion;
  f.highlighted = s.pinned ?? s.hovered;
  const stage = initStage(cues, s.globalIndex);
  const since = sinceArrival(trainScreen.getState().arrivedAtS, s.enteredAt, f.nowS);
  let busy = !stageSettled(stage, since, s.fromLater, view.tickets.length);
  for (let i = 0; i < view.tickets.length; i += 1) {
    const ticket = view.tickets[i];
    if (ticket && stepTicket(ticket, stageTicketPhase(stage, i, since, s.fromLater), f)) busy = true;
  }
  if (stepRings(view, stage, since, s.fromLater)) busy = true;
  f.busy = busy;
  return busy;
}
