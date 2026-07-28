// The variant generator has to PROPOSE the kitchens the editor can now build.
//
// It used to emit exactly one 720mm row of wall units at 1520 and stop columns at 2100, on every
// variant — so however high the ceiling, every generated design left a bare strip of wall above the
// cabinets, and the four "structurally different" variants were all the same shape vertically. The
// "Максимум хранения" strategy even promised «шкафы до потолка» in its blurb and could not build
// them.

import { describe, it, expect } from "vitest";
import { generateVariants, type WallBand } from "../src/model/layout";
import { planRuns, DEFAULT_REVEAL } from "../src/model/runPlan";
import { resolveLayout, wallRows } from "../src/model/resolve";
import { cabBand } from "../src/model/bands";
import type { Pt } from "../src/model/room";

const POINTS: Pt[] = [
  { x: 0, y: 0 },
  { x: 4200, y: 0 },
  { x: 4200, y: 3200 },
  { x: 0, y: 3200 },
];

function variantsAt(ceiling: number, wall?: WallBand[]) {
  const { runs } = planRuns(POINTS, 0, "i", []);
  return generateVariants({
    layouts: [
      {
        layout: "i",
        runs: runs.map((r) => ({ kind: r.kind, len: r.len, cornerStart: r.cornerStart, cornerEnd: r.cornerEnd, openings: [] })),
        waterRun: 0,
      },
    ],
    ceiling,
    water: "left",
    hasGas: true,
    fridge: ["integ"],
    oven: ["tall"],
    hood: ["integ"],
    wall,
  });
}

const inspect = (cabs: ReturnType<typeof variantsAt>[number]["cabs"], ceiling: number) => {
  const L = resolveLayout(cabs, { points: POINTS, waterWall: 0, layout: "i", openings: [] });
  const rows = wallRows(L.elevation(0));
  const talls = cabs.filter((c) => c.kind === "tall");
  return {
    rows,
    clashing: L.clashing,
    tallTop: talls.length ? Math.max(...talls.map((c) => cabBand(c).y1)) : 0,
    wallTop: rows.length ? rows[rows.length - 1].y1 : 0,
    ceiling,
  };
};

describe("the generator proposes the kitchens the editor can build", () => {
  const CEILING = 2700;
  // a floor-to-ceiling run stops a «добор» short of the ceiling; a scribe strip closes the gap
  const TOP = CEILING - DEFAULT_REVEAL;
  const vs = variantsAt(CEILING);
  const byId = (id: string) => vs.find((v) => v.id.startsWith(id))!;

  it("gives «Максимум хранения» a real ANTRESOL — two stacked rows, up to the ceiling добор", () => {
    const r = inspect(byId("storage").cabs, CEILING);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ y0: 1520, y1: 2240 }); // the standard row
    expect(r.rows[1]).toMatchObject({ y0: 2240, y1: TOP }); // seated on top, up to the ceiling добор
    expect(r.rows[1].ids.length).toBeGreaterThan(0);
  });

  it("gives «Премиум» ONE unbroken band from the worktop line to the ceiling добор", () => {
    const r = inspect(byId("premium").cabs, CEILING);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ y0: 1520, y1: TOP }); // 1130 tall (1180 − добор), not 720
  });

  it("runs the columns floor-to-ceiling on both of those, and leaves only the добор gap", () => {
    for (const id of ["storage", "premium"]) {
      const r = inspect(byId(id).cabs, CEILING);
      expect(r.tallTop, id).toBe(TOP);
      expect(Math.max(r.wallTop, r.tallTop), id).toBe(TOP);
    }
  });

  it("keeps the cheap variants on a single standard row", () => {
    for (const id of ["standard", "ergonomic"]) {
      const r = inspect(byId(id).cabs, CEILING);
      expect(r.rows, id).toHaveLength(1);
      expect(r.rows[0].y1 - r.rows[0].y0, id).toBe(720);
    }
  });

  it("never generates a clash — a stacked antresol is a design, not an error", () => {
    for (const v of vs) expect(inspect(v.cabs, CEILING).clashing, v.name).toEqual(new Set());
  });
});

describe("the user can ASK for a wall shape", () => {
  // the generator could build all three since the antresol work, but which one you got was
  // hardcoded per strategy — there was no way to say "I want an antresol"
  const CEILING = 2700;
  const TOP = CEILING - DEFAULT_REVEAL; // floor-to-ceiling stops a добор short

  it("«Антресоль» gives EVERY variant a second wall row", () => {
    for (const v of variantsAt(CEILING, ["antresol"])) {
      const r = inspect(v.cabs, CEILING);
      expect(r.rows, v.name).toHaveLength(2);
      expect(r.tallTop, v.name).toBe(TOP); // and the columns follow it up to the ceiling добор
    }
  });

  it("«До потолка» gives every variant ONE unbroken band to the ceiling добор", () => {
    for (const v of variantsAt(CEILING, ["tall"])) {
      const r = inspect(v.cabs, CEILING);
      expect(r.rows, v.name).toHaveLength(1);
      expect(r.rows[0].y1, v.name).toBe(TOP);
    }
  });

  it("«Один ряд» keeps every variant on a standard row, columns included", () => {
    for (const v of variantsAt(CEILING, ["single"])) {
      const r = inspect(v.cabs, CEILING);
      expect(r.rows, v.name).toHaveLength(1);
      expect(r.rows[0].y1 - r.rows[0].y0, v.name).toBe(720);
      expect(r.tallTop, v.name).toBeLessThan(CEILING);
    }
  });

  it("picking nothing leaves the strategies varied — all three shapes across the four", () => {
    const shapes = variantsAt(CEILING).map((v) => inspect(v.cabs, CEILING));
    expect(shapes.some((r) => r.rows.length === 2)).toBe(true); // an antresol
    expect(shapes.some((r) => r.rows.length === 1 && r.rows[0].y1 === TOP)).toBe(true); // a tall band
    expect(shapes.some((r) => r.rows.length === 1 && r.rows[0].y1 - r.rows[0].y0 === 720)).toBe(true); // standard
  });

  it("still never generates a clash, whatever was asked for", () => {
    for (const w of [["single"], ["tall"], ["antresol"]] as WallBand[][]) {
      for (const v of variantsAt(CEILING, w)) expect(inspect(v.cabs, CEILING).clashing, v.name).toEqual(new Set());
    }
  });
});

describe("low ceilings degrade gracefully", () => {
  // 2400 ceiling: 1520 + 720 leaves only 160mm, which is not a cabinet. Falling back to ONE tall
  // row is right; emitting a 160mm sliver on top would be absurd.
  const CEILING = 2400;
  const TOP = CEILING - DEFAULT_REVEAL; // even degraded, it reaches up to the ceiling добор
  const vs = variantsAt(CEILING);

  it("drops the antresol when there is no room for a real one, and still reaches the ceiling добор", () => {
    const r = inspect(vs.find((v) => v.id.startsWith("storage"))!.cabs, CEILING);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ y0: 1520, y1: TOP });
    expect(r.tallTop).toBe(TOP);
  });

  it("still generates no clashes", () => {
    for (const v of vs) expect(inspect(v.cabs, CEILING).clashing, v.name).toEqual(new Set());
  });
});
