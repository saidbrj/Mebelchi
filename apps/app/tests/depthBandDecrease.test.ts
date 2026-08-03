// A wall band's depth must be a TWO-WAY edit. Depth is band-owned: gridFromSeeds tiles a band to the
// MAX depth of its uppers, and applyGrid projects that one depth back onto every upper. A depth edit
// used to write only the dragged module's `c.depth`, so once a band had been deepened, its unchanged
// neighbours (still at the deep value) won the max on every rebuild — a DECREASE reverted and the row
// was stuck, ratcheting up only. patchCabDims now fans a depth edit across the whole band, so it
// re-tiles to exactly the edited depth, up or down. This drives the REAL store path (patchCabDims +
// openSheet), the same two calls the constructor makes on a depth-arrow release.
//
// The store pulls in Supabase / sync / canvas at import; those are browser-only, so they're no-oped.

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
import { cabDepth } from "../src/model/bands";

const ROOM = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];

/** three wall units in one band on run 0, addressed into a fresh sheet */
function setup() {
  const cabs: Cabinet[] = [0, 600, 1200].map((x) => mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x }));
  useStore.setState({ roomPoints: ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs, grids: {} });
  useStore.getState().openSheet(0);
}

const uppers = () => useStore.getState().cabs.filter((c) => c.kind === "upper" && (c.run ?? 0) === 0);
/** edit ONE unit's depth, then re-tile the wall — exactly what a depth-arrow release does */
const editDepth = (mm: number) => {
  useStore.getState().patchCabDims(uppers()[0].id, { depth: mm });
  useStore.getState().openSheet(0);
};

describe("wall-band depth is a two-way edit", () => {
  it("deepens the whole band, then shrinks it back (decrease is not stuck)", () => {
    setup();
    expect(uppers().every((c) => cabDepth(c) === 350)).toBe(true); // the standard wall depth

    editDepth(500);
    expect(uppers().every((c) => cabDepth(c) === 500)).toBe(true); // an increase spreads to the band

    editDepth(350);
    // the reported bug: the band ratcheted to the MAX of its uppers, so this stayed 500 — stuck
    expect(uppers().every((c) => cabDepth(c) === 350)).toBe(true);
  });
});
