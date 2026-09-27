import { describe, it, expect } from "vitest";
import { adaptCabinetsToRoom } from "../src/model/roomAdapt";
import { roomOutlineMm, type Pt } from "../src/model/room";
import { mk, type Cabinet } from "../src/model/cabinet";

describe("adaptCabinetsToRoom", () => {
  it("adapts wall cabinets when room width shrinks", () => {
    // 4000 x 3000 room -> Wall 0 is 4000mm
    const oldPoints: Pt[] = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 2000 },
      { x: 0, y: 2000 },
    ];
    // Shrink to 2500 x 2000 -> Wall 0 is 2500mm
    const newPoints: Pt[] = [
      { x: 0, y: 0 },
      { x: 2500, y: 0 },
      { x: 2500, y: 2000 },
      { x: 0, y: 2000 },
    ];

    const cabs: Cabinet[] = [
      mk({ kind: "base", run: 0, x: 0, w: 600, h: 720, fill: "shelves", count: 1, door: 0, handle: 0 }),
      mk({ kind: "base", run: 0, x: 600, w: 600, h: 720, fill: "shelves", count: 1, door: 0, handle: 0 }),
      mk({ kind: "base", run: 0, x: 1200, w: 600, h: 720, fill: "shelves", count: 1, door: 0, handle: 0 }),
      mk({ kind: "base", run: 0, x: 1800, w: 600, h: 720, fill: "shelves", count: 1, door: 0, handle: 0 }),
      mk({ kind: "base", run: 0, x: 2400, w: 600, h: 720, fill: "shelves", count: 1, door: 0, handle: 0 }),
      mk({ kind: "base", run: 0, x: 3000, w: 600, h: 720, fill: "shelves", count: 1, door: 0, handle: 0 }),
    ];

    const res = adaptCabinetsToRoom(cabs, oldPoints, newPoints, 0, "i", [], 0);
    expect(res.cabs.length).toBeGreaterThan(0);

    // Verify all cabinets fit inside the new wall length (2500mm - wall offsets = 2300mm)
    for (const c of res.cabs) {
      if (c.run === 0 && c.px == null) {
        expect(c.x! + c.w).toBeLessThanOrEqual(2300);
        expect(c.w).toBeGreaterThanOrEqual(150);
      }
    }
  });

  it("re-seats corner units to the new corner position when wall moves", async () => {
    const oldOutline = roomOutlineMm("i");
    // Place a corner cabinet at an initial seat for layout "l"
    const { cornerUnits } = await import("../src/model/runPlan");
    const oldSeats = cornerUnits(oldOutline, null, "l", [], 840);
    expect(oldSeats.length).toBeGreaterThan(0);

    const cornerCab: Cabinet = mk({
      kind: "base",
      corner: true,
      px: oldSeats[0].px,
      pz: oldSeats[0].pz,
      rot: oldSeats[0].rot,
      w: 840,
      depth: 840,
      h: 720,
      fill: "shelves",
      count: 1,
      door: 0,
      handle: 0,
      run: 0,
    });

    // Resize the room outline (e.g. stretch from 4000 to 5000)
    const newOutline: Pt[] = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ];

    const res = adaptCabinetsToRoom([cornerCab], oldOutline, newOutline, null, "l", [], 0);
    expect(res.cabs.length).toBe(1);
    const updatedCorner = res.cabs[0];
    expect(updatedCorner.corner).toBe(true);

    const newSeats = cornerUnits(newOutline, null, "l", [], 840);
    // The corner cabinet must match one of the valid new seats
    const matchedSeat = newSeats.find((s) => Math.hypot(s.px - updatedCorner.px!, s.pz - updatedCorner.pz!) < 10);
    expect(matchedSeat).toBeDefined();
  });
});
