import type { StoryStore } from "./store";
import { writeTrainArrival, type TrainScreenStore } from "./train-screen";

/**
 * Copy-only mode (no WebGL, or the context was lost): nothing draws a train, so nothing would ever
 * write its arrival and the departure board would wait for it forever. Treat the train as arriving
 * the moment each beat is entered. Returns the unsubscribe function.
 */
export function followBeatArrival(story: StoryStore, train: TrainScreenStore): () => void {
  const sync = (): void => writeTrainArrival(train, story.getState().enteredAt);
  sync();
  return story.subscribe(sync);
}
