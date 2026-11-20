/** The departure board's wording, from the same phases the 3D platform shows (see cues.ts). */
import type { InitPhases } from "./cues";
import type { TicketPhase } from "./motion";

/** The board's headline status: where the train is, then how far the listeners have got. */
export function initBoardStatus(phases: InitPhases, travelling: boolean): string {
  if (travelling) return "train approaching";
  if (!phases.announced) return "train at platform";
  const done = phases.tickets.filter((p) => p === "done").length;
  if (done === phases.tickets.length) return "all listeners done";
  return done === 0 ? "announcing…" : `boarding ${done}/${phases.tickets.length}`;
}

const TICKET_STATUS: Readonly<Record<TicketPhase, string>> = { waiting: "waiting", running: "▶ now", done: "✓ done" };

/** A ticket row's status, in words (and a symbol), never colour alone. */
export function ticketStatus(phase: TicketPhase): string {
  return TICKET_STATUS[phase];
}
