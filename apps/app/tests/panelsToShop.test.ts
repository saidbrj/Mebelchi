// THE PANELS REACH THE SHOP.
//
// The фартук and the strip to the ceiling were drawn and priced from the day they were built, and
// for a while that was all: the cut list, the nest and the machine file knew nothing about them. So
// you could sell a kitchen whose QUOTE included a 2.4m stone splashback and hand the factory a
// package that never mentioned it — the one failure mode that costs real money rather than looking
// wrong on a screen.
//
// `production()` is the single seam (model/cncExport.ts): the CNC parts list, the sheet nest and
// the DXF all read it, so everything here is about what comes out of that one call.

import { describe, it, expect } from "vitest";
import { mk, type Cabinet } from "../src/model/cabinet";
import { production } from "../src/model/cncExport";
import { partsList } from "../src/model/partsList";
import { nestPanels } from "../src/model/nest";
import type { FlatPanel } from "@mebelchi/schema";

const run: Cabinet[] = [
  mk({ kind: "base", x: 0, w: 800, h: 720, run: 0 }),
  mk({ kind: "upper", x: 0, w: 800, h: 720, mountY: 1520, run: 0 }),
];

const splash = (over: Partial<FlatPanel> = {}): FlatPanel => ({
  id: "p1",
  kind: "splash",
  w: 2400,
  h: 640,
  t: 6,
  stock: "worktop",
  ...over,
});

const rowsFor = (panels: FlatPanel[] = []) => production(run, undefined, panels)!.panels;
const added = (panels: FlatPanel[]) => {
  const before = rowsFor().length;
  return rowsFor(panels).slice(before);
};

describe("the cut list carries them", () => {
  it("adds a row per panel, at its finished size", () => {
    const rows = added([splash()]);
    expect(rows).toHaveLength(1);
    expect(rows[0].lengthMm).toBe(2400);
    expect(rows[0].widthMm).toBe(640);
    expect(rows[0].thicknessMm).toBe(6);
  });

  it("names it, and says which wall it goes on", () => {
    // MODULE = where it goes, PART = what it is — the split every cabinet row already uses, so the
    // cut map has something to label the board with
    expect(added([splash({ wall: 2 })])[0].module).toBe("Стена 2");
    expect(added([splash()])[0].part).toBe("Фартук");
    expect(added([splash({ kind: "closer" })])[0].part).toBe("Панель до потолка");
  });

  it("cuts it from the stock its decor names", () => {
    // «как столешница» really is the counter slab; a sheet decor is board
    expect(added([splash({ stock: "worktop" })])[0].material).toMatch(/Столешница|постформинг/i);
    expect(added([splash({ stock: "carcass" })])[0].material).toMatch(/ЛДСП/i);
  });

  it("never labels a 6mm panel with the SLAB's thickness", () => {
    // «Столешница постформинг 38мм» beside a 6мм thickness column is a contradiction the shop has
    // to guess its way out of — the material column names the material, nothing more
    for (const stock of ["worktop", "carcass", "facade"] as const) {
      const row = added([splash({ stock })])[0];
      expect(row.material).not.toMatch(/\d+\s*мм/i);
      expect(row.thicknessMm).toBe(6);
    }
  });

  it("names the DECOR the designer picked, not the rate table's generic stock", () => {
    // the stock's own name carries the SLAB's thickness («…38мм»), which contradicts a 6mm panel
    // and is not what anyone orders
    expect(added([splash({ decor: "Мрамор белый" })])[0].material).toBe("Мрамор белый");
  });

  it("counts its area into the board total", () => {
    const bare = production(run)!;
    const withPanel = production(run, undefined, [splash()])!;
    // boardM2 is reported to the nearest cm², so compare at that resolution
    expect(withPanel.boardM2 - bare.boardM2).toBeCloseTo((2400 * 640) / 1e6, 1);
  });

  it("does not touch a run that has none", () => {
    const bare = production(run)!;
    const empty = production(run, undefined, [])!;
    expect(empty.panels.length).toBe(bare.panels.length);
    expect(empty.boardM2).toBeCloseTo(bare.boardM2, 6);
  });
});

describe("the cut-outs travel with it", () => {
  it("says how many AND where — «2 cut-outs» is not enough to cut one", () => {
    const rows = added([
      splash({ cutouts: [{ x: 400, y: 200, w: 90, h: 120, label: "Розетка" }, { x: 900, y: 200, w: 300, h: 120 }] }),
    ]);
    expect(rows[0].profile).toContain("Вырезы: 2");
    expect(rows[0].profile).toContain("90×120@400,200");
    expect(rows[0].profile).toContain("300×120@900,200");
  });

  it("leaves the machining note blank when the panel is solid", () => {
    expect(added([splash()])[0].profile).toBe("—");
  });
});

describe("the parts list and the nest see them too", () => {
  it("puts the panel on the CNC parts list", () => {
    const pl = partsList(production(run, undefined, [splash()])!, true);
    const line = pl.lines.find((l) => l.part === "Фартук");
    expect(line).toBeTruthy();
    expect(line!.lengthMm).toBe(2400);
    expect(line!.widthMm).toBe(640);
  });

  it("hands the panel to the nester, so a board is actually bought for it", () => {
    const bare = nestPanels(run, true).length;
    const withPanel = nestPanels(run, true, [splash()]);
    expect(withPanel.length).toBe(bare + 1);
    expect(withPanel.some((p) => p.w === 2400 && p.h === 640)).toBe(true);
  });
});

// ── A NOTCHED BACK ─────────────────────────────────────────────────────────────────────────────
// The other half of "the panels reach the shop": a box built around a riser is not a box with a
// solid back, and the cut list has to say so before the panel is cut rather than after.

describe("a back cut around a riser", () => {
  const cuts = new Map([[run[0].id, [{ x: 300, y: 0, w: 130, h: 720, label: "Стояк" }]]]);

  it("puts the notch on THAT module's back, and on nothing else", () => {
    const rows = production(run, undefined, [], cuts)!.panels;
    const notched = rows.filter((r) => r.cutouts?.length);
    expect(notched).toHaveLength(1);
    expect(notched[0].partEn).toBe("back");
    expect(notched[0].cutouts![0]).toMatchObject({ x: 300, w: 130, h: 720 });
  });

  it("says it in words as well, for the human on the saw", () => {
    const back = production(run, undefined, [], cuts)!.panels.find((r) => r.cutouts?.length)!;
    expect(back.profile).toContain("Вырезы: 1");
    expect(back.profile).toContain("130×720@300,0");
  });

  it("leaves every other back solid", () => {
    const rows = production(run, undefined, [], new Map())!.panels;
    expect(rows.some((r) => r.cutouts?.length)).toBe(false);
  });

  it("shifts a member's notch into the MERGED box's frame", () => {
    // one long back across two bays: a riser in the SECOND bay is 800mm along the box, not 300
    const merged: Cabinet[] = [
      mk({ kind: "base", x: 0, w: 800, h: 720, run: 0, carcassGroup: "row" }),
      mk({ kind: "base", x: 800, w: 800, h: 720, run: 0, carcassGroup: "row" }),
    ];
    const inSecondBay = new Map([[merged[1].id, [{ x: 300, y: 0, w: 130, h: 720 }]]]);
    const back = production(merged, undefined, [], inSecondBay)!.panels.find((r) => r.cutouts?.length)!;
    expect(back.cutouts![0].x).toBe(800 + 300);
  });

  it("carries the holes into the nest, so the cut plan draws the real part", () => {
    const packed = nestPanels(run, true, [], cuts);
    const back = packed.find((p) => p.cutouts?.length);
    expect(back).toBeTruthy();
    expect(back!.cutouts).toHaveLength(1);
  });
});
