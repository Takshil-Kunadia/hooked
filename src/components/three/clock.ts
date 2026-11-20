/** The story clock: seconds on performance.now() / 1000, the clock `storyStore.goTo` is given too. */
export const storyNowS = (): number => performance.now() / 1000;
