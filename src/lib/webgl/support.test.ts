import { describe, expect, it } from "vitest";
import { isWebGLAvailable } from "./support";

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
