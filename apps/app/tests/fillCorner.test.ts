import { describe, it, expect } from "vitest";
import { mk } from "../src/model/cabinet";
import { fillGapSpan } from "../src/model/fill";
import { seatCorner } from "../src/model/rowOps";
import type { Room } from "../src/model/resolve";
import type { Pt } from "../src/model/room";

const RECT: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room: Room = { points: RECT, waterWall: null, layout: "l", openings: [] };

describe("fillGapSpan with corner cabinets", () => {
  it("stops at corner cabinet boundary without overlapping", () => {
    // Upper corner unit seated at cornerStart
    const unseated = mk({ kind: "upper", corner: true, armDepth: 350 });
    const cornerCab = seatCorner(unseated, RECT, null, "l", []);
    // Next upper cabinet on run 0 at run-local x = 0 (wall space 840)
    const upperCab = mk({ id: "cab1", kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x: 0 });

    const cabs = [cornerCab, upperCab];
    const span = fillGapSpan(cabs, upperCab, room, 0);

    expect(span).not.toBeNull();
    if (span) {
      // Corner cabinet end in wall space is 790mm. Grid offset is 840mm.
      // Fill span x is 790 - 840 = -50mm, stopping precisely at corner cabinet without overlapping.
      expect(span.x).toBe(-50);
      expect(span.w).toBe(3187);
    }
  });
});
