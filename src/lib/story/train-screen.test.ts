import { describe, expect, it, vi } from "vitest";
import { createTrainScreen, writeTrainArrival, writeTrainPosition } from "./train-screen";

describe("train screen", () => {
  it("starts hidden and travelling", () => {
    expect(createTrainScreen().getState()).toEqual({ x: 0, y: 0, visible: false, arrivedAtS: null });
  });

  it("writes the position only when it changes", () => {
    const store = createTrainScreen();
    const listener = vi.fn();
    store.subscribe(listener);

    writeTrainPosition(store, 120, 80, true);
    expect(store.getState()).toMatchObject({ x: 120, y: 80, visible: true });
    expect(listener).toHaveBeenCalledTimes(1);

    writeTrainPosition(store, 120, 80, true);
    expect(listener).toHaveBeenCalledTimes(1);

    writeTrainPosition(store, 120, 80, false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("writes the arrival only when it changes, and keeps the position", () => {
    const store = createTrainScreen({ x: 5, y: 6, visible: true });
    const listener = vi.fn();
    store.subscribe(listener);

    writeTrainArrival(store, 12.5);
    expect(store.getState()).toEqual({ x: 5, y: 6, visible: true, arrivedAtS: 12.5 });
    writeTrainArrival(store, 12.5);
    expect(listener).toHaveBeenCalledTimes(1);

    writeTrainArrival(store, null);
    expect(store.getState().arrivedAtS).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
