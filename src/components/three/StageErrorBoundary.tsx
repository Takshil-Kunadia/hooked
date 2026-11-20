"use client";

import { Component, type ReactNode } from "react";

interface StageErrorBoundaryProps {
  readonly children: ReactNode;
  /** What to render after a failure; nothing by default. */
  readonly fallback?: ReactNode;
}

interface StageErrorBoundaryState {
  readonly failed: boolean;
}

/**
 * If the 3D stage throws (lost context, blocklisted GPU, driver bug), render nothing.
 * The copy is plain HTML and must keep working without the scene.
 */
export class StageErrorBoundary extends Component<StageErrorBoundaryProps, StageErrorBoundaryState> {
  override state: StageErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): StageErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      // Surface the cause during development; in production the page silently falls back to text.
      console.warn("[hooked] 3D stage disabled after an error:", error);
    }
  }

  override render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
