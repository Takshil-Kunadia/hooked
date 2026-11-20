"use client";

import { useEffect, useId, useState } from "react";
import { useStore } from "zustand";
import { initBoardStatus, ticketStatus } from "@/lib/story/board";
import type { BeatSpec } from "@/lib/story/chapter";
import { initPhases, initSettled, sinceArrival, type CueIndices } from "@/lib/story/cues";
import type { Ticket } from "@/lib/story/facts";
import { storyStore } from "@/lib/story/store";
import { trainScreen } from "@/lib/story/train-screen";

type BoardKind = NonNullable<BeatSpec["board"]>;

/** How often the board re-reads the clock while the announcement or the cascade plays. */
const TICK_MS = 100;

interface InitBoardProps {
  readonly cues: CueIndices;
  readonly tickets: ReadonlyArray<Ticket>;
  /** Core listeners on the hook that the board leaves out (counted in the column heading). */
  readonly hidden: number;
}

/**
 * The init platform's board: the announcement and every ticket's turn, from the same cue function
 * as the 3D platform (cues.ts), so the two never disagree. Ticks only while something is playing.
 */
function InitBoard({ cues, tickets, hidden }: InitBoardProps) {
  const titleId = useId();
  const globalIndex = useStore(storyStore, (s) => s.globalIndex);
  const enteredAt = useStore(storyStore, (s) => s.enteredAt);
  const fromLater = useStore(storyStore, (s) => s.fromLater);
  const arrivedAtS = useStore(trainScreen, (s) => s.arrivedAtS);
  const [nowS, setNowS] = useState(0);
  const moment = { cues, globalIndex, sinceArrivalS: sinceArrival(arrivedAtS, enteredAt, nowS), fromLater };
  const settled = initSettled(moment, tickets.length);

  useEffect(() => {
    const tick = (): void => setNowS(performance.now() / 1000);
    const first = requestAnimationFrame(tick);
    const timer = settled ? 0 : window.setInterval(tick, TICK_MS);
    return () => {
      cancelAnimationFrame(first);
      window.clearInterval(timer);
    };
  }, [settled, enteredAt, arrivedAtS]);

  const phases = initPhases(moment, tickets.length);
  return (
    <div className="board" role="group" aria-labelledby={titleId} data-card-avoid="">
      <p className="board-title">
        <span id={titleId}>Platform · init</span>
        <span>{initBoardStatus(phases, arrivedAtS === null)}</span>
      </p>
      {phases.announced && (
        <p className="board-announce">
          Now announcing · <code>do_action( &apos;init&apos; )</code>
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Ticket</th>
            <th>{hidden > 0 ? `Listener · ${tickets.length} of ${tickets.length + hidden}` : "Listener"}</th>
            <th>From</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t, i) => {
            const phase = phases.tickets[i] ?? "waiting";
            return (
              <tr key={`${t.callback}/${i}`} data-card={t.callback} data-phase={phase} tabIndex={0}>
                <td className="tk">{t.priority}</td>
                <td className="nm">{t.callback}</td>
                <td className={`fr o-${t.origin}`}>
                  {t.origin}
                  {t.demo ? "*" : ""}
                </td>
                <td className="st">{ticketStatus(phase)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** A selection of the announcements wp-settings.php makes while booting, in the order they fire. */
function AnnouncementBoard({ names, total }: { readonly names: ReadonlyArray<string>; readonly total: number }) {
  const titleId = useId();
  return (
    <div className="board" role="group" aria-labelledby={titleId} data-card-avoid="">
      <p className="board-title">
        <span id={titleId}>Station announcements</span>
        <span>
          {names.length} of {total}
        </span>
      </p>
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Announcement</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {names.map((name, i) => (
            <tr key={name} data-card={name} data-phase="done" tabIndex={0}>
              <td className="tk">{i + 1}</td>
              <td className="nm">{name}</td>
              <td className="st">{ticketStatus("done")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DepartureBoardProps {
  /** This act's beats that show a board, by global index. */
  readonly beats: ReadonlyArray<{ readonly index: number; readonly kind: BoardKind }>;
  readonly cues: CueIndices;
  readonly tickets: ReadonlyArray<Ticket>;
  readonly hidden: number;
  readonly announcements: ReadonlyArray<string>;
  /** Every action fired during boot, of which `announcements` are a selection. */
  readonly announcementsTotal: number;
}

/**
 * The act's departure board, shown at the beats that ask for one. It lives inside the act's copy, so
 * it fades with it: bottom-right of the pin on wider layouts, inside the frosted sheet when stacked.
 */
export function DepartureBoard({
  beats,
  cues,
  tickets,
  hidden,
  announcements,
  announcementsTotal,
}: DepartureBoardProps) {
  const kind = useStore(storyStore, (s) => beats.find((b) => b.index === s.globalIndex)?.kind);
  if (kind === "announcements") return <AnnouncementBoard names={announcements} total={announcementsTotal} />;
  if (kind === "init") return <InitBoard cues={cues} tickets={tickets} hidden={hidden} />;
  return null;
}
