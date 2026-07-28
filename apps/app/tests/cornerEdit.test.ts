// Turning the LAST wall unit into a corner used to break the layout: seating the corner makes the
// neighbouring wall reserve an 840mm start zone, and the old reanchor CLAMPED every cabinet that fell
// inside that zone to the same floor x — piling two or three of them into one slot (red clash) and
// leaving the phantom "extra" cabinets the user reported. reanchorAfterCorner now DROPS the module the
// corner replaces and TRIMS only the one straddling the zone edge, so nothing overlaps.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { reanchorAfterCorner } from "../src/model/cornerEdit";
import { seatCorner } from "../src/model/rowOps";
import { planRuns, cornerUnits } from "../src/model/runPlan";
import { cabFootprints, objectOverlapIds } from "../src/model/footprint";
import type { Pt } from "../src/model/room";

// a plain rectangle in the "all" shape → a run on every wall, corner zones that appear only when a
// corner cabinet actually turns the vertex (dynamic corners — exactly the constructor's setup)
const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

/** Seat an upper corner at the first inside corner (exactly as replaceCab does — seatCorner sizes it
 *  to its 613 square and places it at the matching seat), and report which run reserves a START zone. */
function cornerScenario() {
  const seat = cornerUnits(ROOM, null, "all", [])[0]; // a corner-square location to seed near
  const corner = seatCorner(
    mk({ kind: "upper", corner: true, armDepth: 350, h: 720, mountY: 1520, px: seat.px, pz: seat.pz, rot: seat.rot }),
    ROOM, null, "all", [],
  );
  const runs = planRuns(ROOM, null, "all", [], [corner]).runs;
  const affected = runs.findIndex((r) => r.kind === "wall" && r.cornerStart);
  return { corner, affected };
}

const noOverlap = (cabs: Cabinet[]) => {
  const overlaps = objectOverlapIds(cabFootprints(cabs, ROOM, null, "all", []));
  return [...overlaps];
};

describe("reanchorAfterCorner — a new corner never stacks its neighbours", () => {
  it("the vertex really does reserve a start zone (scenario is valid)", () => {
    expect(cornerScenario().affected).toBeGreaterThanOrEqual(0);
  });

  it("does not pile the swallowed cabinets onto one slot (the red-clash bug)", () => {
    const { corner, affected } = cornerScenario();
    // a full wall of uppers — an 840 zone swallows more than one of them, which is what broke the clamp
    const uppers = [0, 600, 1200, 1800].map((x) =>
      mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: affected, x }),
    );
    const prev = uppers;
    const next = [...uppers, corner];

    const out = reanchorAfterCorner(prev, next, ROOM, null, "all", []);

    // nothing overlaps anything — not the corner, not each other
    expect(noOverlap(out)).toEqual([]);

    // and the surviving wall units on the affected run are a clean left→right tiling (no two share x)
    const survivors = out
      .filter((c) => !c.corner && (c.run ?? 0) === affected)
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    for (let i = 1; i < survivors.length; i++) {
      expect((survivors[i].x ?? 0)).toBeGreaterThanOrEqual((survivors[i - 1].x ?? 0) + (survivors[i - 1].w ?? 0) - 1);
    }
    // the corner reclaimed real wall, so at least one wall unit was dropped or trimmed
    expect(survivors.length).toBeLessThanOrEqual(uppers.length);
  });

  it("leaves a wall whose start zone did NOT change untouched", () => {
    const { corner, affected } = cornerScenario();
    // put uppers on a DIFFERENT wall — reanchor must not move them
    const other = affected === 0 ? 1 : 0;
    const uppers = [0, 600].map((x) => mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: other, x }));
    const out = reanchorAfterCorner(uppers, [...uppers, corner], ROOM, null, "all", []);
    const kept = out.filter((c) => !c.corner);
    // same ids, same x — nothing on the untouched wall moved
    expect(kept.map((c) => [c.id, c.x])).toEqual(uppers.map((c) => [c.id, c.x]));
  });

  it("returns the input array reference-equal when no wall's start zone moved", () => {
    // no corner in `next` → no cornerStart flips → nothing to reanchor
    const uppers = [mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x: 0 })];
    expect(reanchorAfterCorner(uppers, uppers, ROOM, null, "all", [])).toBe(uppers);
  });
});
