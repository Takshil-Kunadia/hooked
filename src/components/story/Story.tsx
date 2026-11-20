import { Fragment } from "react";
import { StageMount } from "@/components/three/StageMount";
import { renderBeatCopy, type BeatCopy } from "@/lib/story/beat-copy";
import { storyCards } from "@/lib/story/cards";
import { flattenBeats, type ChapterSpec, type FlatBeat } from "@/lib/story/chapter";
import { cueIndices } from "@/lib/story/cues";
import { loadExplainers } from "@/lib/story/explainers";
import type { StoryData } from "@/lib/story/facts";
import { hoodRows } from "@/lib/story/hood";
import { pillText } from "@/lib/story/pill";
import { BREATHER_VH } from "@/lib/story/scroll";
import { Act } from "./Act";
import { LazyDepartureBoard, LazyHookCard } from "./LazyIslands";
import { ProgressRail } from "./ProgressRail";
import { StoryController } from "./StoryController";
import { TrainPill } from "./TrainPill";
import { UnderTheHood } from "./UnderTheHood";

/** `StoryData.tickets` are the listeners on `init` (see data.ts). */
const TICKET_HOOK = "init";

interface StoryProps {
  readonly spec: ChapterSpec;
  /** Each beat's copy, by beat id: a bold lead-in, then the body. Copy that quotes a fact gets the data. */
  readonly copy: Readonly<Record<string, BeatCopy>>;
  readonly data: StoryData;
  /** The raw explainers file (content/explainers.json), validated here on the server. */
  readonly explainers: unknown;
}

/** The scroll gap after each act, where the scene plays on its own and the copy is hidden. */
function Breather() {
  return <div aria-hidden="true" style={{ height: `${BREATHER_VH}svh` }} />;
}

const boardBeats = (flat: ReadonlyArray<FlatBeat>, actId: string) =>
  flat.flatMap((b) => (b.actId === actId && b.spec.board ? [{ index: b.globalIndex, kind: b.spec.board }] : []));

/**
 * The scroll story: the 3D stage, one pinned section per act with its numbered beats, and the small
 * client islands that drive it (controller, rail, boards, pill, hover card; the last two load lazily).
 *
 * The chapter's first act is the page's hero: the page renders it as `<section id={spec.acts[0].id}>`
 * around the LCP `<h1>`, right before `<Story>`, so the hero paints first and stays server-rendered.
 * Story renders every act after it, and the controller measures all of them by id. Each act whose
 * beats name hooks ends with an "Under the hood" list built from the data.
 */
export function Story({ spec, copy, data, explainers }: StoryProps) {
  const flat = flattenBeats(spec);
  const cues = cueIndices(flat);
  const shape = spec.acts.map((act) => ({ id: act.id, beats: act.beats.length }));
  const steps = flat.map((b) => ({ label: b.spec.rail, actIndex: b.actIndex, beat: b.beat }));
  const pills = flat.map((b) => (b.spec.pill ? pillText(b.spec.pill, data) : null));
  const cards = storyCards(loadExplainers(explainers), data.tickets.shown, TICKET_HOOK);
  const beatCopy = Object.fromEntries(Object.entries(copy).map(([id, c]) => [id, renderBeatCopy(c, data)]));

  return (
    <>
      <StageMount chapter={spec} tickets={data.tickets.shown} />
      <Breather />
      {spec.acts.slice(1).map((act) => {
        const boards = boardBeats(flat, act.id);
        return (
          <Fragment key={act.id}>
            <Act act={act} copy={beatCopy} footer={<UnderTheHood rows={hoodRows(act, data.sources)} wp={data.wp} />}>
              {boards.length > 0 && (
                <LazyDepartureBoard
                  beats={boards}
                  cues={cues}
                  tickets={data.tickets.shown}
                  hidden={data.tickets.hidden}
                  announcements={data.bootAnnouncements}
                />
              )}
            </Act>
            <Breather />
          </Fragment>
        );
      })}
      <ProgressRail acts={shape} steps={steps} />
      <TrainPill texts={pills} />
      <LazyHookCard cards={cards} wp={data.wp} />
      <StoryController acts={shape} />
    </>
  );
}
