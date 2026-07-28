// DRAG AN ANGLED END UNIT TO THE ELBOW AND LET GO — it must stay there, standing IN the run.
//
// The bug: dragging one onto an L-room's inner elbow looked right under the finger and then slid off
// to one side the instant the finger lifted. Three causes, all pinned here:
//
//   0. THE SEAT WAS THE WRONG PLACE (and for a while, the wrong SHAPE, and then a wall-thickness out).
//      This module caps a run whose end is exposed — it is not a body that wraps the wall corner — so
//      its seats are the run ends at a reflex vertex, back on the wall's INNER face, straddling the
//      corner tip (the seller wants the angled face on the corner point itself).
//   1. IT HAD NO SEATS AT ALL. `cornerSeats` was left empty for it (an end unit must not magnet into
//      an INNER corner's seat), so it fell through to the single-nearest-wall snap: flush against
//      whichever elbow wall was closer, at whatever distance along it the finger happened to be.
//   2. THE LIVE DRAG AND THE REBUILD USED DIFFERENT ORIGINS. kitchen3d builds an ordinary module from
//      its BACK face but a corner unit from its footprint CENTRE, while the gizmo's live
//      `applyTransform` always backed off half the depth — so on release the module was re-placed
//      half a depth away from where the finger had it. That offset is the jump.

import { describe, it, expect, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock("../src/lib/sync", () => ({ pullProfile: async () => null, pushProfile: async () => {}, pullProjects: async () => null, pushProject: async () => {}, deleteProjectCloud: async () => {}, pullSavedCabs: async () => null, pushSavedCab: async () => {}, deleteSavedCabCloud: async () => {} }));
vi.mock("../src/lib/cabThumb", () => ({ captureCabinetThumbnail: async () => null }));
vi.mock("../src/lib/thumbnailCapture", () => ({ captureThumbnail: async () => null }));
vi.mock("../src/lib/handoffExport", () => ({ runExport: async () => ({}) }));
// PBR loads image textures through the DOM; headless we only care about where the groups land
vi.mock("../src/three/pbr", () => ({ PBR: false, texturedMaterial: () => null, planarUV: () => {} }));
vi.mock("../src/three/contact", () => ({ contactShadow: () => {} })); // painted shadow = a canvas decal

import { useStore } from "../src/store";
import { mk, type Cabinet } from "../src/model/cabinet";
import { outerEndSeats, planRuns } from "../src/model/runPlan";
import { outerFacingSigns, chamferRing } from "../src/model/outerCorner";
import { cabFootprints } from "../src/model/footprint";
import { buildKitchen, groupBackOffM } from "../src/three/kitchen3d";
import { polygonBoundsMm, type Pt } from "../src/model/room";
import { resolveLayout } from "../src/model/resolve";
import { blockersFor } from "../src/model/sheet";

// an L-shaped room: a 4×4m square with the top-right 2×2m bitten out. ONE reflex vertex — the elbow
// at (2000,2000), where the user drags the end unit.
const L_ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 2000 },
  { x: 2000, y: 2000 }, // ← the elbow
  { x: 2000, y: 4000 },
  { x: 0, y: 4000 },
];
// the elbow AS THE CABINETS SEE IT: the wall's inner faces are WALL_T inside the boundary polygon
const ELBOW = { x: 1900, y: 1900 };
const W = 400, D = 600;
const outerBase: Partial<Cabinet> = { kind: "base", corner: true, cornerShape: "outer", w: W, armDepth: D, h: 720, fill: "open", count: 2 };
const CORNER_SNAP_MM = 900; // the gizmo's seat magnet radius (VariantScene / ConstructorPlan)
const STYLE = { carcass: 0xffffff, facade: 0xdedad2, worktop: 0x4a4a4a, handle: 0x9a9a9a, glassUppers: false };

/** L_ROOM is axis-aligned, so "inside" is just the big square minus the bitten-out quadrant.
 *  `tol` lets a point sitting exactly ON a wall face count as inside. */
const inRoom = (p: Pt, tol = 0) =>
  p.x >= 100 - tol && p.x <= 3900 + tol && p.y >= 100 - tol && p.y <= 3900 + tol &&
  !(p.x > 1900 + tol && p.y > 1900 + tol);

/** what the gizmo does on every pointermove: nearest run-end seat within the magnet radius, else null */
const seatNear = (px: number, pz: number) => {
  let best: ReturnType<typeof outerEndSeats>[number] | null = null;
  let bd = CORNER_SNAP_MM;
  for (const s of outerEndSeats(L_ROOM, W, D)) {
    const d = Math.hypot(px - s.px, pz - s.pz);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
};

describe("dragging an angled end unit onto the L-room elbow", () => {
  it("finds a seat when the finger is anywhere NEAR the elbow", () => {
    expect(seatNear(1900, 1900)).not.toBeNull(); // right at the elbow
    expect(seatNear(2200, 1500)).not.toBeNull(); // on the arriving wall
    expect(seatNear(400, 3600)).toBeNull();      // the far side of the room — free placement
  });

  it("RELEASE KEEPS IT: the committed transform is the seat, and nothing moves it afterwards", () => {
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    // start it away from the elbow, flush on the south wall — the state a fresh unit is in
    const id = useStore.getState().addCab({ ...outerBase, px: 900, pz: 300, rot: 0 })!;
    useStore.setState({ cabs: useStore.getState().cabs.map((c) => (c.id === id ? { ...c, px: 900, pz: 300, rot: 0 } : c)) });

    const seat = seatNear(2000, 1700)!; // finger near the elbow
    useStore.getState().moveCabPlan(id, { px: seat.px, pz: seat.pz, rot: seat.rot, cornerFace: seat.face });
    useStore.getState().healRows(); // runs on every cabs change (ConfigScreen effect)

    const c = useStore.getState().cabs.find((x) => x.id === id)!;
    expect({ px: c.px, pz: c.pz, rot: c.rot }).toEqual({ px: seat.px, pz: seat.pz, rot: seat.rot });
    expect(c.cornerFace).toEqual(seat.face);
  });

  it("STRADDLES the elbow: back flush on the wall, centred on the tip, cut on the exposed half", () => {
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const id = useStore.getState().addCab(outerBase)!;
    const seat = seatNear(2000, 1700)!;
    useStore.getState().moveCabPlan(id, { px: seat.px, pz: seat.pz, rot: seat.rot, cornerFace: seat.face });
    const c = useStore.getState().cabs.find((x) => x.id === id)!;

    // the ring the 2D plan and the 3D both draw, in world mm
    const f = cabFootprints([c], L_ROOM, null, "all", [])[0];
    const { su } = outerFacingSigns(c.cornerFace!, f.cx, f.cy, f.rotDeg);
    const P = (along: number, into: number) => ({ x: f.cx + f.ux * along + f.ix * into, y: f.cy + f.uy * along + f.iy * into });
    const { ring } = chamferRing(f.w, f.depth, f.chamfer ?? Infinity, su);

    // every point of the body is inside the room — an end unit stands IN the room, it wraps nothing
    for (const p of ring.map((q) => P(q.along, q.into))) expect(inRoom(p, 1)).toBe(true);
    // its two BACK corners are on the wall's INNER face (y = 1900 here), i.e. the run's line
    const backL = P(-su * (f.w / 2), -f.depth / 2), backR = P(su * (f.w / 2), -f.depth / 2);
    expect(Math.abs(backL.y - ELBOW.y)).toBeLessThan(1);
    expect(Math.abs(backR.y - ELBOW.y)).toBeLessThan(1);
    // …and the ELBOW is the MIDPOINT of that back edge: the unit is centred on the corner tip, half
    // in the run and half hanging past it
    expect(Math.abs((backL.x + backR.x) / 2 - ELBOW.x)).toBeLessThan(1);
    // the CUT is on the half that hangs past the corner, not on the side the neighbour butts
    const cut = P(su * (f.w / 2), f.depth / 2);
    expect(Math.abs(cut.x - ELBOW.x)).toBeGreaterThan(1);
    expect(Math.sign(cut.x - ELBOW.x)).toBe(Math.sign(backL.x - backR.x) * -1 || -1);
  });

  it("SHOWS IN THE FRONT VIEW of the wall it stands on", () => {
    // it is on the floating layer (no grid cell), so the front view can only draw it if resolveLayout
    // gives it an elevation slot. Straddling the tip means it hangs half its width past the run's
    // end — which must not make the sheet drop it.
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const id = useStore.getState().addCab(outerBase)!;
    const cabs = useStore.getState().cabs;
    const L = resolveLayout(cabs, { points: L_ROOM, waterWall: null, layout: "all", openings: [] });
    const walls = L.runs.map((_, r) => r).filter((r) => L.elevation(r).some((e) => e.id === id));
    expect(walls.length).toBeGreaterThan(0);
    // and it blocks the "+" cells there, so the sheet can't offer that space twice
    const spans = blockersFor(L, walls[0], [], [], { y0: 0, y1: 900 });
    const x = L.elevation(walls[0]).find((e) => e.id === id)!.x;
    expect(spans.some((b) => b.a <= x + 1 && b.b >= x + W - 1)).toBe(true);
  });

  it("a hand rotation still steers the cut (no seat → the store re-derives it)", () => {
    useStore.setState({ roomPoints: L_ROOM, waterWall: null, runLayout: "all", openings: [], ceiling: 2700, cabs: [], grids: {}, selIds: [] });
    const id = useStore.getState().addCab(outerBase)!;
    useStore.getState().moveCabPlan(id, { px: 3000, pz: 1000, rot: 90 }); // dropped mid-room, spun
    const c = useStore.getState().cabs.find((x) => x.id === id)!;
    expect(outerFacingSigns(c.cornerFace!, c.px!, c.pz!, c.rot ?? 0)).toEqual({ su: 1, si: 1 });
  });
});

describe("the drag preview and the rebuild share one origin", () => {
  // `applyTransform` (live) vs buildKitchen (on release): if these disagree the module jumps by the
  // difference the moment the finger lifts. THE contract — corner units are built about their CENTRE
  // — is one exported function that the gizmo reads too, instead of a number each side assumed.
  it("groupBackOffM: zero for a corner unit, half a depth for anything else", () => {
    expect(groupBackOffM(mk({ ...outerBase, depth: D }))).toBe(0);
    expect(groupBackOffM(mk({ kind: "base", corner: true, cornerShape: "l", w: 840, depth: 840, h: 720 }))).toBe(0);
    expect(groupBackOffM(mk({ kind: "base", w: 600, depth: 560, h: 720 }))).toBeCloseTo(0.28, 6);
    expect(groupBackOffM(mk({ kind: "upper", w: 600, depth: 320, h: 720 }))).toBeCloseTo(0.16, 6);
  });

  const groupPos = (c: Cabinet) => {
    const b = polygonBoundsMm(L_ROOM);
    const runs = planRuns(L_ROOM, null, "all", [], [c]).runs;
    const g = buildKitchen([c], runs as never, STYLE, { cx: b.cx, cy: b.cy });
    return g.children.find((o) => o.userData.cabId === c.id)!.position;
  };

  it("a CORNER unit's group sits at its footprint centre (back-off 0)", () => {
    const b = polygonBoundsMm(L_ROOM);
    const seat = outerEndSeats(L_ROOM, W, D)[0];
    const c = mk({ ...outerBase, depth: D, px: seat.px, pz: seat.pz, rot: seat.rot, cornerFace: seat.face });
    const p = groupPos(c);
    expect(p.x).toBeCloseTo((seat.px - b.cx) / 1000, 6);
    expect(p.z).toBeCloseTo((seat.pz - b.cy) / 1000, 6);
  });

  it("an ORDINARY free module's group sits half a depth BEHIND its centre", () => {
    const b = polygonBoundsMm(L_ROOM);
    const c = mk({ kind: "base", w: 600, depth: 560, h: 720, px: 1000, pz: 280, rot: 0 });
    const p = groupPos(c);
    // rot 0 → facing +z, so the back face is 280mm at −z from the centre
    expect(p.x).toBeCloseTo((1000 - b.cx) / 1000, 6);
    expect(p.z).toBeCloseTo((280 - b.cy) / 1000 - 0.28, 6);
  });
});
