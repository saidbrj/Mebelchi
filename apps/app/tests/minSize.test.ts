// The gate that stops a drawer being drawn into a hole no drawer fits.
//
// The number under test is 80mm — LEGRABOX class N's space requirement, the smallest catalogued
// drawer anywhere in the corpus. Below it there is nothing to buy, which is why this blocks the
// export rather than merely warning.

import { describe, expect, it } from "vitest";
import { drawerFindings, minSizeFindings, DRAWER_MIN_INTERIOR_MM } from "../src/model/minSize";
import { setShopConstruction } from "../src/model/construction";
import type { Cabinet, Cell } from "../src/model/cabinet";

const cab = (p: Partial<Cabinet> = {}): Cabinet => ({
  id: "c1",
  kind: "base",
  w: 600,
  h: 720,
  fill: "shelves",
  count: 2,
  div: 0,
  door: 0,
  handle: 0,
  ...p,
});

/** a vertical stack of `n` equal compartments, each carrying the given front */
const stack = (fronts: (Cell["front"] | undefined)[]): Cell => ({
  split: "rows",
  sizes: fronts.map(() => 1 / fronts.length),
  children: fronts.map((front) => (front ? { front } : {})),
});

describe("drawers that cannot exist", () => {
  it("a normal 3-drawer base passes", () => {
    expect(drawerFindings(cab({ layout: stack(["drawer", "drawer", "drawer"]) }))).toEqual([]);
  });

  it("nine drawers in one 720mm base do not — 76mm of interior each is under the mechanism", () => {
    const found = drawerFindings(cab({ layout: stack(Array(9).fill("drawer")) }));
    expect(found).toHaveLength(9);
    expect(found[0].needMm).toBe(DRAWER_MIN_INTERIOR_MM);
    expect(found[0].haveMm).toBeLessThan(DRAWER_MIN_INTERIOR_MM);
  });

  it("catches the case the old fraction floor allowed: 12% of a 400mm upper", () => {
    // MIN_CELL = 0.12 of the interior — legal to draw, impossible to build
    const layout: Cell = { split: "rows", sizes: [0.12, 0.88], children: [{ front: "drawer" }, {}] };
    const found = drawerFindings(cab({ kind: "upper", h: 400, layout }));
    expect(found).toHaveLength(1);
    expect(found[0].haveMm).toBeLessThan(50);
  });

  it("reports the compartment's rect so the editor can point at it", () => {
    const layout: Cell = { split: "rows", sizes: [0.1, 0.9], children: [{ front: "drawer" }, {}] };
    const [f] = drawerFindings(cab({ layout }));
    expect(f.fy0).toBeCloseTo(0, 6);
    expect(f.fy1).toBeCloseTo(0.1, 6);
    expect(f.fx0).toBe(0);
    expect(f.fx1).toBe(1);
  });

  it("only drawers are gated — an open cubby or a door of any size is legal", () => {
    expect(drawerFindings(cab({ layout: stack([undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]) }))).toEqual([]);
    expect(drawerFindings(cab({ layout: stack(Array(9).fill("door")) }))).toEqual([]);
  });

  it("an appliance housing is not checked — it holds a machine, not a drawer", () => {
    expect(drawerFindings(cab({ appliance: "oven", layout: stack(Array(9).fill("drawer")) }))).toEqual([]);
  });
});

describe("the opening, not the front", () => {
  it("two stacked drawers have no panel between them, so their openings meet", () => {
    // 720 cabinet, 16mm shop: interior 688, two drawers → 344 each, no panel deduction
    setShopConstruction({ boardThickness: 16 });
    const found = drawerFindings(cab({ layout: stack(["drawer", "drawer"]) }));
    setShopConstruction(undefined);
    expect(found).toEqual([]);
  });

  it("a shelf above a drawer eats into that drawer's opening", () => {
    setShopConstruction({ boardThickness: 16 });
    // interior 688; the drawer gets 12% = 82.6mm, minus half a panel above → under 80
    const layout: Cell = { split: "rows", sizes: [0.12, 0.88], children: [{ front: "drawer" }, {}] };
    const found = drawerFindings(cab({ h: 720, layout }));
    setShopConstruction(undefined);
    expect(found).toHaveLength(1);
    expect(found[0].haveMm).toBe(75);
  });

  it("a thicker shop board leaves less interior, so the same design gets tighter", () => {
    const layout: Cell = { split: "rows", sizes: [0.125, 0.875], children: [{ front: "drawer" }, {}] };
    setShopConstruction({ boardThickness: 16 });
    const at16 = drawerFindings(cab({ layout }))[0]?.haveMm ?? Infinity;
    setShopConstruction({ boardThickness: 18 });
    const at18 = drawerFindings(cab({ layout }))[0]?.haveMm ?? Infinity;
    setShopConstruction(undefined);
    expect(at18).toBeLessThan(at16);
  });
});

describe("columns", () => {
  it("a drawer stack in one column of a split cabinet is measured on the full height", () => {
    const layout: Cell = {
      split: "cols",
      sizes: [0.5, 0.5],
      children: [stack(["drawer", "drawer", "drawer"]), {}],
    };
    expect(drawerFindings(cab({ layout }))).toEqual([]);
  });

  it("and its own rect is reported, not the whole face", () => {
    const layout: Cell = {
      split: "cols",
      sizes: [0.5, 0.5],
      children: [stack(Array(9).fill("drawer")), {}],
    };
    const found = drawerFindings(cab({ layout }));
    expect(found).toHaveLength(9);
    expect(found[0].fx0).toBe(0);
    expect(found[0].fx1).toBeCloseTo(0.5, 6);
  });
});

describe("the run-level gate", () => {
  it("gathers findings across every module, tagged by cabinet", () => {
    const bad = cab({ id: "bad", layout: stack(Array(9).fill("drawer")) });
    const good = cab({ id: "good", layout: stack(["drawer", "drawer"]) });
    const all = minSizeFindings([good, bad]);
    expect(all).toHaveLength(9);
    expect(new Set(all.map((f) => f.cabId))).toEqual(new Set(["bad"]));
  });

  it("an empty run is clean", () => {
    expect(minSizeFindings([])).toEqual([]);
  });
});
