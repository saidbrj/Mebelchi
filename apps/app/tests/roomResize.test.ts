// Room WIDTH / DEPTH resize. A rectangular room must resize as a whole and STAY rectangular — the old
// "Длина стены" dragged a single corner (setWallLength endpoint "b"), which skewed the box. These move
// the far edge's two corners together instead, holding the near edge still.

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
import type { Pt } from "../src/model/room";

const RECT: Pt[] = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];
const L: Pt[] = [ { x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 1000 }, { x: 4000, y: 1000 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 } ];
const setRect = () => useStore.setState({ roomPoints: RECT.map((p) => ({ ...p })) });

describe("room width / depth resize", () => {
  it("WIDTH resizes edge 0 and keeps the rectangle (depth held)", () => {
    setRect();
    useStore.getState().setRoomWidth(6000);
    expect(useStore.getState().roomPoints).toEqual([
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 3000 }, { x: 0, y: 3000 },
    ]);
  });

  it("DEPTH resizes edge 1 and keeps the rectangle (width held)", () => {
    setRect();
    useStore.getState().setRoomDepth(2000);
    expect(useStore.getState().roomPoints).toEqual([
      { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 2000 }, { x: 0, y: 2000 },
    ]);
  });

  it("clamps to a 1000mm minimum", () => {
    setRect();
    useStore.getState().setRoomWidth(200);
    expect(Math.round(Math.hypot(useStore.getState().roomPoints[1].x - useStore.getState().roomPoints[0].x, 0))).toBe(1000);
  });

  it("leaves a non-rectangular (L) room untouched", () => {
    useStore.setState({ roomPoints: L.map((p) => ({ ...p })) });
    useStore.getState().setRoomWidth(6000);
    expect(useStore.getState().roomPoints).toEqual(L);
  });
});
