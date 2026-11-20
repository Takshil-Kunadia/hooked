import { describe, expect, it, vi } from "vitest";
import { createTrainScreen, stageData, writeTrainArrival, writeTrainPosition, writeTrainReady } from "./train-screen";

describe("train screen", () => {
  it("starts hidden, travelling and not yet on the map", () => {
    expect(createTrainScreen().getState()).toEqual({ x: 0, y: 0, visible: false, arrivedAtS: null, ready: false });
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
    expect(store.getState()).toEqual({ x: 5, y: 6, visible: true, arrivedAtS: 12.5, ready: false });
    writeTrainArrival(store, 12.5);
    expect(listener).toHaveBeenCalledTimes(1);

    writeTrainArrival(store, null);
    expect(store.getState().arrivedAtS).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("marks the 3D train on and off the map, waking subscribers only on a change", () => {
    const store = createTrainScreen({ arrivedAtS: 4 });
    const listener = vi.fn();
    store.subscribe(listener);

    writeTrainReady(store, true);
    expect(store.getState()).toMatchObject({ ready: true, arrivedAtS: 4 });
    writeTrainReady(store, true);
    expect(listener).toHaveBeenCalledTimes(1);

    writeTrainReady(store, false);
    expect(store.getState().ready).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("stageData", () => {
  const story = { actId: "boot", beat: 1 };

  it("reports nothing until the 3D train is on the map, whatever the arrival says", () => {
    expect(stageData(story, { arrivedAtS: null, ready: false })).toBeNull();
    expect(stageData(story, { arrivedAtS: 3, ready: false })).toBeNull();
  });

  it("then reports the beat and whether the train is travelling or has arrived", () => {
    expect(stageData(story, { arrivedAtS: 3, ready: true })).toEqual({ beat: "boot/1", train: "arrived" });
    expect(stageData(story, { arrivedAtS: null, ready: true })).toEqual({ beat: "boot/1", train: "travelling" });
  });
});
