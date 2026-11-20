"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import type { CurvePath, Material, Vector3 } from "three";
import { ORIGIN_COLOURS } from "@/lib/design/tokens";
import { buildTransitPath, nearestParam } from "@/lib/geometry/transit";
import { FEEDER_LINES, MAIN_LINE, STATIONS, type LineSpec, type Origin, type StationId } from "@/lib/metro/route";
import type { FocusId } from "@/lib/story/chapter";
import { toneCompensatedCss, type Palette } from "../palette";
import { Depot } from "./Depot";
import { FeederLabels } from "./FeederLabels";
import { MapLabel } from "./MapLabel";
import { MetroLine } from "./MetroLine";
import { StationMarker } from "./StationMarker";
import { LABEL_LAYER, useLabelFonts, type LabelFonts, type LabelStyle } from "./labels";
import { linePoints, mainLinePath } from "./mainLine";
import { useMapMaterials, type MapMaterials } from "./materials";

/** Station labels sit this far behind (labelSide -1) or in front of (1) the line. */
const STATION_LABEL_OFFSET = 1.75;
const FEATURED_LABEL_SIZE = 1.15;

/** The hero overview's focus: every label on the map. */
export const OVERVIEW_FOCUS: ReadonlyArray<FocusId> = [...STATIONS.map((s) => s.id), "feeders", "depot"];

function lineMaterial(spec: LineSpec, m: MapMaterials): Material {
  if (spec.kind === "main") return m.line;
  if (spec.kind === "feeder" && spec.origin) return m.origin[spec.origin];
  return m.spur;
}

/** Yaw that lays a station's pill across the line (round 5's `stationMarker`). */
function markerYaw(path: CurvePath<Vector3>, x: number, z: number): number {
  const t = path.getTangentAt(nearestParam(path, x, z));
  return Math.atan2(-t.x, -t.z);
}

interface LabelStyles {
  readonly station: LabelStyle;
  readonly feeder: Readonly<Record<Origin, LabelStyle>>;
}

function labelStyles(palette: Palette, fonts: LabelFonts, anisotropy: number): LabelStyles {
  const station: LabelStyle = {
    ink: toneCompensatedCss(palette.labelInk),
    muted: toneCompensatedCss(palette.labelMuted),
    fonts,
    anisotropy,
  };
  const feeder = Object.fromEntries(
    (Object.keys(ORIGIN_COLOURS) as Origin[]).map((o) => [
      o,
      { ...station, accent: toneCompensatedCss(ORIGIN_COLOURS[o]) },
    ]),
  ) as Record<Origin, LabelStyle>;
  return { station, feeder };
}

interface MetroMapProps {
  /** Which labels show; every other label is hidden, not dimmed. */
  readonly focus: ReadonlyArray<FocusId>;
  /** The stop the story is at, outlined in blue. */
  readonly current?: StationId | null;
  /** The card the hover/pinned card names, if any: its station or the depot is highlighted. */
  readonly highlighted?: string | null;
  readonly palette: Palette;
}

/** The map: lines, station markers, labels printed on the floor and the depot. */
export function MetroMap({ focus, current = null, highlighted = null, palette }: MetroMapProps) {
  const camera = useThree((s) => s.camera);
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const materials = useMapMaterials(palette);
  const fonts = useLabelFonts();

  const mainPath = mainLinePath();
  const feeders = useMemo(
    () => FEEDER_LINES.map((spec) => ({ spec, path: buildTransitPath(linePoints(spec), spec.cornerRadius) })),
    [],
  );
  const yaws = useMemo(() => STATIONS.map((s) => markerYaw(mainPath, s.x, s.z)), [mainPath]);
  const styles = useMemo(() => (fonts ? labelStyles(palette, fonts, anisotropy) : null), [palette, fonts, anisotropy]);
  const shown = useMemo(() => new Set<FocusId>(focus), [focus]);

  /* the camera must see the labels' layer (the AO pass switches it off while it draws) */
  useLayoutEffect(() => {
    camera.layers.enable(LABEL_LAYER);
  }, [camera]);

  return (
    <group>
      <MetroLine path={mainPath} width={MAIN_LINE.width} segments={MAIN_LINE.segments} material={materials.line} />
      {feeders.map(({ spec, path }) => (
        <MetroLine
          key={spec.id}
          path={path}
          width={spec.width}
          segments={spec.segments}
          material={lineMaterial(spec, materials)}
        />
      ))}
      {STATIONS.map((s, i) => (
        <StationMarker
          key={s.id}
          x={s.x}
          z={s.z}
          len={s.len}
          yaw={yaws[i] ?? 0}
          current={s.id === current}
          highlighted={s.card === highlighted}
          card={s.card}
          materials={materials}
        />
      ))}
      {styles &&
        STATIONS.map((s) => (
          <MapLabel
            key={s.id}
            title={s.title}
            sub={s.sub}
            x={s.x}
            z={s.z + s.labelSide * STATION_LABEL_OFFSET}
            size={s.featured ? FEATURED_LABEL_SIZE : 1}
            style={styles.station}
            visible={shown.has(s.id)}
          />
        ))}
      {styles && <FeederLabels styles={styles.feeder} visible={shown.has("feeders")} />}
      <Depot
        materials={materials}
        labelStyle={styles?.station ?? null}
        labelVisible={shown.has("depot")}
        highlighted={highlighted}
      />
    </group>
  );
}
