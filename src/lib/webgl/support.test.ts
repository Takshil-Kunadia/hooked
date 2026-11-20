import { describe, expect, it } from "vitest";
import { isWebGLAvailable, stageMode } from "./support";

const canvasReturning = (context: unknown) => () => ({ getContext: () => context });

describe("isWebGLAvailable", () => {
  it("is true when a WebGL2 context can be created", () => {
    expect(isWebGLAvailable(canvasReturning({}))).toBe(true);
  });

  it("is false when no context is available", () => {
    expect(isWebGLAvailable(canvasReturning(null))).toBe(false);
  });

  it("is false when creating the canvas or context throws", () => {
    expect(
      isWebGLAvailable(() => {
        throw new Error("no canvas");
      }),
    ).toBe(false);
  });

  it("is false when there is no DOM (server)", () => {
    expect(isWebGLAvailable()).toBe(false);
  });
});

describe("stageMode", () => {
  it("renders nothing while WebGL support is still unknown (the server and hydration)", () => {
    expect(stageMode(null, false)).toBe("pending");
    expect(stageMode(null, true)).toBe("pending");
  });

  it("renders the 3D stage, and never the copy-only fallback, when WebGL works", () => {
    expect(stageMode(true, false)).toBe("stage");
  });

  it("falls back to the copy only without WebGL or after the context is lost", () => {
    expect(stageMode(false, false)).toBe("copy");
    expect(stageMode(true, true)).toBe("copy");
  });
});
