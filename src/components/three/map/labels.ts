import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Labels lean back 0.6 rad from the floor, towards the camera (round 5's TILT). */
export const TILT = 0.6;
/** World width of a size-1 label. */
export const LABEL_WORLD_WIDTH = 5.4;
/**
 * Round 5's label canvas: 2048 px across 5.4 world units is about twice the label's
 * on-screen size at the closest station shot, so text stays sharp on 2× screens.
 */
const CANVAS_W = 2048;
const CANVAS_H = 380;
export const LABEL_ASPECT = CANVAS_H / CANVAS_W;
/**
 * Labels live on their own layer so the ambient-occlusion pass can leave them out:
 * it redraws the scene with an opaque material, which would turn each label into a slab.
 */
export const LABEL_LAYER = 1;

export interface LabelFonts {
  readonly sans: string;
  readonly mono: string;
}

export interface LabelStyle {
  /** CSS colours, already tone-compensated so they come out exact on screen. */
  readonly ink: string;
  readonly muted: string;
  /** A short bar above the title in an origin colour (feeder lines). */
  readonly accent?: string;
  readonly fonts: LabelFonts;
  readonly anisotropy: number;
}

/* Round 5's type setting, in canvas pixels. */
const LONG_TITLE = 13;
const titleFont = (title: string, fonts: LabelFonts): string =>
  `650 ${title.length > LONG_TITLE ? 138 : 158}px ${fonts.sans}`;
const subFont = (fonts: LabelFonts): string => `68px ${fonts.mono}`;
const TITLE_BASELINE = 205;
const SUB_BASELINE = 312;
const ACCENT_BAR = { w: 120, h: 18, y: 22, r: 9 } as const;

function drawLabel(g: CanvasRenderingContext2D, title: string, sub: string, style: LabelStyle): void {
  const cx = CANVAS_W / 2;
  g.clearRect(0, 0, CANVAS_W, CANVAS_H);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  if (style.accent) {
    g.fillStyle = style.accent;
    g.beginPath();
    g.roundRect(cx - ACCENT_BAR.w / 2, ACCENT_BAR.y, ACCENT_BAR.w, ACCENT_BAR.h, ACCENT_BAR.r);
    g.fill();
  }
  g.fillStyle = style.ink;
  g.font = titleFont(title, style.fonts);
  g.fillText(title, cx, TITLE_BASELINE);
  if (sub) {
    g.fillStyle = style.muted;
    g.font = subFont(style.fonts);
    g.fillText(sub.toUpperCase(), cx, SUB_BASELINE);
  }
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Can't draw map labels: this browser has no 2D canvas");
  return g;
}

/** A label printed on the map: a bold title over a mono sub-label, as an unlit sRGB texture. */
export function labelTexture(title: string, sub: string, style: LabelStyle): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  drawLabel(context2d(canvas), title, sub, style);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = style.anisotropy;
  return texture;
}

let measurer: CanvasRenderingContext2D | null = null;

/** Half the inked width of a label, as a fraction of its plane's width. */
export function labelHalfWidthFraction(title: string, sub: string, fonts: LabelFonts): number {
  measurer ??= context2d(document.createElement("canvas"));
  measurer.font = titleFont(title, fonts);
  const titleW = measurer.measureText(title).width;
  measurer.font = subFont(fonts);
  const subW = sub ? measurer.measureText(sub.toUpperCase()).width : 0;
  return Math.max(titleW, subW) / CANVAS_W / 2;
}

const FALLBACK_FONTS: LabelFonts = {
  sans: "Inter, system-ui, sans-serif",
  mono: '"Departure Mono", ui-monospace, monospace',
};

function resolveFonts(): LabelFonts {
  const css = getComputedStyle(document.documentElement);
  return {
    sans: css.getPropertyValue("--font-inter").trim() || FALLBACK_FONTS.sans,
    mono: css.getPropertyValue("--font-departure-mono").trim() || FALLBACK_FONTS.mono,
  };
}

/**
 * The page's own Inter and Departure Mono (next/font gives them generated family names),
 * once they have loaded. Null until then, so labels are never drawn in a fallback face.
 */
export function useLabelFonts(): LabelFonts | null {
  const [fonts, setFonts] = useState<LabelFonts | null>(null);
  useEffect(() => {
    let live = true;
    const resolved = resolveFonts();
    Promise.all([document.fonts.load(titleFont("", resolved)), document.fonts.load(subFont(resolved))])
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[hooked] map label fonts failed to load; drawing with fallbacks:", error);
        }
      })
      .finally(() => {
        if (live) setFonts(resolved);
      });
    return () => {
      live = false;
    };
  }, []);
  return fonts;
}
