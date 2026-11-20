/** A label's horizontal footprint on the map, in world units. */
export interface LabelSpan {
  readonly x: number;
  readonly halfWidth: number;
}

/**
 * Stacks labels into rows so none overlap: each label, in input order, takes the first row
 * where it clears every label already there by `gap`. Earlier labels keep the front row.
 */
export function labelRows(spans: ReadonlyArray<LabelSpan>, gap: number): number[] {
  const placed: Array<ReadonlyArray<LabelSpan>> = [];
  return spans.map((span) => {
    const clears = (other: LabelSpan): boolean => Math.abs(span.x - other.x) >= span.halfWidth + other.halfWidth + gap;
    const free = placed.findIndex((row) => row.every(clears));
    const row = free === -1 ? placed.length : free;
    placed[row] = [...(placed[row] ?? []), span];
    return row;
  });
}
