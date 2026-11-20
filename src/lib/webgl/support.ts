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

/** What the stage area shows: nothing yet, the 3D stage, or the copy-only fallback. */
export type StageMode = "pending" | "stage" | "copy";

/**
 * `support` is null until the browser has been asked (on the server and during hydration). Until
 * then nothing renders: the copy-only fallback would mark the train arrived before the real one
 * exists. Without WebGL, or once the context is lost, the story runs copy-only.
 */
export function stageMode(support: boolean | null, lost: boolean): StageMode {
  if (support === null) return "pending";
  return support && !lost ? "stage" : "copy";
}
