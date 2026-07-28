// Placing / converting an OUTER reverse-L through the real store: it wraps the L-room's reflex corner,
// stays on the free layer (open, run-depth), and reserves NO inner-corner zone. Browser-only libs are
// mocked, same as the corner-conversion store test.

import { describe, it, expect, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock("../src/lib/sync", () => ({ pullProfile: async () => null, pushProfile: async () => {}, pullProjects: async () => null, pushProject: async () => {}, deleteProjectCloud: async () => {}, pullSavedCabs: async () => null, pushSavedCab: async () => {}, deleteSavedCabCloud: async () => {} }));
vi.mock("../src/lib/cabThumb", () => ({ captureCabinetThumbnail: async () => null }));
vi.mock("../src/lib/thumbnailCapture", () => ({ captureThumbnail: async () => null }));
vi.mock("../src/lib/handoffExport", () => ({ runExport: async () => ({}) }));

import { useStore } from "../src/store";
import { mk, type Cabinet } from "../src/model/cabinet";
import { planRuns } from "../src/model/runPlan";
import { resolveLayout } from "../src/model/resolve";
import { isOuterCorner } from "../src/model/bands";

// an L-shaped room; the elbow (its one exposed run end) is at (2000,2000) — (1900,1900) as the
// cabinets see it, since furniture stands against the wall's INNER faces
const L_ROOM = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 2000 }, { x: 2000, y: 2000 }, { x: 2000, y: 4000 }, { x: 0, y: 4000 } ];
const outerBase: Partial<Cabinet> = { kind: "base", corner: true, cornerShape: "outer", w: 400, armDepth: 560, h: 720, fill: "open", count: 2 };

describe("the angled end unit through the store", () => {
  it("PLACES at an exposed run end, open + run-depth, with a facing point, no clash", () => {
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const id = useStore.getState().addCab(outerBase);
    expect(id).not.toBeNull();
    const placed = useStore.getState().cabs.find((c) => c.id === id)!;
    expect(isOuterCorner(placed)).toBe(true);
    expect(placed.px).toBeDefined();
    expect(placed.cornerFace).toBeDefined();
    expect(placed.depth).toBe(560); // the row's depth, NOT the 840 inner square
    expect(placed.w).toBe(400);     // …and its own width, which seating must not touch
    // it STRADDLES the elbow: centred on the corner tip, back on the wall's INNER FACE (280 in), so
    // half of it stands in the run and half hangs past the corner — see runPlan.outerEndSeats
    expect(placed.px).toBe(1900);
    expect(placed.pz).toBe(1620);
    const L = resolveLayout(useStore.getState().cabs, { points: L_ROOM, waterWall: null, layout: "all", openings: [] });
    expect([...L.clashing]).toEqual([]);
  });

  it("CONVERTS a plain cabinet into an end unit via replaceCab (the swap strip)", () => {
    const cabs: Cabinet[] = [mk({ kind: "base", w: 600, h: 720, run: 0, x: 0 })];
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs, grids: {}, selIds: [] });
    const base = useStore.getState().cabs[0];
    useStore.getState().replaceCab(base.id, { kind: "base", corner: true, cornerShape: "outer", fill: "open", count: 2 });
    const now = useStore.getState().cabs.find((c) => c.id === base.id)!;
    expect(isOuterCorner(now)).toBe(true);
    expect(now.px).toBeDefined();
    expect(now.cornerFace).toBeDefined();
    expect(now.depth).toBe(560); // run depth, not 840 — the bug was it seated as an inner corner
  });

  it("a depth edit keeps it a run-depth end unit, NOT the 880 inner square", () => {
    // THE "Угловой 880" bug: dimSelected/patchCabDims routed a corner's depth through seatCorner
    // (inner), turning the outer corner into an 840/880 inner square pinned to a wall vertex — which
    // then reverted on drag (inner corners are undone by heal).
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const id = useStore.getState().addCab(outerBase)!;
    useStore.setState({ selIds: [id] });
    useStore.getState().dimSelected({ depth: 600 }); // the user's room has 600-deep rows
    const c = useStore.getState().cabs.find((x) => x.id === id)!;
    expect(c.cornerShape).toBe("outer");
    expect(c.depth).toBe(600);  // the row's depth — NOT cornerSideFor(600)=880
    expect(c.w).toBe(400);      // an end unit's WIDTH is its own; a depth edit must not resize it
  });

  it("keeps the cut corner oriented to its rotation when moved/rotated by hand", () => {
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const id = useStore.getState().addCab(outerBase)!;
    // drag it somewhere and rotate it
    useStore.getState().moveCabPlan(id, { px: 3000, pz: 1000, rot: 90 });
    const c = useStore.getState().cabs.find((x) => x.id === id)!;
    expect(c.px).toBe(3000);
    expect(c.rot).toBe(90);
    // the facing point stays "in front" — outerFacingSigns reads (1,1) whatever the rotation, so the
    // cut corner always follows the grab (verified via the geometry helper)
    const r = (90 * Math.PI) / 180;
    const ux = Math.cos(r), uy = Math.sin(r), ix = -Math.sin(r), iy = Math.cos(r);
    const along = (c.cornerFace!.x - c.px!) * ux + (c.cornerFace!.y - c.pz!) * uy;
    const into = (c.cornerFace!.x - c.px!) * ix + (c.cornerFace!.y - c.pz!) * iy;
    expect(along).toBeGreaterThan(0);
    expect(into).toBeGreaterThan(0);
  });

  it("reserves NO corner zone (activeCorners ignores it)", () => {
    const flags = () => planRuns(L_ROOM, null, "all", [], useStore.getState().cabs).runs.map((r) => `${r.cornerStart}/${r.cornerEnd}`).join(",");
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const before = flags();
    useStore.getState().addCab(outerBase);
    expect(flags()).toBe(before); // the end unit lights up no vertex
  });
});
