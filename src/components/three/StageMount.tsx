"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { isWebGLAvailable } from "@/lib/webgl/support";
import { StageErrorBoundary } from "./StageErrorBoundary";

/** The 3D stage only ever renders in the browser, after the text has painted. */
const MetroStage = dynamic(() => import("./MetroStage"), { ssr: false, loading: () => null });

let webglSupport: boolean | undefined;
const getWebGLSupport = (): boolean => (webglSupport ??= isWebGLAvailable());
const subscribe = (): (() => void) => () => {};

export function StageMount() {
  const canRender3D = useSyncExternalStore(subscribe, getWebGLSupport, () => false);
  if (!canRender3D) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-lvh">
      <StageErrorBoundary>
        <MetroStage />
      </StageErrorBoundary>
    </div>
  );
}
