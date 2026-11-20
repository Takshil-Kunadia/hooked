"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { ChapterSpec } from "@/lib/story/chapter";
import type { Ticket } from "@/lib/story/facts";
import { storyStore } from "@/lib/story/store";
import { stageData, trainScreen } from "@/lib/story/train-screen";
import { isWebGLAvailable, stageMode } from "@/lib/webgl/support";
import { CopyOnly } from "./CopyOnly";
import { StageErrorBoundary } from "./StageErrorBoundary";
import { useStoryViewport } from "./useStoryViewport";

/** The 3D stage only ever renders in the browser, after the text has painted. */
const MetroStage = dynamic(() => import("./MetroStage"), { ssr: false, loading: () => null });

let webglSupport: boolean | undefined;
const getWebGLSupport = (): boolean => (webglSupport ??= isWebGLAvailable());
/* the server, and hydration, can't know: render nothing until the browser has been asked */
const getServerSupport = (): null => null;
const subscribe = (): (() => void) => () => {};

function setData(el: HTMLElement, name: "data-beat" | "data-train", value: string | undefined): void {
  if (value === undefined) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/**
 * E2E hooks on the stage: `data-beat="<act>/<beat>"` and `data-train="travelling" | "arrived"`,
 * present only once the 3D train is on the map (`stageData`). Written straight to the DOM from the
 * stores, so the per-frame train updates never re-render React.
 */
function bindStageData(el: HTMLDivElement): () => void {
  const write = (): void => {
    const data = stageData(storyStore.getState(), trainScreen.getState());
    setData(el, "data-beat", data?.beat);
    setData(el, "data-train", data?.train);
  };
  write();
  const unsubscribeStory = storyStore.subscribe(write);
  const unsubscribeTrain = trainScreen.subscribe(write);
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
 * events wherever nothing is laid over it (see `usePicking`). Nothing renders until the browser
 * says whether WebGL works, so the copy-only fallback never runs on a page that has the train.
 */
export function StageMount({ chapter, tickets }: StageMountProps) {
  /* the copy reads the layout mode too, so keep it current even without WebGL */
  useStoryViewport();
  const support = useSyncExternalStore<boolean | null>(subscribe, getWebGLSupport, getServerSupport);
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
  const mode = stageMode(support, lost);
  if (mode === "pending") return null;
  if (mode === "copy") return <CopyOnly />;
  return (
    <div ref={bind} data-stage="" aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-lvh">
      <StageErrorBoundary fallback={<CopyOnly />}>
        <MetroStage chapter={chapter} tickets={tickets} />
      </StageErrorBoundary>
    </div>
  );
}
