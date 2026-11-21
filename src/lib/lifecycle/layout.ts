/**
 * Lays every hook of a request out as stops on one winding metro line. Each stage starts a new
 * row; a long stage wraps onto more rows. Rows alternate direction, so the line snakes down the
 * map like a transit diagram and the whole request fits one view.
 */

export type XZ = readonly [x: number, z: number];

export interface LayoutOptions {
  /** Every row spans this width, from its first stop to its last. */
  readonly rowWidth: number;
  readonly maxPerRow: number;
  /** Distance between the rows of one stage. */
  readonly rowGap: number;
  /** Extra distance before a new stage's first row. */
  readonly stageGap: number;
  /** How far the line runs past a row's end stops before it turns. */
  readonly pad: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  rowWidth: 56,
  maxPerRow: 90,
  rowGap: 2.4,
  stageGap: 3.2,
  pad: 1.2,
};

interface Row {
  readonly group: number;
  /** Index of the row's first stop. */
  readonly first: number;
  readonly count: number;
  readonly z: number;
  /** 1: left to right. -1: right to left. */
  readonly dir: 1 | -1;
}

export interface Layout {
  readonly positions: ReadonlyArray<XZ>;
  /** The line's corner points, for `buildTransitPath`. */
  readonly path: ReadonlyArray<XZ>;
  readonly rows: ReadonlyArray<Row>;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

/** Splits `count` stops into the fewest rows of at most `max`, as evenly as possible. */
export function rowSizes(count: number, max: number): number[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / max);
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

function planRows(groups: ReadonlyArray<number>, o: LayoutOptions): Row[] {
  const rows: Row[] = [];
  let first = 0;
  let z = 0;
  groups.forEach((count, group) => {
    rowSizes(count, o.maxPerRow).forEach((size, k) => {
      if (rows.length > 0) z += o.rowGap + (k === 0 ? o.stageGap : 0);
      rows.push({ group, first, count: size, z, dir: rows.length % 2 === 0 ? 1 : -1 });
      first += size;
    });
  });
  return rows;
}

/** A row's stops spread across the full width; a lone stop sits where the row is entered. */
function rowPositions(row: Row, width: number): XZ[] {
  const entry = row.dir === 1 ? 0 : width;
  if (row.count === 1) return [[entry, row.z]];
  const step = width / (row.count - 1);
  return Array.from({ length: row.count }, (_, i) => [entry + row.dir * i * step, row.z] as const);
}

/**
 * Corner points: each row's line runs `pad` past its end stops, then turns into the next row.
 * The last row stops just after its last stop.
 */
function linePath(rows: ReadonlyArray<Row>, positions: ReadonlyArray<XZ>, o: LayoutOptions): XZ[] {
  const path: XZ[] = [];
  rows.forEach((row, r) => {
    const entry = row.dir === 1 ? -o.pad : o.rowWidth + o.pad;
    const last = positions[row.first + row.count - 1];
    const isLast = r === rows.length - 1;
    const exit = isLast && last ? last[0] + row.dir * o.pad : row.dir === 1 ? o.rowWidth + o.pad : -o.pad;
    path.push([entry, row.z], [exit, row.z]);
  });
  return path;
}

/** Lays out `groups` (stop counts per stage, in order) as one snaking line. */
export function snakeLayout(groups: ReadonlyArray<number>, options: LayoutOptions = DEFAULT_LAYOUT): Layout {
  const rows = planRows(groups, options);
  const positions = rows.flatMap((row) => rowPositions(row, options.rowWidth));
  const path = linePath(rows, positions, options);
  const xs = path.map(([x]) => x);
  const zs = path.map(([, z]) => z);
  return {
    positions,
    path,
    rows,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
  };
}
