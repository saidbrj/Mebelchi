import { describe, it, expect, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock("../src/lib/sync", () => ({ pullProfile: async () => null, pushProfile: async () => {}, pullProjects: async () => null, pushProject: async () => {}, deleteProjectCloud: async () => {}, pullSavedCabs: async () => null, pushSavedCab: async () => {}, deleteSavedCabCloud: async () => {} }));
vi.mock("../src/lib/cabThumb", () => ({ captureCabinetThumbnail: async () => null }));
vi.mock("../src/lib/thumbnailCapture", () => ({ captureThumbnail: async () => null }));
vi.mock("../src/lib/handoffExport", () => ({ runExport: async () => ({}) }));

import { mk } from "../src/model/cabinet";
import { useStore } from "../src/store";
import type { Pt } from "../src/model/room";

const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

describe("Corner cabinet row isolation", () => {
  it("changing 2-row corner cabinet depth does NOT change 3-row antresol corner cabinet depth", () => {
    // 2-row corner cabinet (standard wall row, mountY 1520, h 720)
    const row2Corner = mk({
      id: "row2_corner",
      kind: "upper",
      corner: true,
      armDepth: 350,
      depth: 350,
      mountY: 1520,
      h: 720,
    });

    // 3-row antresol corner cabinet (top row, mountY 2240, h 460)
    const row3Corner = mk({
      id: "row3_corner",
      kind: "upper",
      corner: true,
      armDepth: 350,
      depth: 350,
      mountY: 2240,
      h: 460,
    });

    useStore.setState({
      roomPoints: ROOM,
      waterWall: null,
      runLayout: "l",
      openings: [],
      ceiling: 2700,
      cabs: [row2Corner, row3Corner],
      grids: {},
      selIds: [],
    });

    // Change depth of 2-row corner cabinet to 450mm
    useStore.getState().patchCabDims("row2_corner", { depth: 450 });

    const updatedCabs = useStore.getState().cabs;
    const updatedRow2 = updatedCabs.find((c) => c.id === "row2_corner");
    const updatedRow3 = updatedCabs.find((c) => c.id === "row3_corner");

    // 2-row corner cabinet updated to 450
    expect(updatedRow2?.armDepth).toBe(450);

    // 3-row corner cabinet remains at 350!
    expect(updatedRow3?.armDepth).toBe(350);
  });
});
