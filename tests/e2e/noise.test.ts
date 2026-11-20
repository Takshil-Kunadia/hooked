import { describe, expect, it } from "vitest";
import { isDriverNoise } from "./helpers";

describe("isDriverNoise", () => {
  it("drops SwiftShader driver chatter", () => {
    expect(isDriverNoise("[.WebGL-0x1]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): x")).toBe(true);
    expect(isDriverNoise("GPU stall due to ReadPixels")).toBe(true);
  });

  it("keeps app errors that merely mention WebGL", () => {
    expect(isDriverNoise("THREE.WebGLRenderer: Error creating WebGL context.")).toBe(false);
    expect(isDriverNoise("WebGL context lost")).toBe(false);
    expect(isDriverNoise("TypeError: x is undefined")).toBe(false);
  });
});
