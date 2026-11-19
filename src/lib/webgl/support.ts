interface CanvasLike {
  getContext(kind: "webgl2"): unknown;
}

const defaultCanvas = (): CanvasLike => document.createElement("canvas");

/**
 * True when the browser can create a WebGL2 context. When it can't, the page
 * shows text only. A crashed 3D stage must never take the copy down with it.
 */
export function isWebGLAvailable(createCanvas: () => CanvasLike = defaultCanvas): boolean {
  if (createCanvas === defaultCanvas && typeof document === "undefined") return false;
  try {
    return Boolean(createCanvas().getContext("webgl2"));
  } catch {
    return false;
  }
}
