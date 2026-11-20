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
}

export type TrainScreenStore = StoreApi<TrainScreen>;

const INITIAL: TrainScreen = { x: 0, y: 0, visible: false, arrivedAtS: null };

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

/** The app-wide train screen. */
export const trainScreen: TrainScreenStore = createTrainScreen();
