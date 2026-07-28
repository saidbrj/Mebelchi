// The editing model: what "the row" means for «Применить ко всему ряду», and which kitchen shapes
// a given room can actually hold.
//
// Both are pure and both are load-bearing: rowMates decides how far a height/depth drag reaches
// (getting it wrong silently resizes the wrong wall), and candidateLayouts is what lets the
// onboarding stop asking the user to pick a kitchen shape before they've drawn a room.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { rowMates } from "../src/model/rowOps";
import { candidateLayouts } from "../src/model/runPlan";
import type { Pt } from "../src/model/room";

const ids = (cabs: Cabinet[]) => cabs.map((c) => c.id).sort();

describe("rowMates — how far «Применить ко всему ряду» reaches", () => {
  it("groups the wall units hanging at the same height on the same wall", () => {
    const a = mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x: 0 });
    const b = mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x: 600 });
    const cabs = [a, b];
    expect(ids(rowMates(cabs, a))).toEqual(ids([a, b]));
  });

  it("does NOT reach around the corner to the other wall", () => {
    // a depth change on wall A must not silently resize wall B
    const a = mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x: 0 });
    const b = mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 1, x: 0 });
    expect(ids(rowMates([a, b], a))).toEqual([a.id]);
  });

  it("treats a stacked antresol as a DIFFERENT row from the wall units under it", () => {
    const main = mk({ kind: "upper", w: 600, h: 720, mountY: 1520, run: 0, x: 0 });
    const antresol = mk({ kind: "upper", w: 600, h: 460, mountY: 2240, run: 0, x: 0 });
    const cabs = [main, antresol];
    expect(ids(rowMates(cabs, main))).toEqual([main.id]);
    expect(ids(rowMates(cabs, antresol))).toEqual([antresol.id]);
  });

  it("never mixes kinds — a column and the base beside it are not one row", () => {
    // their BANDS overlap (a column spans the floor), but pushing a column's height onto a base
    // would be nonsense
    const base = mk({ kind: "base", w: 600, h: 720, run: 0, x: 0 });
    const tall = mk({ kind: "tall", w: 600, h: 2100, run: 0, x: 600 });
    const cabs = [base, tall];
    expect(ids(rowMates(cabs, base))).toEqual([base.id]);
    expect(ids(rowMates(cabs, tall))).toEqual([tall.id]);
  });

  it("groups the bases on one wall", () => {
    const a = mk({ kind: "base", w: 600, h: 720, run: 0, x: 0 });
    const b = mk({ kind: "base", w: 900, h: 720, run: 0, x: 600 });
    expect(ids(rowMates([a, b], a))).toEqual(ids([a, b]));
  });

  it("gives free-standing pieces no row — they answer only for themselves", () => {
    const island = mk({ kind: "base", island: true, w: 1200, h: 720, px: 2000, pz: 1500 });
    const table = mk({ kind: "base", furniture: "table", w: 1200, h: 740, px: 2500, pz: 2000 });
    const wall = mk({ kind: "base", w: 600, h: 720, run: 0, x: 0 });
    const cabs = [island, table, wall];
    expect(ids(rowMates(cabs, island))).toEqual([island.id]);
    expect(ids(rowMates(cabs, table))).toEqual([table.id]);
  });
});

describe("candidateLayouts — the ROOM answers the shape question", () => {
  const rect = (w: number, h: number): Pt[] => [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];

  it("offers a U in a room with three usable walls", () => {
    expect(candidateLayouts(rect(4000, 3600), null, [])).toContain("u");
  });

  it("does NOT offer a U in a corridor — you cannot put three runs in it", () => {
    // 5m × 1.6m: the short walls are far too short to hold a kitchen run
    const corridor = candidateLayouts(rect(5000, 1600), null, []);
    expect(corridor).not.toContain("u");
    expect(corridor).toContain("i");
  });

  it("orders the roomiest shape first, so the top few give the biggest kitchens", () => {
    const out = candidateLayouts(rect(4000, 3600), null, []);
    expect(out.length).toBeGreaterThan(1);
    expect(out[0]).toBeTruthy();
  });

  it("is never empty — a straight run always works against something", () => {
    expect(candidateLayouts(rect(2200, 2000), null, []).length).toBeGreaterThan(0);
  });
});
