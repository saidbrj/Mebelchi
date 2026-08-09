// УСИЛЕНИЕ is decided by a beam formula, not by one workshop number. These tests pin the two
// things that number could never express: a shelf's limit moves with its DEPTH and with its
// THICKNESS, and it moves in the direction physics says.

import { describe, expect, it } from "vitest";
import {
  maxShelfSpan,
  reinforceSpanFor,
  midSupportSpanFor,
  reinforcementFor,
  reinforcementReport,
  shelfSpan,
  hardeningPresets,
  DEFAULT_LOAD_KG_PER_M,
} from "../src/model/reinforce";
import { setShopConstruction } from "../src/model/construction";
import type { Cabinet } from "../src/model/cabinet";

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

describe("maxShelfSpan — the beam formula", () => {
  it("matches the cited worked case: 16mm × 500mm deep at 20 kg/m sags past L/240 at ~667mm", () => {
    expect(Math.round(maxShelfSpan(16, 500, 20))).toBe(667);
  });

  it("a doubled shelf is 8× stiffer, so it spans exactly twice as far", () => {
    expect(maxShelfSpan(32, 500) / maxShelfSpan(16, 500)).toBeCloseTo(2, 6);
  });

  it("a deeper shelf carries further — stiffness is linear in depth", () => {
    expect(maxShelfSpan(16, 560)).toBeGreaterThan(maxShelfSpan(16, 300));
  });

  it("a heavier load shortens the allowed span", () => {
    expect(maxShelfSpan(16, 500, 25)).toBeLessThan(maxShelfSpan(16, 500, 15));
  });

  it("the shallow upper is where the old flat 800mm was most wrong", () => {
    // a 300mm-deep upper shelf: the old constant let it run to 800mm, physics says ~620
    expect(maxShelfSpan(16, 300)).toBeLessThan(700);
  });
});

describe("thresholds follow the shop standard, not a literal", () => {
  it("an 18mm shop may span further than a 16mm one", () => {
    const c = cab({ depth: 560 });
    setShopConstruction({ boardThickness: 16 });
    const at16 = reinforceSpanFor(c);
    setShopConstruction({ boardThickness: 18 });
    const at18 = reinforceSpanFor(c);
    setShopConstruction(undefined);
    expect(at18).toBeGreaterThan(at16);
  });

  it("the mid-support line is the doubled-shelf limit — twice the plain one", () => {
    const c = cab({ depth: 560 });
    expect(midSupportSpanFor(c) / reinforceSpanFor(c)).toBeCloseTo(2, 6);
  });

  it("shelfSpan uses the shop's thickness and subtracts the dividers between bays", () => {
    setShopConstruction({ boardThickness: 16 });
    expect(shelfSpan(cab({ w: 900 }))).toBe((900 - 32) / 1);
    // one divider → two bays, and the divider itself eats a board thickness
    expect(shelfSpan(cab({ w: 900, div: 1 }))).toBe((900 - 32 - 16) / 2);
    setShopConstruction(undefined);
  });
});

describe("what a cabinet actually needs", () => {
  it("a 600mm base needs nothing", () => {
    expect(reinforcementFor(cab({ w: 600, depth: 560 }))).toBeNull();
  });

  it("a 900mm base does — and reports the limit it broke", () => {
    const r = reinforcementFor(cab({ w: 900, depth: 560 }));
    expect(r).not.toBeNull();
    expect(r!.shelves).toBe(2); // 2 levels × 1 bay
    expect(r!.midSupports).toBe(0); // nowhere near the doubled-shelf limit
    expect(r!.span).toBeGreaterThan(r!.limit);
  });

  it("a divider halves the span and removes the need entirely", () => {
    expect(reinforcementFor(cab({ w: 900, depth: 560, div: 1 }))).toBeNull();
  });

  it("a shallow upper is caught at a width a base cabinet would pass", () => {
    // 700mm wide: fine at 560mm deep, too wide at 300mm deep
    expect(reinforcementFor(cab({ w: 700, depth: 560 }))).toBeNull();
    expect(reinforcementFor(cab({ kind: "upper", w: 700, h: 700, depth: 300 }))).not.toBeNull();
  });

  it("an appliance housing has no shelves to sag", () => {
    expect(reinforcementFor(cab({ w: 1200, depth: 560, appliance: "oven" }))).toBeNull();
  });

  it("hardening presets are one per piece, so the count is the cost", () => {
    expect(hardeningPresets(cab({ w: 900, depth: 560, count: 3 }))).toEqual([
      "standard-shelf",
      "standard-shelf",
      "standard-shelf",
    ]);
    expect(hardeningPresets(cab({ w: 600, depth: 560 }))).toBeUndefined();
  });
});

describe("the project read-out", () => {
  it("quotes this project's own tightest limit, not a global constant", () => {
    const rep = reinforcementReport([cab({ w: 600, depth: 560 }), cab({ id: "c2", kind: "upper", w: 600, h: 700, depth: 300 })]);
    expect(rep.shelves).toBe(0);
    // the shallow upper is the binding one
    expect(rep.limit).toBe(Math.round(maxShelfSpan(16, 300, DEFAULT_LOAD_KG_PER_M)));
  });

  it("counts pieces across the run and remembers the widest offender", () => {
    const rep = reinforcementReport([cab({ w: 900, depth: 560 }), cab({ id: "c2", w: 1000, depth: 560 })]);
    expect(rep.cabs).toBe(2);
    expect(rep.shelves).toBe(4);
    expect(rep.widest).toBe(1000 - 32);
  });
});
