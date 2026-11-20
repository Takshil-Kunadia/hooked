import { describe, expect, it } from "vitest";
import { followBeatArrival } from "./copy-only";
import { createStoryStore } from "./store";
import { createTrainScreen } from "./train-screen";

describe("followBeatArrival", () => {
  it("marks the train arrived when it starts, at the current beat's entry time", () => {
    const story = createStoryStore({ enteredAt: 4 });
    const train = createTrainScreen();
    followBeatArrival(story, train);
    expect(train.getState().arrivedAtS).toBe(4);
  });

  it("re-marks the train arrived on every beat change", () => {
    const story = createStoryStore();
    const train = createTrainScreen();
    followBeatArrival(story, train);
    story.getState().goTo("boot", 1, 6, 9.5);
    expect(train.getState().arrivedAtS).toBe(9.5);
  });

  it("stops following when unsubscribed", () => {
    const story = createStoryStore();
    const train = createTrainScreen();
    const stop = followBeatArrival(story, train);
    stop();
    story.getState().goTo("boot", 1, 6, 12);
    expect(train.getState().arrivedAtS).toBe(0);
  });
});
