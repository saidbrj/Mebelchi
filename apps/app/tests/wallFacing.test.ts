// WHICH WAY DOES A WALL FACE? Every run carries an inward normal, and everything downstream trusts
// it: where a module is built, which way it is turned, and whether the front view / the sheet accept
// it as standing against that wall.
//
// The bug: the normal was chosen by comparing against `g.ctr`, the AVERAGE OF THE POLYGON'S VERTICES.
// In an L-shaped room that average lands inside the notch — outside the room — so every wall bounding
// the notch was flipped to face the cut-out. Cabinets tiled on those walls were built on the far side
// of the wall, and a module standing correctly against one was rejected everywhere that asks "is this
// turned toward this wall?" (resolve.freeSlot → the front elevation, and through it the sheet's "+"
// cells). It is now decided by stepping a millimetre off the wall and asking the room itself.

import { describe, it, expect } from "vitest";
import { planRuns } from "../src/model/runPlan";
import { polygonBoundsMm, type Pt } from "../src/model/room";

/** a 4×4m room with the top-right 2×2m bitten out — the vertex average (1966,1966) is IN the notch */
const L_ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 2000 },
  { x: 2000, y: 2000 },
  { x: 2000, y: 4000 },
  { x: 0, y: 4000 },
];
const RECT: Pt[] = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];

/** true when the point one metre off the wall's midpoint, along its inward normal, is inside the room */
function normalPointsIntoRoom(points: Pt[], runIdx: number): boolean {
  const b = polygonBoundsMm(points);
  const p = planRuns(points, null, "all", [], []).runs[runIdx].placement;
  // a metre in from the middle of the run, back in absolute mm
  const x = (p.ax + p.ux * (p.lenM / 2) + p.ix) * 1000 + b.cx;
  const y = (p.az + p.uz * (p.lenM / 2) + p.iz) * 1000 + b.cy;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], c = points[j];
    if (a.y > y !== c.y > y && x < ((c.x - a.x) * (y - a.y)) / (c.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

describe("every wall faces into the room", () => {
  it("…in a plain rectangle", () => {
    const { runs } = planRuns(RECT, null, "all", [], []);
    runs.forEach((r, i) => {
      if (r.kind !== "wall") return;
      expect(normalPointsIntoRoom(RECT, i)).toBe(true);
    });
  });

  it("…and in an L-room, INCLUDING the two walls that bound the notch", () => {
    const { runs } = planRuns(L_ROOM, null, "all", [], []);
    const walls = runs.map((r, i) => ({ r, i })).filter((e) => e.r.kind === "wall");
    expect(walls.length).toBe(6);
    for (const { i } of walls) expect(normalPointsIntoRoom(L_ROOM, i)).toBe(true);
  });

  it("the notch walls specifically — the two the vertex average used to flip", () => {
    // wall 2 runs along the bottom of the cut-out (room BELOW it), wall 3 up its left side (room to
    // the LEFT). Both midpoints are on the far side of the vertex average from the room.
    const { runs } = planRuns(L_ROOM, null, "all", [], []);
    expect(runs[2].placement.iz).toBeLessThan(0); // faces −z (down, into the room)
    expect(runs[3].placement.ix).toBeLessThan(0); // faces −x (left, into the room)
  });
});
