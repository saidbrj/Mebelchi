// Resizing the depth of wall units used to break the grid: depth is a property of the BAND (its
// columns and its corner reach are tiled to one depth, and applyGrid projects that depth back onto
// every upper), but a depth edit writes `c.depth` per module and `stale()` can't see it — so the
// sheet was never rebuilt and the row was left ragged (some deep, some shallow, front faces stepped).
// ensureSheet now rebuilds when a wall band's depth no longer matches its uppers.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabDepth } from "../src/model/bands";
import { buildSheet, ensureSheet } from "../src/model/sheet";
import type { Room } from "../src/model/resolve";
import type { Pt } from "../src/model/room";

const CEILING = 2700;
const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room: Room = { points: ROOM, waterWall: null, layout: "i", openings: [] };

/** a single wall of shallow (350) wall units, addressed into a fresh sheet */
function shallowRow() {
  const cabs = [0, 600, 1200].map((x) => mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x }));
  const built = buildSheet(cabs, room, CEILING, 0);
  return { grid: built.grid, cabs: built.cabs };
}

const wallDepth = (g: { rows: { kind: string; depth: number }[] }) =>
  g.rows.find((r) => r.kind === "wall")?.depth;
const uppers = (cabs: Cabinet[]) => cabs.filter((c) => c.kind === "upper");

describe("ensureSheet — a wall band re-tiles when its depth is edited", () => {
  it("builds the row at the standard 350mm depth", () => {
    const { grid, cabs } = shallowRow();
    expect(wallDepth(grid)).toBe(350);
    expect(uppers(cabs).every((c) => cabDepth(c) === 350)).toBe(true);
  });

  it("does nothing when the sheet is already consistent (no spurious rebuild)", () => {
    const { grid, cabs } = shallowRow();
    expect(ensureSheet({ 0: grid }, cabs, room, CEILING, 0)).toBeNull();
  });

  it("rebuilds to the new depth when the whole row is resized deeper", () => {
    const { grid, cabs } = shallowRow();
    const edited = cabs.map((c) => (c.kind === "upper" ? { ...c, depth: 500 } : c));
    const res = ensureSheet({ 0: grid }, edited, room, CEILING, 0);
    expect(res).not.toBeNull();
    expect(wallDepth(res!.grids[0])).toBe(500);
    // every upper ends up at ONE depth — the ragged mix is gone
    expect(uppers(res!.cabs).every((c) => cabDepth(c) === 500)).toBe(true);
  });

  it("pulls the rest of the band along when only some units are resized (row owns depth)", () => {
    const { grid, cabs } = shallowRow();
    // deepen just the first unit — the whole band should follow so nothing is left stepped
    const edited = cabs.map((c, i) => (i === 0 && c.kind === "upper" ? { ...c, depth: 560 } : c));
    const res = ensureSheet({ 0: grid }, edited, room, CEILING, 0);
    expect(res).not.toBeNull();
    expect(wallDepth(res!.grids[0])).toBe(560);
    expect(uppers(res!.cabs).every((c) => cabDepth(c) === 560)).toBe(true);
  });

  it("settles in one pass — the rebuilt sheet reports nothing more to do", () => {
    const { grid, cabs } = shallowRow();
    const edited = cabs.map((c) => (c.kind === "upper" ? { ...c, depth: 500 } : c));
    const res = ensureSheet({ 0: grid }, edited, room, CEILING, 0)!;
    // feeding the rebuilt state back in must be a fixed point (no infinite rebuild loop)
    expect(ensureSheet(res.grids, res.cabs, room, CEILING, 0)).toBeNull();
  });
});
