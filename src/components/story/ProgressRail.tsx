"use client";

import { useStore } from "zustand";
import type { ActShape } from "@/lib/story/pins";
import { beatScrollY } from "@/lib/story/scroll";
import { storyStore } from "@/lib/story/store";
import { measureStory, pinHeight, scrollToY } from "./dom";

interface RailStep {
  readonly label: string;
  readonly actIndex: number;
  readonly beat: number;
}

interface ProgressRailProps {
  readonly acts: ReadonlyArray<ActShape>;
  /** Every beat in chapter order. */
  readonly steps: ReadonlyArray<RailStep>;
}

function goTo(acts: ReadonlyArray<ActShape>, step: RailStep): void {
  const act = measureStory(acts)[step.actIndex];
  if (act) scrollToY(beatScrollY(act, step.beat, pinHeight()), !storyStore.getState().reducedMotion);
}

/** The step rail: one button per beat, scrolling to that beat's resting point. */
export function ProgressRail({ acts, steps }: ProgressRailProps) {
  const current = useStore(storyStore, (s) => s.globalIndex);
  return (
    <nav aria-label="Story steps" className="story-rail">
      <ol>
        {steps.map((step, i) => (
          <li key={`${step.actIndex}/${step.beat}`}>
            <button type="button" aria-current={i === current ? "step" : undefined} onClick={() => goTo(acts, step)}>
              <i />
              <span>{step.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
