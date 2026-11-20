"use client";

import { useEffect } from "react";
import { followBeatArrival } from "@/lib/story/copy-only";
import { storyStore } from "@/lib/story/store";
import { trainScreen } from "@/lib/story/train-screen";

/** Stands in for the 3D stage when it can't run, so the story's boards still play. Renders nothing. */
export function CopyOnly(): null {
  useEffect(() => followBeatArrival(storyStore, trainScreen), []);
  return null;
}
