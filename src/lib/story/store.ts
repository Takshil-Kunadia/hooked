import { createStore, type StoreApi } from "zustand/vanilla";
import type { LayoutMode } from "./layout";

export interface StoryState {
  actId: string;
  beat: number;
  /** Seconds on the performance.now() / 1000 clock when the current act/beat was entered. */
  enteredAt: number;
  /** True when the latest move went to an earlier beat (scrolling backwards). */
  fromLater: boolean;
  /** Position of the current beat across the whole chapter. */
  globalIndex: number;
  layout: LayoutMode;
  reducedMotion: boolean;
  hovered: string | null;
  pinned: string | null;
}

export interface StoryActions {
  goTo(actId: string, beat: number, globalIndex: number, nowS: number): void;
  setLayout(m: LayoutMode): void;
  setReducedMotion(r: boolean): void;
  hover(name: string | null): void;
  pin(name: string | null): void;
}

export type StoryStore = StoreApi<StoryState & StoryActions>;

const INITIAL_STATE: StoryState = {
  actId: "hero",
  beat: 0,
  enteredAt: 0,
  fromLater: false,
  globalIndex: 0,
  layout: "desktop",
  reducedMotion: false,
  hovered: null,
  pinned: null,
};

export function createStoryStore(initial: Partial<StoryState> = {}): StoryStore {
  return createStore<StoryState & StoryActions>()((set) => ({
    ...INITIAL_STATE,
    ...initial,
    goTo: (actId, beat, globalIndex, nowS) =>
      set((s) => ({
        actId,
        beat,
        globalIndex,
        fromLater: globalIndex < s.globalIndex,
        enteredAt: actId !== s.actId || beat !== s.beat ? nowS : s.enteredAt,
      })),
    setLayout: (layout) => set({ layout }),
    setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    hover: (name) => set((s) => (s.pinned === null ? { hovered: name } : {})),
    pin: (name) => set(name === null ? { pinned: null, hovered: null } : { pinned: name }),
  }));
}

/** The app-wide store; components read it with `useStore`. */
export const storyStore: StoryStore = createStoryStore();
