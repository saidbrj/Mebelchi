// MERGING A ROW INTO ONE CARCASS — the app's side of it.
//
// Pricing proves what a merged box CUTS (packages/pricing/test/carcass.test.ts). This proves what
// the app is allowed to merge, and — the part that actually keeps a workshop out of trouble — that
// a merged box DISSOLVES the moment an edit makes it unbuildable.
//
// A `carcassGroup` tag is a promise: these cabinets are one box, same kind, same height, same depth,
// side by side on one wall. Raise one member's height and the promise is a lie — there is no single
// side panel that serves a 720 upper and a 900 one. The tag has to go, because a tag that outlives
// its promise is a cut list the shop cannot build from.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import {
  mergeRow,
  unmergeRow,
  mergeCandidates,
  canMergeRow,
  boxMates,
  isMerged,
  healCarcassGroups,
} from "../src/model/carcassGroups";

/** a wall unit tiled on run 0 at a given x — the row a workshop wants to merge */
const upper = (x: number, o: Partial<Cabinet> = {}) =>
  mk({ kind: "upper", w: 600, h: 720, x, run: 0, mountY: 1400, ...o });

/** four of them in a row, left to right */
const row = () => [upper(0), upper(600), upper(1200), upper(1800)];

const tags = (cabs: Cabinet[]) => cabs.map((c) => c.carcassGroup);
const merge = (cabs: Cabinet[], i = 0) => mergeRow(cabs, cabs[i]) ?? cabs;

describe("what may be merged", () => {
  it("offers the whole row as candidates", () => {
    const cabs = row();
    expect(mergeCandidates(cabs, cabs[0])).toHaveLength(4);
    expect(canMergeRow(cabs, cabs[0])).toBe(true);
  });

  it("will not merge a lone cabinet", () => {
    const cabs = [upper(0)];
    expect(mergeCandidates(cabs, cabs[0])).toEqual([]);
    expect(canMergeRow(cabs, cabs[0])).toBe(false);
    expect(mergeRow(cabs, cabs[0])).toBeNull();
  });

  it("will not merge across a height change — no side panel serves both", () => {
    const cabs = [upper(0), upper(600, { h: 900 })];
    expect(canMergeRow(cabs, cabs[0])).toBe(false);
  });

  it("will not merge across a depth change", () => {
    const cabs = [upper(0), upper(600, { depth: 400 })];
    expect(canMergeRow(cabs, cabs[0])).toBe(false);
  });

  it("will not merge a wall unit with the base under it", () => {
    // rowMates already keys on kind — a box spanning the worktop is not a thing
    const cabs = [upper(0), mk({ kind: "base", w: 600, h: 720, x: 0, run: 0 })];
    expect(canMergeRow(cabs, cabs[0])).toBe(false);
  });

  it("will not merge across walls", () => {
    const cabs = [upper(0), upper(0, { run: 1 })];
    expect(canMergeRow(cabs, cabs[0])).toBe(false);
  });

  it("will not merge across a GAP — a carcass cannot have a hole in it", () => {
    // same wall, same band, same kind, same size: every row test passes. But they do not touch, and
    // there is no 1800mm side panel with a 600mm hole in the middle of it.
    const cabs = [upper(0), upper(600), upper(1800)];
    expect(mergeCandidates(cabs, cabs[0]).map((c) => c.id)).toEqual([cabs[0].id, cabs[1].id]);
    expect(mergeCandidates(cabs, cabs[2])).toEqual([]); // cut off by the gap — nothing to merge with
  });

  it("will not merge an appliance housing", () => {
    // a box built around a machine; the drilling solver already refuses to touch one
    const cabs = [upper(0), upper(600, { appliance: "hood" })];
    expect(mergeCandidates(cabs, cabs[0])).toEqual([]);
  });

  it("leaves islands, corners and furniture out of it", () => {
    for (const odd of [{ island: true }, { corner: true }, { furniture: "table" as const }]) {
      const cabs = [upper(0), upper(600, odd)];
      expect(canMergeRow(cabs, cabs[0])).toBe(false);
    }
  });
});

describe("merging and unmerging", () => {
  it("tags the whole row with one box id", () => {
    const cabs = merge(row());
    const gid = cabs[0].carcassGroup;
    expect(gid).toBeTruthy();
    expect(tags(cabs)).toEqual([gid, gid, gid, gid]);
    expect(boxMates(cabs, cabs[0])).toHaveLength(4);
    expect(isMerged(cabs[0])).toBe(true);
  });

  it("merges the row whichever member you tap", () => {
    expect(tags(merge(row(), 2)).every(Boolean)).toBe(true);
  });

  it("unmerges the WHOLE box, not just the cabinet tapped — half a box is not a thing", () => {
    const merged = merge(row());
    const split = unmergeRow(merged, merged[2])!;
    expect(tags(split)).toEqual([undefined, undefined, undefined, undefined]);
    expect(split.every((c) => !("carcassGroup" in c))).toBe(true); // the key is gone, not set to undefined
  });

  it("does not touch the cabinets outside the row", () => {
    const base = mk({ kind: "base", w: 600, x: 0, run: 0 });
    const cabs = merge([...row(), base]);
    expect(cabs[4].carcassGroup).toBeUndefined();
  });
});

describe("a broken box dissolves — THE INVARIANT", () => {
  it("survives an edit that changes nothing structural", () => {
    const cabs = merge(row());
    expect(healCarcassGroups(cabs)).toBe(cabs); // same array — no churn on every keystroke
  });

  it("dissolves when a member's height is raised out of the row", () => {
    const cabs = merge(row());
    const edited = cabs.map((c, i) => (i === 1 ? { ...c, h: 900 } : c));
    expect(tags(healCarcassGroups(edited)).filter(Boolean)).toEqual([]);
  });

  it("dissolves when a member's depth is changed", () => {
    const cabs = merge(row());
    const edited = cabs.map((c, i) => (i === 2 ? { ...c, depth: 400 } : c));
    expect(tags(healCarcassGroups(edited)).filter(Boolean)).toEqual([]);
  });

  it("dissolves when a member is dragged to another wall", () => {
    const cabs = merge(row());
    const edited = cabs.map((c, i) => (i === 3 ? { ...c, run: 1 } : c));
    expect(tags(healCarcassGroups(edited)).filter(Boolean)).toEqual([]);
  });

  it("dissolves when a member is re-hung into another band", () => {
    const cabs = merge(row());
    const edited = cabs.map((c, i) => (i === 0 ? { ...c, mountY: 2100 } : c)); // up to an antresol
    expect(tags(healCarcassGroups(edited)).filter(Boolean)).toEqual([]);
  });

  it("dissolves when the cabinet in the MIDDLE of the box is deleted", () => {
    // caught by driving the real app: the survivors are still row-mates (same wall, same band, same
    // kind), so every other test passed — and the box was quoted as one 1800 carcass while the
    // cabinets sat 0–1200 and 1800–2400 with a 600 hole between them. The 3D drew a stile in
    // mid-air. Touching is part of the promise, not a consequence of it.
    const cabs = merge(row());
    const afterDelete = cabs.filter((c) => c.x !== 1200); // the third cabinet is removed
    expect(afterDelete.map((c) => c.x)).toEqual([0, 600, 1800]);
    expect(tags(healCarcassGroups(afterDelete)).filter(Boolean)).toEqual([]);
  });

  it("drops a box left with one member — a box of one is just a cabinet", () => {
    const cabs = merge([upper(0), upper(600)]);
    const afterDelete = cabs.slice(0, 1); // the other one was removed from the run
    expect(healCarcassGroups(afterDelete)[0].carcassGroup).toBeUndefined();
  });

  it("keeps the box when a member is merely resized in width", () => {
    // width does not break a box — the row re-tiles and the carcass just gets a different bay. The
    // cabinets still TOUCH, which is the thing that matters. (0,600,1400,2000 with widths
    // 600,800,600,600.)
    const cabs = merge(row());
    const edited = cabs.map((c, i) =>
      i === 1 ? { ...c, w: 800 } : i === 2 ? { ...c, x: 1400 } : i === 3 ? { ...c, x: 2000 } : c,
    );
    expect(tags(healCarcassGroups(edited)).every(Boolean)).toBe(true);
  });

  it("is idempotent — healing healed cabs returns the same array (the store subscribes to this)", () => {
    const broken = merge(row()).map((c, i) => (i === 1 ? { ...c, h: 900 } : c));
    const once = healCarcassGroups(broken);
    expect(healCarcassGroups(once)).toBe(once); // or the store's subscribe() would loop
  });

  it("leaves an unmerged run completely alone", () => {
    const cabs = row();
    expect(healCarcassGroups(cabs)).toBe(cabs);
  });
});
