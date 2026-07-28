// FILLER RESERVE («добор») — a run end that butts a perpendicular wall reserves a small dead zone so
// a door can open off the wall and an out-of-true wall can be scribed. It is reserved the same way a
// corner zone is (shrinks run.len, pushes placement.startS) and is mutually exclusive with a corner:
// a corner end takes 0, an exposed (reflex) end takes 0, every other end takes the reveal.

import { describe, it, expect } from "vitest";
import { planRuns, reflexVertices, DEFAULT_REVEAL } from "../src/model/runPlan";
import type { Pt } from "../src/model/room";

const RECT: Pt[] = [ { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 } ];
// 4×4m room with the top-right 2×2m bitten out — vertex 3 (2000,2000) is the exposed inner elbow
const L_ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 2000 },
  { x: 2000, y: 2000 },
  { x: 2000, y: 4000 },
  { x: 0, y: 4000 },
];

describe("filler reveal reservation", () => {
  it("reserves the reveal at both ends of a wall-to-wall 'i' run", () => {
    const run = planRuns(RECT, null, "i", [], [], DEFAULT_REVEAL).runs.find((r) => r.kind === "wall")!;
    expect(run.revealStart).toBe(DEFAULT_REVEAL);
    expect(run.revealEnd).toBe(DEFAULT_REVEAL);
    // the module start is pushed in by the reveal (metres)
    expect(run.placement.startS).toBeCloseTo(DEFAULT_REVEAL / 1000, 6);
  });

  it("reveal=0 places cabinets wall-to-wall (no reserve, full run length)", () => {
    const bare = planRuns(RECT, null, "i", [], [], 0).runs.find((r) => r.kind === "wall")!;
    const withReveal = planRuns(RECT, null, "i", [], [], DEFAULT_REVEAL).runs.find((r) => r.kind === "wall")!;
    expect(bare.revealStart).toBe(0);
    expect(bare.revealEnd).toBe(0);
    expect(bare.placement.startS).toBe(0);
    // the reveal is taken out of the usable run: two ends × DEFAULT_REVEAL
    expect(withReveal.len).toBe(bare.len - 2 * DEFAULT_REVEAL);
  });

  it("an L-run takes no reveal at the elbow (corner zone) but does at the open end", () => {
    const runs = planRuns(L_ROOM, null, "l", [], [], DEFAULT_REVEAL).runs.filter((r) => r.kind === "wall");
    for (const r of runs) {
      // exactly one end of each L arm is the elbow corner; that end carries the 840 zone, not a reveal
      if (r.cornerEnd) expect(r.revealEnd).toBe(0);
      if (r.cornerStart) expect(r.revealStart).toBe(0);
      // the OTHER (open) end butts the room's outer wall → it reserves the reveal
      if (!r.cornerEnd) expect(r.revealEnd).toBe(DEFAULT_REVEAL);
      if (!r.cornerStart) expect(r.revealStart).toBe(DEFAULT_REVEAL);
    }
  });

  it("only the exposed inner elbow is a reflex vertex", () => {
    const reflex = reflexVertices(L_ROOM);
    expect([...reflex]).toEqual([3]);
    expect(reflexVertices(RECT).size).toBe(0);
  });
});
