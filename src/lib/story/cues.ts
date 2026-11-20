/**
 * When the init platform's announcement rings and when its tickets take their turns, as a pure
 * function of where the story is. The 3D scene and the departure board both read it, so they can
 * never disagree. Times are seconds on the performance.now() / 1000 clock.
 *
 * The `stage*` functions take plain values and allocate nothing, for the render loop; `initPhases`
 * and `initSettled` wrap them for the DOM.
 */
import type { FlatBeat } from "./chapter";
import { announced, ticketPhase, type TicketPhase } from "./motion";

/** Global indices of the chapter's announcement beat and cascade beat; null when it has none. */
export interface CueIndices {
  readonly announce: number | null;
  readonly cascade: number | null;
}

/**
 * Where the current beat sits relative to the cues: before the announcement, at it, between the
 * two cues, at the cascade, or past it.
 */
export type InitStage = "before" | "announce" | "between" | "cascade" | "after";

/** Everything the platform's state depends on at one moment. */
export interface InitMoment {
  readonly cues: CueIndices;
  readonly globalIndex: number;
  /** `sinceArrival(...)`: null while the train is travelling. */
  readonly sinceArrivalS: number | null;
  readonly fromLater: boolean;
}

export interface InitPhases {
  readonly announced: boolean;
  readonly tickets: TicketPhase[];
}

export function cueIndices(flat: ReadonlyArray<FlatBeat>): CueIndices {
  const indexOf = (cue: "announce" | "cascade"): number | null =>
    flat.find((b) => b.spec.cue === cue)?.globalIndex ?? null;
  return { announce: indexOf("announce"), cascade: indexOf("cascade") };
}

/**
 * Seconds since the current beat's events could start: the later of the train reaching its stop
 * and the beat being entered. Null while the train is travelling.
 */
export function sinceArrival(arrivedAtS: number | null, enteredAt: number, nowS: number): number | null {
  return arrivedAtS === null ? null : nowS - Math.max(arrivedAtS, enteredAt);
}

export function initStage(cues: CueIndices, globalIndex: number): InitStage {
  const { announce, cascade } = cues;
  if (cascade !== null && globalIndex > cascade) return "after";
  if (globalIndex === cascade) return "cascade";
  if (globalIndex === announce) return "announce";
  if (announce !== null && globalIndex > announce) return "between";
  return "before";
}

/** Whether the announcement has been made. From the cascade beat on, it always has. */
export function stageAnnounced(stage: InitStage, sinceArrivalS: number | null, fromLater: boolean): boolean {
  if (stage === "before") return false;
  if (stage === "announce") return announced(sinceArrivalS, fromLater);
  return true;
}

/** Ticket `index`'s phase: it only moves at the cascade beat, and is done past it. */
export function stageTicketPhase(
  stage: InitStage,
  index: number,
  sinceArrivalS: number | null,
  fromLater: boolean,
): TicketPhase {
  if (stage === "after") return "done";
  if (stage === "cascade") return ticketPhase(index, sinceArrivalS, fromLater);
  return "waiting";
}

const ticketCount = (count: number): number => (Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0);

/**
 * True when nothing will change with time alone: only a new beat or the train's arrival moves the
 * platform on from here. Use it to stop timers and frame requests.
 */
export function stageSettled(
  stage: InitStage,
  sinceArrivalS: number | null,
  fromLater: boolean,
  count: number,
): boolean {
  if (sinceArrivalS === null) return true;
  if (stage === "announce") return stageAnnounced(stage, sinceArrivalS, fromLater);
  if (stage === "cascade") {
    const last = ticketCount(count) - 1;
    return last < 0 || stageTicketPhase(stage, last, sinceArrivalS, fromLater) === "done";
  }
  return true;
}

/** The announcement and every ticket's phase at this moment. */
export function initPhases(moment: InitMoment, count: number): InitPhases {
  const { cues, globalIndex, sinceArrivalS, fromLater } = moment;
  const stage = initStage(cues, globalIndex);
  return {
    announced: stageAnnounced(stage, sinceArrivalS, fromLater),
    tickets: Array.from({ length: ticketCount(count) }, (_, i) => stageTicketPhase(stage, i, sinceArrivalS, fromLater)),
  };
}

/** `stageSettled` at this moment: false while a cascade (or the announcement) is still playing. */
export function initSettled(moment: InitMoment, count: number): boolean {
  const { cues, globalIndex, sinceArrivalS, fromLater } = moment;
  return stageSettled(initStage(cues, globalIndex), sinceArrivalS, fromLater, count);
}
