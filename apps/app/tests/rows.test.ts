// The vertical model: stacked wall rows, floor-to-ceiling columns, and a clash test that
// understands height.
//
// These three used to be one boolean (`Foot.upper`) and one hardcoded pair of rows, which meant the
// app could not express a kitchen with an antresol OR a full-height column — and actively fought
// anyone who tried, by painting a legitimately stacked cabinet red. Pinned here because it is all
// pure geometry, and a regression would be silent everywhere except a customer's kitchen.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { cabBand, maxCabH, spansOverlap } from "../src/model/bands";
import { GEOM } from "../src/model/layout";
import { footsClash, cabFootprints, type Foot } from "../src/model/footprint";
import { wallRows } from "../src/model/resolve";
import { editRows } from "../src/model/rowOps";
import type { Pt } from "../src/model/room";

const CEILING = 2700;

/** a 4×3m rectangular room */
const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];

/** the ResolvedCab shape wallRows() actually reads */
const cell = (c: Cabinet) => ({ id: c.id, cab: c, band: cabBand(c) });

const upper = (o: Partial<Cabinet>) => mk({ kind: "upper", w: 600, h: 720, ...o });

describe("wallRows — rows are derived from the bands, not stored", () => {
  it("puts one wall unit in one row", () => {
    const rows = wallRows([cell(upper({ mountY: 1520 }))].map((c) => c as never));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ y0: 1520, y1: 2240 });
  });

  it("groups wall units hanging at the same height into ONE row", () => {
    const a = upper({ mountY: 1520 });
    const b = upper({ mountY: 1520 });
    const rows = wallRows([cell(a), cell(b)].map((c) => c as never));
    expect(rows).toHaveLength(1);
    expect(rows[0].ids).toEqual([a.id, b.id]);
  });

  it("makes a STACKED antresol its own row, ordered bottom → top", () => {
    // this is the whole feature: 720-high uppers at 1520, a 460 antresol seated on top at 2240
    const main = upper({ mountY: 1520, h: 720 });
    const antresol = upper({ mountY: 2240, h: 460 });
    const rows = wallRows([cell(antresol), cell(main)].map((c) => c as never)); // deliberately out of order
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ y0: 1520, y1: 2240, ids: [main.id] });
    expect(rows[1]).toMatchObject({ y0: 2240, y1: 2700, ids: [antresol.id] });
  });

  it("excludes the hood — it hangs at its own height over the hob, in no row", () => {
    const hood = upper({ mountY: 1520, appliance: "hood" });
    expect(wallRows([cell(hood)].map((c) => c as never))).toHaveLength(0);
  });
});

describe("footsClash — the clash test knows about height", () => {
  const footsOf = (cabs: Cabinet[]): Foot[] => cabFootprints(cabs, ROOM, null, "i", []);

  it("does NOT flag an antresol stacked on the wall units", () => {
    // the same x, the same wall — but one sits ON the other. The old `a.upper !== b.upper` layer
    // test called this a clash, so the app told you your antresol was an error.
    const [a, b] = footsOf([
      upper({ mountY: 1520, h: 720, run: 0, x: 0 }),
      upper({ mountY: 2240, h: 460, run: 0, x: 0 }),
    ]);
    expect(footsClash(a, b)).toBe(false);
  });

  it("still flags two wall units fighting over the same band", () => {
    const [a, b] = footsOf([
      upper({ mountY: 1520, h: 720, run: 0, x: 0 }),
      upper({ mountY: 1520, h: 720, run: 0, x: 0 }),
    ]);
    expect(footsClash(a, b)).toBe(true);
  });

  it("does NOT flag a wall unit over a base", () => {
    const [a, b] = footsOf([
      mk({ kind: "base", w: 600, h: 720, run: 0, x: 0 }),
      upper({ mountY: 1520, run: 0, x: 0 }),
    ]);
    expect(footsClash(a, b)).toBe(false);
  });

  it("DOES flag a column driven through a wall unit — the old boolean let this through", () => {
    // a tall spans 0 → plinth+h, so it occupies the wall band too. `upper !== upper` skipped the
    // pair entirely, so this genuine 3D intersection was never reported.
    const [a, b] = footsOf([
      mk({ kind: "tall", w: 600, h: 2400, run: 0, x: 0 }), // band 0 → 2500
      upper({ mountY: 1520, h: 720, run: 0, x: 0 }), // band 1520 → 2240
    ]);
    expect(spansOverlap(a, b)).toBe(true);
    expect(footsClash(a, b)).toBe(true);
  });

  it("exempts free-standing furniture (a chair under a table is not a clash)", () => {
    const [a, b] = footsOf([
      mk({ kind: "base", furniture: "table", w: 1200, h: 740, px: 2000, pz: 1500 }),
      mk({ kind: "base", furniture: "chair", w: 460, h: 900, px: 2000, pz: 1500 }),
    ]);
    expect(footsClash(a, b)).toBe(false);
  });
});

describe("maxCabH — the ceiling is the limit, not a constant", () => {
  it("lets a column reach the ceiling", () => {
    // the old flat 2400 clamp + the plinth topped a column out at 2500 — permanently 200mm
    // short of a 2700 ceiling, which is why nothing in the app could be floor-to-ceiling.
    // Derived from GEOM.plinth, not hardcoded: the plinth is a census-backed value that has
    // already been corrected once (100 → 120), and this test should follow it, not pin it.
    const tall = mk({ kind: "tall", h: 2100 });
    expect(maxCabH(tall, 2700)).toBe(2700 - GEOM.plinth);
    expect(cabBand({ ...tall, h: maxCabH(tall, 2700) }).y1).toBe(2700); // exactly flush
  });

  it("grows an upper up from where it hangs", () => {
    expect(maxCabH(upper({ mountY: 1520 }), 2700)).toBe(1180);
    expect(maxCabH(upper({ mountY: 2240 }), 2700)).toBe(460);
  });

  it("keeps a base on the counter-height range", () => {
    expect(maxCabH(mk({ kind: "base", h: 720 }), 3300)).toBe(1000);
  });
});

describe("editRows — nothing may pass through the ceiling", () => {
  it("re-hangs a row", () => {
    const a = upper({ mountY: 1520 });
    const out = editRows([a], [{ id: a.id, mountY: 1600 }], CEILING)!;
    expect(out[0].mountY).toBe(1600);
  });

  it("clamps the mount so the unit's TOP stays under the ceiling", () => {
    // the old clamp was `mountY ≤ ceiling − 200` and ignored the unit's own height, so a 720-high
    // upper could be hung at 2500 and poke 520mm out through a 2700 ceiling
    const a = upper({ mountY: 1520, h: 720 });
    const out = editRows([a], [{ id: a.id, mountY: 2500 }], CEILING)!;
    expect(out[0].mountY).toBe(2700 - 720);
    expect(cabBand(out[0]).y1).toBe(2700);
  });

  it("clamps a row height to the ceiling", () => {
    const a = upper({ mountY: 2240, h: 460 });
    const out = editRows([a], [{ id: a.id, h: 2000 }], CEILING)!;
    expect(cabBand(out[0]).y1).toBeLessThanOrEqual(2700);
  });

  it("returns null when nothing moved, so the store can skip the set()", () => {
    const a = upper({ mountY: 1520 });
    expect(editRows([a], [{ id: a.id, mountY: 1520 }], CEILING)).toBeNull();
  });

  it("ignores non-wall modules", () => {
    const t = mk({ kind: "tall", h: 2100 });
    expect(editRows([t], [{ id: t.id, mountY: 900 }], CEILING)).toBeNull();
  });
});
