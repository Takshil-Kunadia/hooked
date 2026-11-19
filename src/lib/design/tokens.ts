/**
 * Colour tokens the 3D scene needs in JavaScript. They mirror src/styles/tokens.css,
 * and a unit test fails if the two drift apart. The source of truth is docs/design-system.md.
 */
import type { Origin } from "@/lib/metro/route";

export const ORIGIN_COLOURS: Readonly<Record<Origin, string>> = {
  core: "#8fa8ff",
  plugin: "#b79cf2",
  theme: "#7fd8b9",
  mu: "#f0cf6a",
  dropin: "#f29a88",
};

export const LINE_COLOURS = {
  main: "#3858e9",
  spur: "#c9ced8",
} as const;
