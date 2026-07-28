// A CORNER UNIT MUST BE VISIBLE TO THE SHEET — the front view draws it, and the "+" cells know it
// is standing there.
//
// The bug: `cornerSlots` only ever returned a slot when the PLANNER had flagged that wall end as a
// corner zone (`run.cornerStart` / `cornerEnd`). Any corner the planner didn't light up — a vertex
// with no reference seat, or one the user dragged along the wall — resolved to NO elevation slot at
// all. Two symptoms, one cause: it disappeared from the front view, and `blockersFor` (which reads
// the same elevation) went on offering empty "+" cells over a cabinet that was standing right there.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { resolveLayout, wallLen } from "../src/model/resolve";
import { blockersFor } from "../src/model/sheet";
import { planRuns } from "../src/model/runPlan";
import type { Pt } from "../src/model/room";

const ROOM: Pt[] = [ { x: 0, y: 0 }, { x: 4200, y: 0 }, { x: 4200, y: 3000 }, { x: 0, y: 3000 } ];
const room = { points: ROOM, waterWall: null, layout: "all" as const, openings: [] };

/** wall 0 runs (0,0)→(4200,0) with the room above it; a module against it sits at y = depth/2 */
const onWall0 = (x: number, depth: number): Partial<Cabinet> => ({ px: x, pz: depth / 2, rot: 0 });

describe("a corner unit the planner never flagged", () => {
  const corner = (over: Partial<Cabinet>) =>
    mk({ kind: "base", corner: true, cornerShape: "l", w: 840, depth: 840, armDepth: 560, h: 720, ...over });

  /** the wall-space x of `id` on wall 0, or null if the sheet can't see it at all */
  const elevX = (c: Cabinet): number | null => {
    const hit = resolveLayout([c], room).elevation(0).find((e) => e.id === c.id);
    return hit ? hit.x : null;
  };

  it("still shows in the front elevation of the wall it stands against", () => {
    // dragged to the MIDDLE of wall 0 — not in either corner zone, so cornerSlots has nothing to say
    const mid = elevX(corner(onWall0(2000, 840)));
    expect(mid).not.toBeNull();
    const runs = planRuns(ROOM, null, "all", [], []).runs;
    expect(mid!).toBeGreaterThanOrEqual(0);
    expect(mid! + 840).toBeLessThanOrEqual(wallLen(runs[0]));
    // …and it TRACKS the module: slide it 500mm along the wall, the elevation follows exactly
    expect(elevX(corner(onWall0(2500, 840)))).toBe(mid! + 500);
  });

  it("…and the sheet's empty cells know it is standing there", () => {
    const c = corner(onWall0(2000, 840));
    const L = resolveLayout([c], room);
    const x = L.elevation(0).find((e) => e.id === c.id)!.x;
    const blocked = blockersFor(L, 0, [], [], { y0: 0, y1: 900 });
    expect(blocked.some((b) => b.a <= x && b.b >= x + 840)).toBe(true);
  });

  it("a corner in a real corner zone still resolves through cornerSlots (both walls)", () => {
    // seated where the planner does clear a zone: it belongs to BOTH walls that turn there, which
    // the fallback (one wall only) must not replace
    const seatX = 420, seatY = 420; // the 840 square tucked into the (0,0) corner
    const c = corner({ px: seatX, pz: seatY, rot: 0 });
    const L = resolveLayout([c], room);
    const runs = planRuns(ROOM, null, "all", [], [c]).runs;
    const walls = runs.map((_, r) => r).filter((r) => L.elevation(r).some((e) => e.id === c.id));
    expect(walls.length).toBe(2); // it closes one wall and starts the next
    // and it is flush against the end of each of them, not floating mid-wall
    for (const r of walls) {
      const x = L.elevation(r).find((e) => e.id === c.id)!.x;
      expect(x === 0 || x === wallLen(runs[r]) - 840).toBe(true);
    }
  });
});
