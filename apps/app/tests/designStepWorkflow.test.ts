import { describe, it, expect, beforeEach, vi } from "vitest";

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

const RECT = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];

describe("Design Step & Layout Template Workflow", () => {
  beforeEach(() => {
    useStore.setState({
      roomPoints: RECT.map((p) => ({ ...p })),
      ceiling: 2700,
      reveal: 0,
      cabs: [],
      openings: [],
      waterWall: 0,
      constraints: [],
    });
  });

  it("applies L-shaped template to target wall 0 with 2 rows", () => {
    const { applyLayoutTemplate } = useStore.getState();
    applyLayoutTemplate("l", 0, "single");

    const state = useStore.getState();
    expect(state.cabs.length).toBeGreaterThan(0);
    expect(state.runLayout).toBe("l");

    const uppers = state.cabs.filter((c) => c.kind === "upper");
    expect(uppers.length).toBeGreaterThan(0);

    // Single band means standard 2 rows (no antresols over standard height)
    const antresols = state.cabs.filter((c) => c.kind === "upper" && (c.mountY ?? 0) > 1500);
    expect(antresols.length).toBe(0);
  });

  it("applies L-shaped template with 3 rows (antresol band)", () => {
    const { applyLayoutTemplate } = useStore.getState();
    applyLayoutTemplate("l", 0, "antresol");

    const state = useStore.getState();
    expect(state.cabs.length).toBeGreaterThan(0);

    // 3 rows: includes upper antresols mounted above the main upper row
    const antresols = state.cabs.filter((c) => c.kind === "upper" && (c.mountY ?? 0) > 1500);
    expect(antresols.length).toBeGreaterThan(0);
  });

  it("snaps template to different target walls", () => {
    const { applyLayoutTemplate } = useStore.getState();

    // Wall 0
    applyLayoutTemplate("l", 0, "single");
    const cabsWall0 = useStore.getState().cabs;
    const runsWall0 = new Set(cabsWall0.map((c) => c.run));

    // Wall 1
    applyLayoutTemplate("l", 1, "single");
    const cabsWall1 = useStore.getState().cabs;
    const runsWall1 = new Set(cabsWall1.map((c) => c.run));

    expect(cabsWall0.length).toBeGreaterThan(0);
    expect(cabsWall1.length).toBeGreaterThan(0);
    expect([...runsWall0].sort()).toBeDefined();
    expect([...runsWall1].sort()).toBeDefined();
  });

  it("applies finish colors across all cabinets cleanly", () => {
    const { applyLayoutTemplate, applyFinishToAll } = useStore.getState();
    applyLayoutTemplate("i", 0, "single");

    // Apply Graphite & Walnut style
    applyFinishToAll({ facade: 0x3a3d40, carcass: 0x2b2d30, worktop: 0x5c4033 });

    const state = useStore.getState();
    for (const cab of state.cabs) {
      expect(cab.finish?.facade).toBe(0x3a3d40);
      expect(cab.finish?.carcass).toBe(0x2b2d30);
    }
  });

  it("adds corner cabinets for L-shaped and U-shaped layouts", () => {
    const { applyLayoutTemplate } = useStore.getState();

    // L-shaped layout should have 1 base corner and 1 upper corner (single band)
    applyLayoutTemplate("l", 0, "single");
    const lState = useStore.getState();
    const lBaseCorners = lState.cabs.filter((c) => c.corner && c.kind === "base");
    const lUpperCorners = lState.cabs.filter((c) => c.corner && c.kind === "upper");
    expect(lBaseCorners.length).toBe(1);
    expect(lUpperCorners.length).toBe(1);

    // L-shaped layout with antresol should have 1 base corner and 2 upper corners
    applyLayoutTemplate("l", 0, "antresol");
    const lAntresolState = useStore.getState();
    const lAntresolUpperCorners = lAntresolState.cabs.filter((c) => c.corner && c.kind === "upper");
    expect(lAntresolUpperCorners.length).toBe(2);

    // U-shaped layout should have 2 base corners and 2 upper corners
    applyLayoutTemplate("u", 0, "single");
    const uState = useStore.getState();
    const uBaseCorners = uState.cabs.filter((c) => c.corner && c.kind === "base");
    const uUpperCorners = uState.cabs.filter((c) => c.corner && c.kind === "upper");
    expect(uBaseCorners.length).toBe(2);
    expect(uUpperCorners.length).toBe(2);
  });

  it("syncs runStyle when applyFinishToAll is called for full kitchen palettes", () => {
    const { applyLayoutTemplate, applyFinishToAll } = useStore.getState();
    applyLayoutTemplate("i", 0, "single");

    // Emerald & Marble palette
    applyFinishToAll({ facade: 0x1b4d3e, carcass: 0x223830, worktop: 0xf3f4f6 });

    const state = useStore.getState();
    expect(state.runStyle.facade).toBe(0x1b4d3e);
    expect(state.runStyle.carcass).toBe(0x223830);
    expect(state.runStyle.worktop).toBe(0xf3f4f6);

    for (const cab of state.cabs) {
      expect(cab.finish?.facade).toBe(0x1b4d3e);
      expect(cab.finish?.carcass).toBe(0x223830);
      expect(cab.finish?.worktop).toBe(0xf3f4f6);
    }
  });

  it("persists and retrieves custom finish palettes in localStorage", async () => {
    const { loadCustomPalettes, saveCustomPalettes } = await import("../src/screens/ConfigScreen");

    const customPal = {
      id: "custom-test-1",
      name: "Мой Неоклассик",
      color1: "#738276",
      color2: "#d4b896",
      facade: 0x738276,
      carcass: 0x738276,
      worktop: 0xd4b896,
      isCustom: true,
    };

    saveCustomPalettes([customPal]);
    const loaded = loadCustomPalettes();
    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe("custom-test-1");
    expect(loaded[0].name).toBe("Мой Неоклассик");
    expect(loaded[0].facade).toBe(0x738276);
  });
});

