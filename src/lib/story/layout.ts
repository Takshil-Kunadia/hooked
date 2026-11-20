/**
 * Layout modes for the story. The media queries below are the single source;
 * globals.css repeats them as Tailwind custom variants (a test keeps them in sync).
 */

export type LayoutMode = "stacked" | "tablet" | "desktop" | "wide";

export const LAYOUT_QUERIES: Readonly<Record<LayoutMode, string>> = {
  stacked: "(max-width: 760px), (max-width: 1180px) and (orientation: portrait)",
  tablet: "(min-width: 761px) and (max-width: 1180px) and (orientation: landscape)",
  desktop: "(min-width: 1181px) and (max-width: 1799px)",
  wide: "(min-width: 1800px)",
};

/** Mirrors LAYOUT_QUERIES; CSS treats a square viewport as portrait. Non-finite sizes read as desktop. */
export function layoutMode(width: number, height: number): LayoutMode {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return "desktop";
  if (width <= 760) return "stacked";
  if (width <= 1180) return height >= width ? "stacked" : "tablet";
  return width >= 1800 ? "wide" : "desktop";
}
