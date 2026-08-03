// A wall-unit DEPTH edit has to carry the corner unit with it. A wall band reserves a fixed 840 corner
// zone; a tiled upper reaches runReach(depth) into it and leaves a dead stub of cornerSideFor(depth);
// the corner unit's own square is cornerSideFor(armDepth). Those line up only when the band depth and
// the corner's arm depth are equal. The reported bug: changing the row's depth left the corner at the
// OLD depth, so it no longer matched the run it butts into — resizing the corner by hand then made it
// spill onto its neighbour and go red. Depth is now tier-owned: one edit moves every upper AND every
// corner at that height together, re-seating the corners, so nothing clashes.
//
// Driven through the store (replaceCab to seat a corner, then patchCabDims + openSheet) exactly as the
// Constructor does it. Browser-only deps are mocked to no-ops.

import { describe, it, expect, vi } from "vitest";

vi.mock("../src/lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock("../src/lib/sync", () => ({
  pullProfile: async () => null, pushProfile: async () => {}, pullProjects: async () => null,
  pushProject: async () => {}, deleteProjectCloud: async () => {}, pullSavedCabs: async () => null,
  pushSavedCab: async () => {}, deleteSavedCabCloud: async () => {},
}));
vi.mock("../src/lib/cabThumb", () => ({ captureCabinetThumbnail: async () => null }));
vi.mock("../src/lib/thumbnailCapture", () => ({ captureThumbnail: async () => null }));
vi.mock("../src/lib/handoffExport", () => ({ runExport: async () => ({}) }));

import { useStore } from "../src/store";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabDepth, cornerArm } from "../src/model/bands";
import { cornerSideFor, planRuns } from "../src/model/runPlan";
import { resolveLayout, type Room } from "../src/model/resolve";

const ROOM = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];
const room: Room = { points: ROOM, waterWall: null, layout: "all", openings: [], reveal: 0 };

function fill(cabs: Cabinet[], run: number, upto: number) {
  for (let x = 0; x + 600 <= upto; x += 600) {
    cabs.push(mk({ kind: "base", w: 600, h: 720, run, x }));
    cabs.push(mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run, x }));
  }
}

/** two-wall "all" kitchen with base+upper pairs on both runs; returns a re-tile-all helper */
function setup() {
  const cabs: Cabinet[] = [];
  fill(cabs, 0, 3600);
  fill(cabs, 1, 2400);
  useStore.setState({ roomPoints: ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs, grids: {} });
  const runs = planRuns(ROOM, null, "all", [], useStore.getState().cabs).runs;
  const openAll = () => runs.forEach((r, i) => { if (r.kind === "wall") useStore.getState().openSheet(i); });
  openAll();
  return openAll;
}

const cornerUpper = () => useStore.getState().cabs.find((c) => c.corner && c.kind === "upper");
const plainUppers = () => useStore.getState().cabs.filter((c) => c.kind === "upper" && !c.corner);

describe("a wall-unit depth edit carries the corner with it", () => {
  it("re-arms the corner to the edited depth, so nothing goes red", () => {
    const openAll = setup();

    // seat a diagonal corner upper at the inside corner (the start of the neighbour wall)
    const atCorner = plainUppers()
      .filter((c) => (c.run ?? 0) === 1)
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
    useStore.getState().replaceCab(atCorner.id, { kind: "upper", corner: true, cornerShape: "diagonal", fill: "shelves" });
    openAll();
    expect(cornerUpper()).toBeTruthy();
    expect([...resolveLayout(useStore.getState().cabs, room).clashing]).toEqual([]); // clean to start

    // deepen a plain wall unit — the whole upper tier AND the corner must follow to one depth
    useStore.getState().patchCabDims(plainUppers()[0].id, { depth: 500 });
    openAll();

    expect(plainUppers().every((c) => cabDepth(c) === 500)).toBe(true);
    expect(cornerArm(cornerUpper()!)).toBe(500);            // the corner re-armed to the run depth
    expect(cabDepth(cornerUpper()!)).toBe(cornerSideFor(500)); // its square followed the arm
    // the whole point: no overlap warning anywhere
    expect([...resolveLayout(useStore.getState().cabs, room).clashing]).toEqual([]);

    // and it still shrinks back cleanly (the corner rides it down too)
    useStore.getState().patchCabDims(plainUppers()[0].id, { depth: 350 });
    openAll();
    expect(plainUppers().every((c) => cabDepth(c) === 350)).toBe(true);
    expect(cornerArm(cornerUpper()!)).toBe(350);
    expect([...resolveLayout(useStore.getState().cabs, room).clashing]).toEqual([]);
  });
});
