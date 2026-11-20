"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { ChapterSpec } from "@/lib/story/chapter";
import { isWebGLAvailable } from "@/lib/webgl/support";
import { StageErrorBoundary } from "./StageErrorBoundary";
import { useStoryViewport } from "./useStoryViewport";

/** The 3D stage only ever renders in the browser, after the text has painted. */
const MetroStage = dynamic(() => import("./MetroStage"), { ssr: false, loading: () => null });

let webglSupport: boolean | undefined;
const getWebGLSupport = (): boolean => (webglSupport ??= isWebGLAvailable());
const subscribe = (): (() => void) => () => {};

interface StageMountProps {
  /** The story's chapter; without one the stage shows the hero overview. */
  readonly chapter?: ChapterSpec;
}

export function StageMount({ chapter }: StageMountProps) {
  /* the copy reads the layout mode too, so keep it current even without WebGL */
  useStoryViewport();
  const canRender3D = useSyncExternalStore(subscribe, getWebGLSupport, () => false);
  if (!canRender3D) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-lvh">
      <StageErrorBoundary>
        <MetroStage chapter={chapter} />
      </StageErrorBoundary>
    </div>
  );
}
