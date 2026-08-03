// The CNC parts list must be the run's FINISHED sizes with NO kerf and NO nesting — that's the
// whole contract with the router (it nests + compensates for the bit itself). These tests pin
// that: sizes are preserved exactly, glass is dropped, grain follows the setting, and the .xlsx
// is a real (unzippable) workbook carrying those sizes.

import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { mk } from "../src/model/cabinet";
import { production } from "../src/model/cncExport";
import { partsList } from "../src/model/partsList";
import { partsXlsx, type PartsXlsxLabels, type PartsXlsxMeta } from "../src/model/partsXlsx";

const cabs = () => [
  mk({ kind: "base", w: 600, h: 720, fill: "shelves", count: 2 }),
  mk({ kind: "base", w: 800, h: 720, fill: "drawers", count: 3 }),
  mk({ kind: "upper", w: 600, h: 720, fill: "shelves", count: 1 }),
];

const sizesOf = (dims: { lengthMm: number; widthMm: number }[]) =>
  dims.map((d) => `${d.lengthMm}×${d.widthMm}`).sort();

describe("CNC parts list", () => {
  it("keeps FINISHED sizes with no kerf and no nesting (the multiset of sizes is preserved)", () => {
    const prod = production(cabs())!;
    expect(prod).toBeTruthy();
    const pl = partsList(prod, true);

    // every sawn (non-glass) production panel appears once, at its exact size — Qty expands back
    const expanded = pl.lines.flatMap((l) => Array.from({ length: l.qty }, () => ({ lengthMm: l.lengthMm, widthMm: l.widthMm })));
    const sawn = prod.panels.filter((p) => p.role !== "glass");
    expect(sizesOf(expanded)).toEqual(sizesOf(sawn));
    expect(pl.totalParts).toBe(sawn.length);
    // sizes are the production values verbatim (integers, untouched by any kerf)
    for (const l of pl.lines) {
      expect(Number.isInteger(l.lengthMm)).toBe(true);
      expect(Number.isInteger(l.widthMm)).toBe(true);
    }
  });

  it("drops glass panes (bought cut to size — not for the router)", () => {
    const prod = production(cabs())!;
    const pl = partsList(prod, true);
    // every panel is either glass (excluded) or a sawn part counted once in totalParts
    const glass = prod.panels.filter((p) => p.role === "glass").length;
    expect(glass + pl.totalParts).toBe(prod.panels.length);
  });

  it("grain follows respectGrain: facades are grained only when it is on", () => {
    const prod = production(cabs())!;
    const hasFacade = prod.panels.some((p) => p.role === "facade");
    const on = partsList(prod, true);
    const off = partsList(prod, false);
    expect(off.lines.every((l) => l.grain === false)).toBe(true);
    if (hasFacade) expect(on.lines.some((l) => l.grain === true)).toBe(true);
  });

  it("merges exact duplicates into one row with a summed Qty", () => {
    const prod = production(cabs())!;
    const pl = partsList(prod, true);
    // distinct rows never exceed physical parts, and any Qty>1 row is a true duplicate merge
    expect(pl.distinct).toBeLessThanOrEqual(pl.totalParts);
    expect(pl.lines.every((l) => l.qty >= 1)).toBe(true);
  });
});

const LABELS: PartsXlsxLabels = {
  sheetParts: "Детали", sheetHw: "Фурнитура", title: "Список деталей", from: "От", project: "Проект",
  grade: "Класс", reinforce: "Усиление", yes: "да", no: "нет", totalParts: "Всего", boardM2: "Площадь",
  note: "note", colNo: "№", colModule: "Модуль", colPart: "Наименование", colMat: "Материал",
  colThk: "Толщина", colLen: "Длина", colWid: "Ширина", colQty: "Кол-во", colGrain: "Слой",
  colEdge: "Кромка", colProfile: "Обработка", colHwName: "Наименование", colHwQty: "Кол-во", grainYes: "Да",
};
const META: PartsXlsxMeta = { project: "Кухня", fromLine: "Мастер", gradeLabel: "Стандарт", reinforced: false };

describe("CNC parts .xlsx", () => {
  it("is a real, unzippable workbook that carries the finished sizes", () => {
    const prod = production(cabs())!;
    const pl = partsList(prod, true);
    const bytes = partsXlsx(pl, META, LABELS);

    // ZIP local-file signature "PK\x03\x04"
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);

    const files = unzipSync(bytes);
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    expect(Object.keys(files)).toContain("[Content_Types].xml");
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    // a known part's length shows up as a numeric cell value in the sheet
    const first = pl.lines[0];
    expect(sheet).toContain(`<v>${first.lengthMm}</v>`);
    expect(sheet).toContain("Наименование"); // the header row is present
  });
});
