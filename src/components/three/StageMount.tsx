"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { ChapterSpec } from "@/lib/story/chapter";
import type { Ticket } from "@/lib/story/facts";
import { storyStore } from "@/lib/story/store";
import { trainScreen } from "@/lib/story/train-screen";
import { isWebGLAvailable } from "@/lib/webgl/support";
import { CopyOnly } from "./CopyOnly";
import { StageErrorBoundary } from "./StageErrorBoundary";
import { useStoryViewport } from "./useStoryViewport";

/** The 3D stage only ever renders in the browser, after the text has painted. */
const MetroStage = dynamic(() => import("./MetroStage"), { ssr: false, loading: () => null });

let webglSupport: boolean | undefined;
const getWebGLSupport = (): boolean => (webglSupport ??= isWebGLAvailable());
const subscribe = (): (() => void) => () => {};

function setData(el: HTMLElement, key: "beat" | "train", value: string): void {
  if (el.dataset[key] !== value) el.dataset[key] = value;
}

/**
 * E2E hooks on the stage: `data-beat="<act>/<beat>"` and `data-train="travelling" | "arrived"`.
 * Written straight to the DOM from the stores, so the per-frame train updates never re-render React.
 */
function bindStageData(el: HTMLDivElement): () => void {
  const writeBeat = (): void => {
    const { actId, beat } = storyStore.getState();
    setData(el, "beat", `${actId}/${beat}`);
  };
  const writeTrain = (): void => {
    setData(el, "train", trainScreen.getState().arrivedAtS === null ? "travelling" : "arrived");
  };
  writeBeat();
  writeTrain();
  const unsubscribeStory = storyStore.subscribe(writeBeat);
  const unsubscribeTrain = trainScreen.subscribe(writeTrain);
  return () => {
    unsubscribeStory();
    unsubscribeTrain();
  };
}

interface StageMountProps {
  /** The story's chapter; without one the stage shows the hero overview. */
  readonly chapter?: ChapterSpec;
  /** `StoryData.tickets.shown`: the init platform's passes. None without a chapter. */
  readonly tickets?: ReadonlyArray<Ticket>;
}

/**
 * The fixed 3D backdrop. The wrapper ignores the pointer, but the canvas inside it takes pointer
 * events wherever nothing is laid over it (see `usePicking`).
 */
export function StageMount({ chapter, tickets }: StageMountProps) {
  /* the copy reads the layout mode too, so keep it current even without WebGL */
  useStoryViewport();
  const canRender3D = useSyncExternalStore(subscribe, getWebGLSupport, () => false);
  const [lost, setLost] = useState(false);
  /* `webglcontextlost` doesn't bubble, so listen in the capture phase for the canvas inside */
  const bind = useCallback((el: HTMLDivElement) => {
    const unbindData = bindStageData(el);
    const onLost = (): void => setLost(true);
    el.addEventListener("webglcontextlost", onLost, true);
    return () => {
      unbindData();
      el.removeEventListener("webglcontextlost", onLost, true);
    };
  }, []);
  if (!canRender3D || lost) return <CopyOnly />;
  return (
    <div ref={bind} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-lvh">
      <StageErrorBoundary fallback={<CopyOnly />}>
        <MetroStage chapter={chapter} tickets={tickets} />
      </StageErrorBoundary>
    </div>
  );
}
