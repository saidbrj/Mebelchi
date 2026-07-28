// OUTER corner = the ANGLED END UNIT: the last module of a run, its exposed front corner cut at 45°,
// open shelves. NOT a body that wraps the wall corner — real cabinetry builds a convex corner out of
// two ordinary runs and shapes only the exposed END (see model/outerCorner.ts).
// Pins the shared ring (both the 2D plan and the 3D read it) and the run-end seating.

import { describe, it, expect } from "vitest";
import { chamferRing, outerFacingSigns, outerCutFor } from "../src/model/outerCorner";
import { outerEndSeats, pickSeat } from "../src/model/runPlan";
import { seatOuterCorner, healCornerUnits } from "../src/model/rowOps";
import { mk } from "../src/model/cabinet";
import { isOuterCorner } from "../src/model/bands";
import type { Pt } from "../src/model/room";

// an L-shaped ROOM (a 4×4m square with the top-right 2×2m bitten out) → ONE reflex vertex, where two
// walls end with nothing to butt into. CCW winding. NOTE these are the WALL BOUNDARY points: the
// inner faces (what furniture stands against) are WALL_T inside them, so the elbow the cabinets see
// is at (1900,1900), not (2000,2000).
const L_ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 2000 },
  { x: 2000, y: 2000 }, // ← the elbow
  { x: 2000, y: 4000 },
  { x: 0, y: 4000 },
];
const RECT: Pt[] = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];

describe("chamferRing — a rectangle with one front corner cut at 45°", () => {
  it("is a pentagon: back, outer side, chamfer, front, inner side", () => {
    const { ring, openEdges } = chamferRing(400, 600, 200, 1);
    expect(ring).toHaveLength(5);
    expect(openEdges).toEqual([2, 3]); // the chamfer + what's left of the front are the display faces
    expect(ring[0]).toEqual({ along: -200, into: -300 }); // back-inner
    expect(ring[1]).toEqual({ along: 200, into: -300 });  // back-outer
    expect(ring[2]).toEqual({ along: 200, into: 100 });   // the cut starts 200 back from the front
    expect(ring[3]).toEqual({ along: 0, into: 300 });     // …and meets the front 200 in from the side
    expect(ring[4]).toEqual({ along: -200, into: 300 });  // front-inner
  });

  it("the cut is on the +su end, so it flips with the side the run's open end is on", () => {
    const a = chamferRing(400, 600, 200, 1).ring[2];
    const b = chamferRing(400, 600, 200, -1).ring[2];
    expect(a.along).toBe(200);
    expect(b.along).toBe(-200); // mirrored — the neighbour now butts the other side
  });

  it("a FULL cut drops the front face — a trapezoid, and a triangle when it's square", () => {
    const trap = chamferRing(400, 600, 400, 1); // cut == width → no front left
    expect(trap.ring).toHaveLength(4);
    expect(trap.openEdges).toEqual([2]); // only the diagonal is open now
    const tri = chamferRing(500, 500, 500, 1); // square + full cut → the outer side goes too
    expect(tri.ring).toHaveLength(3);
  });

  it("never cuts more than the shorter side (that would eat the module)", () => {
    expect(outerCutFor(400, 600)).toBe(400); // no explicit cut → the full 45°
    expect(outerCutFor(400, 600, 9999)).toBe(400);
    expect(outerCutFor(400, 600, -5)).toBe(0);
    expect(outerCutFor(400, 600, 150)).toBe(150);
  });
});

describe("outerEndSeats — the exposed ends of the runs", () => {
  it("gives TWO seats per elbow (one per wall ending there) and none in a rectangle", () => {
    expect(outerEndSeats(RECT, 400, 600)).toHaveLength(0); // no exposed run end
    expect(outerEndSeats(L_ROOM, 400, 600)).toHaveLength(2);
  });

  it("STRADDLES the tip: centred on the elbow, back on the inner wall face", () => {
    const seats = outerEndSeats(L_ROOM, 400, 600);
    // the wall arriving at the elbow comes from the right, with the room below it (y<1900): the
    // unit's back is on that face (centre 300 into the room) and its WIDTH is centred on the corner,
    // so half of it stands in the run and half hangs past the tip
    const capping = seats.find((s) => Math.abs(s.pz - 1600) < 1)!;
    expect(capping).toBeDefined();
    expect(capping.px).toBe(1900); // the elbow itself — not offset along the wall
    // the wall leaving the elbow runs +y along x=1900 with the room to its left
    const starting = seats.find((s) => Math.abs(s.px - 1600) < 1)!;
    expect(starting).toBeDefined();
    expect(starting.pz).toBe(1900);
    // both look DIAGONALLY out past the elbow — the facing point needs an along-wall component or
    // the cut side is undefined (it would sit exactly on the unit's own centre line)
    for (const s of seats) {
      const r = (s.rot * Math.PI) / 180;
      const along = (s.face.x - s.px) * Math.cos(r) + (s.face.y - s.pz) * Math.sin(r);
      const into = (s.face.x - s.px) * -Math.sin(r) + (s.face.y - s.pz) * Math.cos(r);
      expect(Math.abs(along)).toBeGreaterThan(500); // …so the cut lands on the exposed half
      expect(into).toBeGreaterThan(500);            // …on the room-facing side
    }
  });

  it("puts the cut on the half that hangs PAST the corner", () => {
    const [capping] = outerEndSeats(L_ROOM, 400, 600); // the wall arriving at the elbow, rot 180
    const { su } = outerFacingSigns(capping.face, capping.px, capping.pz, capping.rot);
    const r = (capping.rot * Math.PI) / 180;
    // the cut corner in world mm: +su along the width axis, on the front
    const cutX = capping.px + Math.cos(r) * su * 200 + -Math.sin(r) * 300;
    expect(cutX).toBeLessThan(1900); // past the elbow, out in the open room — not into the run
  });
});

describe("pickSeat — which seat a drag is aiming at", () => {
  // an elbow offers TWO seats, one per wall. Nearest-centre alone gets this wrong twice over.
  const seats = outerEndSeats(L_ROOM, 400, 600);
  const capping = seats.find((s) => Math.abs(s.pz - 1600) < 1)!;  // rot 180, on the arriving wall
  const starting = seats.find((s) => Math.abs(s.px - 1600) < 1)!; // rot 90, on the leaving wall

  it("reaches from the ELBOW, not just from the seat centre", () => {
    // dead on the vertex: 360mm from either seat centre, but the user is clearly aiming at the corner
    expect(pickSeat(seats, 1900, 1900, 180, 900)).not.toBeNull();
    // …and still lets go somewhere across the room
    expect(pickSeat(seats, 400, 3600, 180, 900)).toBeNull();
  });

  it("prefers the seat that DOESN'T spin the module onto the perpendicular wall", () => {
    // dropped where the two seats are equally close, the module stays on the wall it already lies
    // along instead of being spun 90° onto the other one
    const p = { x: 1750, y: 1750 }; // equidistant from (1900,1600) and (1600,1900)
    expect(pickSeat(seats, p.x, p.y, 180, 1200)).toBe(capping);
    // turn the module the other way and the other seat wins — the rule is symmetric
    expect(pickSeat(seats, p.x, p.y, 90, 1200)).toBe(starting);
  });

  it("falls back to the nearest when neither seat matches the module's rotation", () => {
    expect(pickSeat(seats, 2050, 1650, 45, 1200)).toBe(capping);
  });

  it("…but alignment is a HANDICAP, not a veto — the other wall stays reachable", () => {
    // an absolute preference for the aligned seat locked the unit to whichever wall it was seated
    // against: no drag could ever move it to the elbow's OTHER wall, which is the whole point of
    // turning it 90°. Drag clearly onto the other seat and it wins despite the module's rotation.
    expect(pickSeat(seats, starting.px, starting.pz, 180, 1200)).toBe(starting);
    expect(pickSeat(seats, capping.px, capping.pz, 90, 1200)).toBe(capping);
  });
});

describe("seatOuterCorner — caps the run nearest where it dropped", () => {
  it("keeps its own width, takes the run's depth, and lands on a seat", () => {
    const c = mk({ kind: "base", corner: true, cornerShape: "outer", w: 400, armDepth: 600, h: 720, fill: "open", count: 2 });
    const seated = seatOuterCorner(c, L_ROOM, 0, "all", []);
    expect(isOuterCorner(seated)).toBe(true);
    expect(seated.w).toBe(400);     // an end unit is as wide as you like…
    expect(seated.depth).toBe(600); // …and as deep as the row it joins
    expect(seated.px).toBeDefined();
    expect(seated.cornerFace).toBeDefined();
  });

  it("picks the wall that is FREE when the other one is already occupied", () => {
    const end = () => mk({ kind: "base", corner: true, cornerShape: "outer", w: 400, armDepth: 600, h: 720, fill: "open", count: 2 });
    const empty = seatOuterCorner(end(), L_ROOM, 0, "all", []);
    // …now stand an ordinary cabinet exactly where that seat is, and place another end unit
    // an ordinary cabinet standing in that run right beside the corner, covering that seat
    const r = ((empty.rot ?? 0) * Math.PI) / 180;
    const blocker = mk({
      kind: "base", w: 600, depth: 600, h: 720, rot: empty.rot,
      px: Math.round(empty.px! - Math.cos(r) * 300), pz: Math.round(empty.pz! - Math.sin(r) * 300),
    });
    const moved = seatOuterCorner(end(), L_ROOM, 0, "all", [], [blocker]);
    // the other wall of the same elbow — a quarter turn away, either way round
    expect([90, 270]).toContain((((moved.rot! - empty.rot!) % 360) + 360) % 360);
  });

  it("leaves the unit be in a plain rectangle (no exposed run end)", () => {
    const c = mk({ kind: "base", corner: true, cornerShape: "outer", w: 400, armDepth: 560, h: 720, px: 100, pz: 100 });
    const seated = seatOuterCorner(c, RECT, 0, "all", []);
    expect(seated.cornerFace).toBeUndefined(); // nothing to cap → not re-seated
  });
});

describe("healCornerUnits leaves an outer corner alone", () => {
  it("does NOT re-seat a hand-placed end unit (the drag → release → teleport-back bug)", () => {
    const c = mk({ kind: "base", corner: true, cornerShape: "outer", w: 400, depth: 560, armDepth: 560, h: 720, px: 1000, pz: 1000, rot: 45, cornerFace: { x: 2000, y: 2000 } });
    // heal runs on every cabs change — it must return null (nothing to fix) for the outer corner,
    // else it snaps back to a wall vertex at the 840 inner square the instant the drag commits
    expect(healCornerUnits([c], L_ROOM, 0, "all", [])).toBeNull();
    // an INNER corner of the wrong size STILL gets healed (proves the guard is specific)
    const wrong = mk({ kind: "base", corner: true, cornerShape: "l", w: 600, depth: 600, h: 720, px: 700, pz: 700, rot: 0 });
    expect(healCornerUnits([wrong], L_ROOM, 0, "all", [])).not.toBeNull();
  });
});

describe("outerFacingSigns — reads a world point in the unit basis", () => {
  it("maps quadrants correctly at rot 0", () => {
    expect(outerFacingSigns({ x: 100, y: 100 }, 0, 0, 0)).toEqual({ su: 1, si: 1 });
    expect(outerFacingSigns({ x: -100, y: -100 }, 0, 0, 0)).toEqual({ su: -1, si: -1 });
  });
});
