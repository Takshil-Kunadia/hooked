import { STATIONS, type StationId } from "@/lib/metro/route";

export type ShotId = "overview" | "station" | "depot" | "feeders" | "platform" | "web";
export type FocusId = StationId | "feeders" | "depot";

export interface BeatSpec {
  id: string;
  rail: string;
  station: StationId;
  shot: ShotId;
  focus: ReadonlyArray<FocusId>;
  board?: "announcements" | "init";
  pill?: "request" | "init" | "response";
  /** Beat that rings the station announcement, or the one where the tickets take turns. */
  cue?: "announce" | "cascade";
  hooks: ReadonlyArray<string>;
}

export interface ActSpec {
  id: string;
  kicker: string;
  title: string;
  beats: ReadonlyArray<BeatSpec>;
}

export interface ChapterSpec {
  id: string;
  acts: ReadonlyArray<ActSpec>;
}

export type ChapterIssue = {
  code: "duplicate-act" | "duplicate-beat" | "empty-act" | "unknown-hook" | "train-reverses";
  where: string;
};

export interface FlatBeat {
  actId: string;
  actIndex: number;
  beat: number;
  globalIndex: number;
  spec: BeatSpec;
}

export function flattenBeats(spec: ChapterSpec): ReadonlyArray<FlatBeat> {
  const flat: FlatBeat[] = [];
  spec.acts.forEach((act, actIndex) => {
    act.beats.forEach((beatSpec, beat) => {
      flat.push({ actId: act.id, actIndex, beat, globalIndex: flat.length, spec: beatSpec });
    });
  });
  return flat;
}

/** The flattened beat at `beat` within act `actId`, if the chapter has one. */
export function findBeat(flat: ReadonlyArray<FlatBeat>, actId: string, beat: number): FlatBeat | undefined {
  return flat.find((b) => b.actId === actId && b.beat === beat);
}

const stationIndex = (id: StationId): number => STATIONS.findIndex((s) => s.id === id);

function actIssues(spec: ChapterSpec): ChapterIssue[] {
  const seen = new Set<string>();
  const issues: ChapterIssue[] = [];
  for (const act of spec.acts) {
    if (seen.has(act.id)) issues.push({ code: "duplicate-act", where: act.id });
    seen.add(act.id);
    if (act.beats.length === 0) issues.push({ code: "empty-act", where: act.id });
    const beatIds = new Set<string>();
    for (const b of act.beats) {
      if (beatIds.has(b.id)) issues.push({ code: "duplicate-beat", where: `${act.id}/${b.id}` });
      beatIds.add(b.id);
    }
  }
  return issues;
}

function beatIssues(spec: ChapterSpec, hookExists: (name: string) => boolean): ChapterIssue[] {
  const issues: ChapterIssue[] = [];
  let previous = -1;
  for (const { actId, spec: b } of flattenBeats(spec)) {
    const where = `${actId}/${b.id}`;
    if (b.hooks.some((h) => !hookExists(h))) issues.push({ code: "unknown-hook", where });
    const index = stationIndex(b.station);
    if (index < previous) issues.push({ code: "train-reverses", where });
    previous = index;
  }
  return issues;
}

export function validateChapter(spec: ChapterSpec, hookExists: (name: string) => boolean): ChapterIssue[] {
  return [...actIssues(spec), ...beatIssues(spec, hookExists)];
}
