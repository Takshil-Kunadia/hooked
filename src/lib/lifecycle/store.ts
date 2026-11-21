import { createStore, type StoreApi } from "zustand/vanilla";
import type { MapPose } from "./view";

interface LifecycleState {
  /** Stop indexes. */
  hovered: number | null;
  selected: number | null;
  riding: boolean;
  /** Where the train is, in stops: 2.5 is halfway between the third and fourth stop. */
  ride: number;
  /** The camera follows the train until the visitor moves the map. */
  follow: boolean;
  /** A pose the camera is asked to fly to; `seq` makes a repeated request a new one. */
  flight: (MapPose & { readonly seq: number }) | null;
}

interface LifecycleActions {
  hover(i: number | null): void;
  select(i: number | null): void;
  /** Starts the ride (from the beginning once it has finished) or pauses it. */
  toggleRide(stops: number): void;
  /** Moves the train; the ride stops at the last stop. */
  advance(by: number, stops: number): void;
  flyTo(pose: MapPose): void;
  land(): void;
  stopFollowing(): void;
}

export type LifecycleStore = StoreApi<LifecycleState & LifecycleActions>;

export function createLifecycleStore(): LifecycleStore {
  let seq = 0;
  return createStore<LifecycleState & LifecycleActions>()((set, get) => ({
    hovered: null,
    selected: null,
    riding: false,
    ride: 0,
    follow: false,
    flight: null,
    hover: (i) => set({ hovered: i }),
    select: (i) => set({ selected: i }),
    toggleRide: (stops) => {
      const { riding, ride } = get();
      if (riding) set({ riding: false });
      else set({ riding: true, follow: true, flight: null, ride: ride >= stops - 1 ? 0 : ride });
    },
    advance: (by, stops) => {
      const next = Math.min(stops - 1, get().ride + by);
      set(next >= stops - 1 ? { ride: next, riding: false } : { ride: next });
    },
    flyTo: (pose) => {
      seq += 1;
      set({ flight: { ...pose, seq }, follow: false });
    },
    land: () => set({ flight: null }),
    stopFollowing: () => set({ follow: false, flight: null }),
  }));
}

/** The page's one map. */
export const lifecycleStore = createLifecycleStore();
