import type { ReactNode } from "react";
import type { ActSpec } from "@/lib/story/chapter";
import { actHeightVh } from "@/lib/story/scroll";

interface ActProps {
  readonly act: ActSpec;
  /** Beat copy by beat id. */
  readonly copy: Readonly<Record<string, ReactNode>>;
  /** After the beats: the act's "Under the hood" list, if it has one. */
  readonly footer?: ReactNode;
  /** Shown with the copy: the act's departure board, if it has one. */
  readonly children?: ReactNode;
}

/**
 * One act: a section tall enough for its beats, with a 100svh pin that stays put while they play.
 * The copy, its scrim and the board are server-rendered; StoryController fades them (`--vis`,
 * `data-off`) and moves `data-active` to the current beat.
 */
export function Act({ act, copy, footer, children }: ActProps) {
  const titleId = `${act.id}-title`;
  return (
    <section
      id={act.id}
      aria-labelledby={titleId}
      className="story-act"
      style={{ height: `calc(${actHeightVh(act.beats.length)} * 1svh)` }}
    >
      <div data-pin="" className="story-pin">
        <div aria-hidden="true" className="story-scrim" />
        <div data-copy="" data-card-avoid="" className="story-copy">
          <div className="story-copy-body">
            <p className="story-kicker">{act.kicker}</p>
            <h2 id={titleId}>{act.title}</h2>
            <ol data-beats="" className="story-beats">
              {act.beats.map((beat, k) => (
                <li key={beat.id} data-n={k + 1} data-active={k === 0 ? "" : undefined}>
                  <div className="story-beat-text">{Object.hasOwn(copy, beat.id) ? copy[beat.id] : null}</div>
                </li>
              ))}
            </ol>
            {footer}
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
