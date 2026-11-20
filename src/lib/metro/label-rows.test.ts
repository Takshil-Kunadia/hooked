import { describe, expect, it } from "vitest";
import { labelRows, type LabelSpan } from "./label-rows";

const at = (x: number, halfWidth = 1): LabelSpan => ({ x, halfWidth });

describe("labelRows", () => {
  it("keeps labels that don't overlap on the first row", () => {
    expect(labelRows([at(0), at(3)], 0.2)).toEqual([0, 0]);
  });

  it("moves an overlapping label to the next row", () => {
    expect(labelRows([at(0), at(1.2)], 0.2)).toEqual([0, 1]);
  });

  it("counts the gap as part of the overlap", () => {
    expect(labelRows([at(0), at(2.1)], 0.2)).toEqual([0, 1]);
    expect(labelRows([at(0), at(2.2)], 0.2)).toEqual([0, 0]);
  });

  it("places labels in input order, so earlier ones keep the first row", () => {
    /* round 5's plugins and theme labels first, then mu-plugins and drop-ins */
    const rows = labelRows([at(-4.9, 1.07), at(-1.7, 0.9), at(-6.1, 1.17), at(-0.5, 1.16)], 0.2);
    expect(rows).toEqual([0, 0, 1, 1]);
  });

  it("opens a third row when both rows are taken", () => {
    expect(labelRows([at(0), at(0.5), at(1)], 0)).toEqual([0, 1, 2]);
  });

  it("fills a gap in an earlier row", () => {
    expect(labelRows([at(0), at(1), at(5)], 0)).toEqual([0, 1, 0]);
  });

  it("returns nothing for no labels", () => {
    expect(labelRows([], 0.2)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const spans = [at(0), at(1)];
    labelRows(spans, 0);
    expect(spans).toEqual([at(0), at(1)]);
  });
});
