import { createStore, type StoreApi } from "zustand/vanilla";

/**
 * Where the train is on screen and whether it has arrived. The 3D scene writes it on every rendered
 * frame; the DOM (the train pill, the departure board, E2E hooks) reads it without importing three.
 */
export interface TrainScreen {
  /** CSS pixels from the canvas's top-left corner, just above the lead car's roof. */
  readonly x: number;
  readonly y: number;
  /** False while the train is behind the camera, or before the scene has drawn it. */
  readonly visible: boolean;
  /** When the train reached its current stop (performance.now() / 1000); null while it travels. */
  readonly arrivedAtS: number | null;
  /** True while the 3D train is on the map and has reported its first stop. */
  readonly ready: boolean;
}

export type TrainScreenStore = StoreApi<TrainScreen>;

const INITIAL: TrainScreen = { x: 0, y: 0, visible: false, arrivedAtS: null, ready: false };

export function createTrainScreen(initial: Partial<TrainScreen> = {}): TrainScreenStore {
  return createStore<TrainScreen>()(() => ({ ...INITIAL, ...initial }));
}

/** Updates the screen position, waking subscribers only when it actually moved. */
export function writeTrainPosition(store: TrainScreenStore, x: number, y: number, visible: boolean): void {
  const s = store.getState();
  if (s.x !== x || s.y !== y || s.visible !== visible) store.setState({ x, y, visible });
}

export function writeTrainArrival(store: TrainScreenStore, arrivedAtS: number | null): void {
  if (store.getState().arrivedAtS !== arrivedAtS) store.setState({ arrivedAtS });
}

/** The 3D train mounted (and reported its first stop), or left the map with the stage. */
export function writeTrainReady(store: TrainScreenStore, ready: boolean): void {
  if (store.getState().ready !== ready) store.setState({ ready });
}

/** What the stage wrapper's E2E hooks say: `data-beat` and `data-train`. */
export interface StageData {
  readonly beat: string;
  readonly train: "travelling" | "arrived";
}

/**
 * The stage's E2E hooks, or null (no attributes) until the 3D train is on the map, so a test that
 * waits on them always observes the real train, never a stand-in.
 */
export function stageData(
  story: { readonly actId: string; readonly beat: number },
  train: Pick<TrainScreen, "arrivedAtS" | "ready">,
): StageData | null {
  if (!train.ready) return null;
  return { beat: `${story.actId}/${story.beat}`, train: train.arrivedAtS === null ? "travelling" : "arrived" };
}

/** The app-wide train screen. */
export const trainScreen: TrainScreenStore = createTrainScreen();
