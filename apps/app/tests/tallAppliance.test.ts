import { describe, it, expect } from "vitest";
import { mk } from "../src/model/cabinet";
import { buildSheet, ensureSheet } from "../src/model/sheet";
import { setColWidth, colIndexIn } from "../src/model/grid";
import type { Room } from "../src/model/resolve";
import type { Pt } from "../src/model/room";

const ROOM: Pt[] = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room: Room = { points: ROOM, waterWall: null, layout: "i", openings: [] };

describe("tall cabinet width & oven appliance positioning", () => {
  it("allows resizing the width of a tall cabinet column", () => {
    const tall = mk({ kind: "tall", w: 600, h: 2200, appliance: "oven", run: 0, x: 0 });
    const built = buildSheet([tall], room, 2700, 0);
    expect(built.cabs[0].w).toBe(600);

    const floorRow = built.grid.rows[0];
    const colIdx = colIndexIn(floorRow, built.cabs[0].cell!.c);
    expect(colIdx).toBeGreaterThanOrEqual(0);

    const nextGrid = setColWidth(built.grid, 0, colIdx, 800);
    expect(nextGrid).not.toBeNull();
    if (nextGrid) {
      const res = ensureSheet({ 0: nextGrid }, built.cabs, room, 2700, 0);
      expect(res).not.toBeNull();
      const updatedTall = res!.cabs.find((c) => c.kind === "tall");
      expect(updatedTall?.w).toBe(800);
    }
  });

  it("stores applianceH and applianceY parametric properties on tall oven cabinets", () => {
    const tall = mk({ kind: "tall", w: 600, h: 2200, appliance: "oven", applianceH: 450, applianceY: 1000 });
    expect(tall.applianceH).toBe(450);
    expect(tall.applianceY).toBe(1000);
  });
});
