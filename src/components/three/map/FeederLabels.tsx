"use client";

import { useMemo } from "react";
import { labelRows } from "@/lib/metro/label-rows";
import { FEEDER_LABEL_END_OFFSET, FEEDER_LABEL_ROW_STEP } from "@/lib/metro/feeder-labels";
import { FEEDER_LINES, type Origin } from "@/lib/metro/route";
import { MapLabel } from "./MapLabel";
import { LABEL_WORLD_WIDTH, labelHalfWidthFraction, type LabelStyle } from "./labels";

const SIZE = 0.78;
const ROW_GAP = 0.25;

const TITLES: Readonly<Record<Origin, string>> = {
  core: "core line",
  plugin: "plugins line",
  theme: "theme line",
  mu: "mu-plugins line",
  dropin: "drop-ins line",
};
const SUB = "joins at wp-settings";

interface FeederLabel {
  readonly id: string;
  readonly title: string;
  readonly origin: Origin;
  readonly x: number;
  readonly z: number;
}

/** One label per feeder line, at its outer end; data order decides who keeps the front row. */
function feederLabels(fonts: LabelStyle["fonts"]): FeederLabel[] {
  const feeders = FEEDER_LINES.flatMap((spec) => {
    const start = spec.points[0];
    return spec.kind === "feeder" && spec.origin && start ? [{ id: spec.id, origin: spec.origin, start }] : [];
  });
  const planeW = LABEL_WORLD_WIDTH * SIZE;
  const rows = labelRows(
    feeders.map(({ origin, start }) => ({
      x: start[0],
      halfWidth: labelHalfWidthFraction(TITLES[origin], SUB, fonts) * planeW,
    })),
    ROW_GAP,
  );
  return feeders.map(({ id, origin, start }, i) => ({
    id,
    origin,
    title: TITLES[origin],
    x: start[0],
    z: start[1] + FEEDER_LABEL_END_OFFSET + (rows[i] ?? 0) * FEEDER_LABEL_ROW_STEP,
  }));
}

interface FeederLabelsProps {
  /** One style per origin: the same ink, with the origin's colour bar. */
  readonly styles: Readonly<Record<Origin, LabelStyle>>;
  readonly visible: boolean;
}

export function FeederLabels({ styles, visible }: FeederLabelsProps) {
  const fonts = styles.core.fonts;
  const labels = useMemo(() => feederLabels(fonts), [fonts]);
  return labels.map((label) => (
    <MapLabel
      key={label.id}
      title={label.title}
      sub={SUB}
      x={label.x}
      z={label.z}
      size={SIZE}
      style={styles[label.origin]}
      visible={visible}
    />
  ));
}
